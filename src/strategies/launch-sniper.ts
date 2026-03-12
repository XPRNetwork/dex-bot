/**
 * Launch Sniper — auto-buy new tokens on simplelaunch bonding curves
 *
 * Monitors the simplelaunch indexer for new token launches. Buys a fixed
 * amount of XPR into each new token after a configurable delay, then sells
 * at 2x and 3x the entry price.
 *
 * Buy:  transfer XPR to `simplelaunch` with memo `buy:CURVE_ID:MIN_TOKENS_OUT`
 * Sell: direct action `simplelaunch::sell(seller, tokenId, tokenAmount, minXprOut)`
 *
 * Bonding curve: constant product with virtual reserves.
 *   tokensOut = (virtualTokens * xprAfterFee) / (virtualXpr + xprAfterFee)
 *   Fee: 1% on buys (deducted from XPR), 1% on sells (deducted from XPR output)
 */

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { launchSniperRepository } from '../persistence/index.js';

const logger = getLogger();
const STRATEGY_NAME = 'launch-sniper';

interface SellTarget {
  percentToSell: number;
  priceMultiple: number;
}

interface LaunchSniperConfig {
  enabled: boolean;
  buyAmountXPR: number;
  buyDelaySeconds: number;
  checkIntervalMs: number;
  maxEntryXpr: number;
  maxConcurrentPositions: number;
  sellTargets: SellTarget[];
  stopLoss: { enabled: boolean; priceMultiple: number };
  momentumExit: {
    enabled: boolean;
    minPriceMultiple: number;
    maxAgeSeconds: number;
    percentToSell: number;
    minHoldSeconds: number;
  };
  lateBuyScaling: {
    enabled: boolean;
    reducedBuyXPR: number;       // Smaller buy if we're late
    reducedThresholdXPR: number; // realXpr above this → use reduced buy
    skipThresholdXPR: number;    // realXpr above this → skip entirely
  };
  antiSnipeRetryMs: number;  // Retry interval during creator-only period
  dryRun: boolean;
  indexerUrl: string;
}

interface CurveState {
  id: number;
  symbol: string;        // e.g. "4,MOTHER"
  creator: string;
  virtualXpr: bigint;
  virtualTokens: bigint;
  realXpr: bigint;
  realTokensSold: bigint;
  graduated: boolean;
  dexPoolId: number;
  createdAt: number;     // Unix timestamp (seconds) — used to calculate anti-snipe end
}

interface TrackedLaunch {
  curveId: number;
  symbol: string;         // e.g. "MOTHER"
  precision: number;
  creator: string;
  detectedAt: number;
  buyExecutedAt: number;
  entryPriceXprPerToken: number;
  tokensHeld: bigint;
  originalTokensBought: bigint;  // Never changes after initial buy — used for sell % calculations
  tokenContract: string;
  sellTargetsHit: boolean[];   // one per sellTargets entry
  momentumExitDone: boolean;
  status: 'waiting' | 'bought' | 'partial_sold' | 'fully_sold' | 'stopped_out' | 'graduated';
  antiSnipeRetrying?: boolean;
  buyInProgress?: boolean;   // Mutex flag to prevent concurrent buy attempts
}

const BUY_FEE = 0.01;
const SELL_FEE = 0.01;
const SLIPPAGE_TOLERANCE = 0.20;  // 20% slippage tolerance — launches move fast

export class LaunchSniper {
  private rpc: JsonRpc;
  private api: Api;
  private config: LaunchSniperConfig;
  private username: string;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isDiscovering: boolean = false;
  private isMonitoring: boolean = false;

  private trackedLaunches: Map<number, TrackedLaunch> = new Map();
  private knownCurveIds: Set<number> = new Set();
  private totalXprDeployed: number = 0;
  private totalXprReturned: number = 0;
  private buyAmountOverrides: Map<number, number> = new Map();
  private consecutiveDiscoveryErrors: number = 0;
  private lastDiscoveryAlertAt: number = 0;

  constructor() {
    const config = getConfig() as any;

    this.config = {
      enabled: config.launchSniper?.enabled ?? false,
      buyAmountXPR: config.launchSniper?.buyAmountXPR ?? 1000,
      buyDelaySeconds: config.launchSniper?.buyDelaySeconds ?? 60,
      checkIntervalMs: config.launchSniper?.checkIntervalMs ?? 5000,
      maxEntryXpr: config.launchSniper?.maxEntryXpr ?? 5000,
      maxConcurrentPositions: config.launchSniper?.maxConcurrentPositions ?? 10,
      sellTargets: config.launchSniper?.sellTargets ?? [
        { percentToSell: 50, priceMultiple: 2.0 },
        { percentToSell: 100, priceMultiple: 3.0 },
      ],
      stopLoss: config.launchSniper?.stopLoss ?? { enabled: false, priceMultiple: 0.5 },
      momentumExit: {
        enabled: config.launchSniper?.momentumExit?.enabled ?? true,
        minPriceMultiple: config.launchSniper?.momentumExit?.minPriceMultiple ?? 1.8,
        maxAgeSeconds: config.launchSniper?.momentumExit?.maxAgeSeconds ?? 1800,
        percentToSell: config.launchSniper?.momentumExit?.percentToSell ?? 75,
        minHoldSeconds: config.launchSniper?.momentumExit?.minHoldSeconds ?? 180,
      },
      lateBuyScaling: config.launchSniper?.lateBuyScaling ?? {
        enabled: false,
        reducedBuyXPR: 2000,
        reducedThresholdXPR: 5000,
        skipThresholdXPR: 15000,
      },
      antiSnipeRetryMs: config.launchSniper?.antiSnipeRetryMs ?? 500,
      dryRun: config.launchSniper?.dryRun ?? true,
      indexerUrl: config.launchSniper?.indexerUrl ?? 'https://indexer.protonnz.com',
    };

    this.username = process.env.PROTON_USERNAME || '';
    const privateKey = process.env.PROTON_PRIVATE_KEY || '';

    this.rpc = new JsonRpc(config.rpc.endpoints);
    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: new JsSignatureProvider([privateKey]),
    });
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Launch Sniper disabled');
      return;
    }

    logger.info('🚀 Launch Sniper starting...');
    logger.info(`  Buy amount: ${this.config.buyAmountXPR} XPR`);
    logger.info(`  Buy delay: ${this.config.buyDelaySeconds}s`);
    logger.info(`  Max entry XPR in curve: ${this.config.maxEntryXpr}`);
    logger.info(`  Max positions: ${this.config.maxConcurrentPositions}`);
    logger.info(`  Sell targets: ${this.config.sellTargets.map(t => `${t.percentToSell}% @ ${t.priceMultiple}x`).join(', ')}`);
    logger.info(`  Stop loss: ${this.config.stopLoss.enabled ? `${this.config.stopLoss.priceMultiple}x` : 'disabled'}`);
    logger.info(`  Momentum exit: ${this.config.momentumExit.enabled ? `${this.config.momentumExit.percentToSell}% @ ${this.config.momentumExit.minPriceMultiple}x within ${this.config.momentumExit.maxAgeSeconds}s (min hold: ${this.config.momentumExit.minHoldSeconds}s)` : 'disabled'}`);
    logger.info(`  Late buy scaling: ${this.config.lateBuyScaling.enabled ? `reduce→${this.config.lateBuyScaling.reducedBuyXPR} XPR @${this.config.lateBuyScaling.reducedThresholdXPR}, skip @${this.config.lateBuyScaling.skipThresholdXPR}` : 'disabled'}`);
    logger.info(`  Anti-snipe retry: ${this.config.antiSnipeRetryMs}ms`);
    logger.info(`  Dry run: ${this.config.dryRun}`);

    // Seed known curve IDs so we don't buy old tokens on first run
    await this.seedKnownCurves();

    // Restore tracked positions from database (survives restarts)
    await this.loadPositionsFromDB();

    // Register Telegram callback handler for inline buy buttons
    telegramNotifier.onCallback((data) => {
      if (!data.startsWith('snipe:')) return;
      const parts = data.split(':');
      if (parts.length !== 3) return;

      const curveId = parseInt(parts[1], 10);
      const amount = parseInt(parts[2], 10);
      if (isNaN(curveId) || isNaN(amount)) return;

      let launch = this.trackedLaunches.get(curveId);
      if (!launch) {
        // Not tracked yet — create a minimal entry and buy immediately
        launch = {
          curveId,
          symbol: `CURVE${curveId}`,
          precision: 4,
          creator: '',
          detectedAt: Date.now(),
          buyExecutedAt: 0,
          entryPriceXprPerToken: 0,
          tokensHeld: 0n,
          originalTokensBought: 0n,
          tokenContract: 'simpletoken',
          sellTargetsHit: this.config.sellTargets.map(() => false),
          momentumExitDone: false,
          status: 'stopped_out',  // will be set to 'bought' after buy
        };
        // Try to get symbol from indexer
        this.enrichLaunchFromIndexer(launch).catch(() => {});
        this.trackedLaunches.set(curveId, launch);
        this.knownCurveIds.add(curveId);
      }

      if (launch.status === 'waiting') {
        // Still in delay period — accumulate to pending buy
        const current = this.buyAmountOverrides.get(curveId) || 0;
        this.buyAmountOverrides.set(curveId, current + amount);
        const totalBuy = this.config.buyAmountXPR + current + amount;
        const timeLeft = Math.max(0, this.config.buyDelaySeconds - (Date.now() - launch.detectedAt) / 1000);

        telegramNotifier.sendMessage(
          `✅ ${launch.symbol} buy increased to ${totalBuy} XPR (+${amount})\n` +
          `Buying in ${Math.ceil(timeLeft)}s`
        );
        return;
      }

      // Any other status — execute immediate buy
      const target = launch;
      this.handleImmediateBuy(target, amount).catch(err => {
        logger.error(`Immediate buy error for ${target.symbol}: ${err.message}`);
        telegramNotifier.sendMessage(`❌ ${target.symbol} buy failed: ${err.message.substring(0, 200)}`);
      });
    });

    // Fast loop for discovery + pending buys (every checkIntervalMs)
    this.discoveryInterval = setInterval(() => this.discoveryTick(), this.config.checkIntervalMs);
    // Slower loop for position monitoring (every 5s) — doesn't block discovery
    this.monitorInterval = setInterval(() => this.monitorTick(), 5000);
  }

  stop(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    logger.info('🚀 Launch Sniper stopped');
    this.logPnlSummary();
  }

  // ============================================================
  // Main loop
  // ============================================================

  /** Fast tick: discovery + pending buys only — never blocked by slow position monitoring */
  private async discoveryTick(): Promise<void> {
    if (this.isDiscovering) return;
    this.isDiscovering = true;
    try {
      await this.discoverNewLaunches();
      // processPendingBuys removed — scheduleBuy() handles buy timing precisely
      // Reset error counter on success
      if (this.consecutiveDiscoveryErrors > 0) {
        logger.info(`🚀 Discovery recovered after ${this.consecutiveDiscoveryErrors} consecutive errors`);
        this.consecutiveDiscoveryErrors = 0;
      }
    } catch (error: any) {
      this.consecutiveDiscoveryErrors++;
      logger.error(`Launch Sniper discovery tick error (${this.consecutiveDiscoveryErrors}x): ${error.message}`);

      // Alert on Telegram after 3+ consecutive failures, max once per 5 min
      const now = Date.now();
      if (this.consecutiveDiscoveryErrors >= 3 && now - this.lastDiscoveryAlertAt > 300_000) {
        this.lastDiscoveryAlertAt = now;
        telegramNotifier.sendMessage(
          `🚨 LAUNCH SNIPER DOWN\n\n` +
          `${this.consecutiveDiscoveryErrors} consecutive RPC failures\n` +
          `Error: ${error.message.substring(0, 200)}\n\n` +
          `⚠️ New launches will be MISSED until RPC recovers`
        ).catch(() => {});
      }
    } finally {
      this.isDiscovering = false;
    }
  }

  /** Slow tick: position monitoring + sell targets — runs independently */
  private async monitorTick(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    try {
      await this.monitorPositions();
    } catch (error: any) {
      logger.error(`Launch Sniper monitor tick error: ${error.message}`);
    } finally {
      this.isMonitoring = false;
    }
  }

  // ============================================================
  // Discovery
  // ============================================================

  /**
   * Seed known curve IDs directly from chain on startup.
   */
  private async seedKnownCurves(): Promise<void> {
    try {
      // Read curves table in reverse (newest first) to get the highest ID
      const result = await this.rpc.get_table_rows({
        code: 'simplelaunch',
        scope: 'simplelaunch',
        table: 'curves',
        reverse: true,
        limit: 1,
        json: true,
      });

      if (result.rows.length > 0) {
        const highestId = result.rows[0].id as number;
        // Mark all existing curves as known
        for (let i = 1; i <= highestId; i++) {
          this.knownCurveIds.add(i);
        }
        logger.info(`🚀 Seeded ${highestId} known curve IDs (highest: ${highestId})`);
      }
    } catch (error: any) {
      logger.warn(`Launch Sniper seed error: ${error.message}`);
    }
  }

  /**
   * Poll chain directly for new curves — no indexer delay.
   */
  private async discoverNewLaunches(): Promise<void> {
    try {
      // Read newest curves from chain
      const result = await this.rpc.get_table_rows({
        code: 'simplelaunch',
        scope: 'simplelaunch',
        table: 'curves',
        reverse: true,
        limit: 5,
        json: true,
      });

      for (const row of result.rows) {
        const curveId = row.id as number;
        if (this.knownCurveIds.has(curveId)) continue;
        if (row.graduated === 1) continue;

        this.knownCurveIds.add(curveId);

        const symbolParts = (row.symbol as string).split(',');
        const symbol = symbolParts.length > 1 ? symbolParts[1] : row.symbol;
        const precision = symbolParts.length > 1 ? parseInt(symbolParts[0], 10) : 4;
        const name = row.name || symbol;

        logger.info(`🆕 New launch detected: ${name} (${symbol}, curve ID: ${curveId}, creator: ${row.creator})`);

        // Check position limit
        const activePositions = this.countActivePositions();
        if (activePositions >= this.config.maxConcurrentPositions) {
          logger.info(`  Skipping — at max positions (${activePositions}/${this.config.maxConcurrentPositions})`);
          continue;
        }

        const launch: TrackedLaunch = {
          curveId,
          symbol,
          precision,
          creator: row.creator,
          detectedAt: Date.now(),
          buyExecutedAt: 0,
          entryPriceXprPerToken: 0,
          tokensHeld: 0n,
          originalTokensBought: 0n,
          tokenContract: 'simpletoken',
          sellTargetsHit: this.config.sellTargets.map(() => false),
          momentumExitDone: false,
          status: 'waiting',
        };
        this.trackedLaunches.set(curveId, launch);

        const createdAt = row.createdAt || 0;

        // Schedule buy at exact anti-snipe end time (createdAt + 60s + 0.5s buffer)
        // Fire-and-forget — does NOT block discovery loop
        this.scheduleBuy(launch, createdAt);

        // Send Telegram notification with buttons for additional buys
        const buttons = [
          [
            { text: '+100', callback_data: `snipe:${curveId}:100` },
            { text: '+500', callback_data: `snipe:${curveId}:500` },
            { text: '+1000', callback_data: `snipe:${curveId}:1000` },
            { text: '+2500', callback_data: `snipe:${curveId}:2500` },
            { text: '+5000', callback_data: `snipe:${curveId}:5000` },
          ]
        ];

        await telegramNotifier.sendMessageWithButtons(
          `🆕 ${name} (${symbol}) — curve ${curveId}\n` +
          `Creator: ${row.creator}\n` +
          `Tap to buy more:`,
          buttons
        );
      }
    } catch (error: any) {
      // Re-throw so discoveryTick can track consecutive failures + alert
      throw error;
    }
  }

  // ============================================================
  // Buy logic
  // ============================================================

  private async processPendingBuys(): Promise<void> {
    const now = Date.now();

    for (const [curveId, launch] of this.trackedLaunches) {
      if (launch.status !== 'waiting') continue;

      const elapsed = (now - launch.detectedAt) / 1000;
      if (elapsed < this.config.buyDelaySeconds) continue;

      // Time to buy — read fresh curve state
      const curve = await this.readCurveState(curveId);
      if (!curve) {
        logger.warn(`🚀 Could not read curve ${curveId} for ${launch.symbol}, removing`);
        launch.status = 'stopped_out';
        continue;
      }

      // Update precision from chain
      launch.precision = this.parsePrecision(curve.symbol);

      // Check if already graduated
      if (curve.graduated) {
        logger.info(`🚀 Skipping ${launch.symbol} — already graduated`);
        launch.status = 'graduated';
        continue;
      }

      await this.executeBuy(launch, curve);
    }
  }

  /**
   * Submit a buy TX and verify it was included on-chain. Retries up to maxRetries
   * times if the TX is dropped (returns TX ID but holdings don't appear).
   */
  private async verifyBuyOnChain(
    launch: TrackedLaunch, actions: any[],
    maxRetries: number = 3
  ): Promise<{ txId: string; holdings: bigint } | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const txResult = await this.api.transact({ actions }, {
          blocksBehind: 3, expireSeconds: 120,
        });
        const txId = (txResult as any)?.transaction_id || 'unknown';

        // Wait for chain inclusion then verify
        await new Promise(r => setTimeout(r, 1500));
        const holdings = await this.checkCurveHoldings(launch.curveId);

        if (holdings > 0n) {
          return { txId, holdings };
        }

        logger.warn(`⚠️ ${launch.symbol} buy attempt ${attempt}/${maxRetries}: TX ${txId} not confirmed on chain`);
      } catch (error: any) {
        const msg = error.message || '';
        // Re-throw anti-snipe errors for the caller to handle
        if (msg.includes('Creator-only') || msg.includes('early period') || msg.includes('antisnipe')) {
          throw error;
        }
        // Re-throw slippage errors — retrying same stale minTokensOut won't help,
        // needs fresh executeBuy with updated curve state
        if (msg.includes('Slippage')) {
          throw error;
        }
        logger.warn(`⚠️ ${launch.symbol} buy attempt ${attempt}/${maxRetries} error: ${msg}`);
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return null; // All retries failed
  }

  private async executeBuy(launch: TrackedLaunch, curve: CurveState): Promise<void> {
    // Prevent concurrent buy attempts (scheduleBuy + catch retries can race)
    if (launch.status === 'bought' || launch.status === 'partial_sold') return;
    if (launch.buyInProgress) {
      logger.info(`⏳ ${launch.symbol}: buy already in progress, skipping duplicate`);
      return;
    }
    launch.buyInProgress = true;

    try {
      await this._executeBuyInner(launch, curve);
    } finally {
      launch.buyInProgress = false;
    }
  }

  private async _executeBuyInner(launch: TrackedLaunch, curve: CurveState): Promise<void> {
    const extraXpr = this.buyAmountOverrides.get(launch.curveId) || 0;
    let totalBuyXpr = this.config.buyAmountXPR + extraXpr;

    // Late buy scaling: reduce or skip based on how much XPR is already in the curve
    if (this.config.lateBuyScaling.enabled) {
      const realXprFloat = Number(curve.realXpr) / 10000;
      if (realXprFloat > this.config.lateBuyScaling.skipThresholdXPR) {
        logger.info(`⏭️ ${launch.symbol}: ${realXprFloat.toFixed(0)} XPR in curve (>${this.config.lateBuyScaling.skipThresholdXPR}), pump over — skipping`);
        launch.status = 'stopped_out';
        this.savePosition(launch);
        await telegramNotifier.sendMessage(
          `⏭️ ${launch.symbol}: skipped — ${realXprFloat.toFixed(0)} XPR already in curve`
        );
        return;
      }
      if (realXprFloat > this.config.lateBuyScaling.reducedThresholdXPR) {
        const originalBuy = totalBuyXpr;
        totalBuyXpr = this.config.lateBuyScaling.reducedBuyXPR;
        logger.info(`⚠️ ${launch.symbol}: ${realXprFloat.toFixed(0)} XPR in curve, reducing buy ${originalBuy} → ${totalBuyXpr} XPR`);
      }
    }

    const buyAmountRaw = BigInt(Math.round(totalBuyXpr * 10000)); // 4 decimal XPR

    // Calculate expected tokens out
    const expectedTokens = this.calculateBuyOutput(curve.virtualXpr, curve.virtualTokens, buyAmountRaw);
    if (expectedTokens <= 0n) {
      logger.warn(`🚀 ${launch.symbol}: zero tokens expected, skipping`);
      launch.status = 'stopped_out';
      return;
    }

    // Entry price = inputXpr / tokensOut (both in float)
    const inputXprFloat = totalBuyXpr;
    const tokensOutFloat = Number(expectedTokens) / (10 ** launch.precision);
    const entryPrice = inputXprFloat / tokensOutFloat;

    // Min tokens out with slippage tolerance
    const minTokensOut = expectedTokens * BigInt(Math.floor((1 - SLIPPAGE_TOLERANCE) * 1000)) / 1000n;

    const buyAmountStr = `${totalBuyXpr.toFixed(4)} XPR`;
    const memo = `buy:${launch.curveId}:${minTokensOut.toString()}`;

    if (!launch.antiSnipeRetrying) {
      logger.info(`🎯 BUY ${launch.symbol}: ${buyAmountStr} → ~${tokensOutFloat.toFixed(launch.precision)} ${launch.symbol} (entry: ${entryPrice.toFixed(6)} XPR/token)`);
    }

    if (this.config.dryRun) {
      logger.info(`  [DRY RUN] Would send ${buyAmountStr} to simplelaunch, memo: ${memo}`);
      launch.status = 'stopped_out';  // Don't re-trigger in dry run
      return;
    }

    try {
      const actions = [{
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'simplelaunch',
          quantity: buyAmountStr,
          memo,
        },
      }];

      const result = await this.verifyBuyOnChain(launch, actions);

      if (!result) {
        // All retries exhausted — TX was never confirmed on chain
        logger.warn(`⚠️ ${launch.symbol}: buy failed after 3 attempts — no holdings on chain`);
        launch.status = 'stopped_out';
        this.savePosition(launch);
        await telegramNotifier.sendMessage(
          `⚠️ ${launch.symbol} buy FAILED\n` +
          `TX submitted 3 times but no holdings confirmed on chain.\n` +
          `Marked as stopped_out. Check manually.`
        );
        return;
      }

      const { txId, holdings: actualTokens } = result;
      const actualFloat = Number(actualTokens) / (10 ** launch.precision);
      const actualEntryPrice = inputXprFloat / actualFloat;

      launch.buyExecutedAt = Date.now();
      launch.entryPriceXprPerToken = actualEntryPrice;
      launch.tokensHeld = actualTokens;
      launch.originalTokensBought = actualTokens;
      launch.status = 'bought';
      this.totalXprDeployed += totalBuyXpr;
      this.savePosition(launch);

      logger.info(`✅ Bought ${actualFloat.toFixed(launch.precision)} ${launch.symbol} @ ${actualEntryPrice.toFixed(6)} XPR/token (TX: ${txId})`);

      const tokensPerXpr = actualFloat / totalBuyXpr;
      const sellTargetPrices = this.config.sellTargets.map(t =>
        `${t.priceMultiple}x = ${(actualEntryPrice * t.priceMultiple).toFixed(6)} XPR`
      ).join('\n');

      await telegramNotifier.sendMessage(
        `🎯 BOUGHT ${launch.symbol}\n\n` +
        `Spent: ${buyAmountStr}\n` +
        `Got: ${actualFloat.toFixed(launch.precision)} ${launch.symbol}\n` +
        `Rate: ${tokensPerXpr.toFixed(2)} ${launch.symbol}/XPR\n` +
        `Entry: ${actualEntryPrice.toFixed(6)} XPR/token\n\n` +
        `Sell targets:\n${sellTargetPrices}\n\n` +
        `TX: ${txId}`
      );
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('Creator-only') || msg.includes('early period') || msg.includes('antisnipe')) {
        // Anti-snipe error — bubble up so attemptBuy can handle retries
        throw error;
      } else if (msg.includes('Slippage')) {
        // Slippage error — bubble up so attemptBuy can handle retries
        throw error;
      } else {
        logger.error(`❌ Buy ${launch.symbol} failed: ${msg}`);
        launch.status = 'stopped_out';
        this.savePosition(launch);
        await telegramNotifier.sendMessage(`❌ Buy ${launch.symbol} FAILED\n${msg.substring(0, 200)}`);
      }
    }
  }

  /**
   * Schedule a buy at the exact anti-snipe end time.
   * Instead of spamming 120 failed TXs, we calculate createdAt + 60s and sleep until then.
   * Fires 0.5s after anti-snipe ends to land in the first eligible block.
   */
  private scheduleBuy(launch: TrackedLaunch, createdAt: number): void {
    const ANTI_SNIPE_SECONDS = 60;
    const BUFFER_MS = 500; // 0.5s after anti-snipe ends

    const antiSnipeEndMs = (createdAt + ANTI_SNIPE_SECONDS) * 1000;
    const now = Date.now();
    const delayMs = Math.max(0, antiSnipeEndMs - now + BUFFER_MS);

    if (delayMs > 120_000) {
      // More than 2 min away — something is wrong with the timestamp
      logger.warn(`⚠️ ${launch.symbol}: anti-snipe delay ${(delayMs / 1000).toFixed(1)}s seems wrong, buying immediately`);
      this.attemptBuy(launch);
      return;
    }

    if (delayMs < 100) {
      // Anti-snipe already ended — buy immediately
      logger.info(`🎯 ${launch.symbol}: anti-snipe already ended, buying now`);
      this.attemptBuy(launch);
      return;
    }

    logger.info(`⏱️ ${launch.symbol}: anti-snipe ends in ${(delayMs / 1000).toFixed(1)}s — scheduled buy at exact moment`);

    setTimeout(() => {
      if (launch.status === 'bought' || launch.status === 'partial_sold') return; // Already bought
      logger.info(`🎯 ${launch.symbol}: anti-snipe ended — executing buy NOW`);
      this.attemptBuy(launch);
    }, delayMs);
  }

  /**
   * Attempt to buy with fresh curve state. If it fails with anti-snipe error,
   * retries a few times at 500ms intervals (shouldn't happen with correct timing).
   */
  private async attemptBuy(launch: TrackedLaunch, retriesLeft: number = 3): Promise<void> {
    if (launch.status === 'bought' || launch.status === 'partial_sold') return;

    try {
      const curve = await this.readCurveState(launch.curveId);
      if (!curve) {
        if (retriesLeft > 0) {
          setTimeout(() => this.attemptBuy(launch, retriesLeft - 1), 500);
        } else {
          launch.status = 'stopped_out';
          this.savePosition(launch);
        }
        return;
      }
      if (curve.graduated) {
        logger.info(`🔒 ${launch.symbol}: graduated before buy`);
        launch.status = 'graduated';
        this.savePosition(launch);
        return;
      }

      await this.executeBuy(launch, curve);
    } catch (err: any) {
      const emsg = err.message || '';
      if ((emsg.includes('Creator-only') || emsg.includes('early period') || emsg.includes('antisnipe')) && retriesLeft > 0) {
        // Still locked — retry a few more times
        logger.info(`🔒 ${launch.symbol}: still in anti-snipe, retrying in 500ms (${retriesLeft} left)`);
        setTimeout(() => this.attemptBuy(launch, retriesLeft - 1), 500);
      } else if (emsg.includes('Slippage') && retriesLeft > 0) {
        logger.warn(`⚠️ ${launch.symbol}: slippage on buy, retrying with fresh price`);
        setTimeout(() => this.attemptBuy(launch, retriesLeft - 1), 0);
      } else {
        logger.error(`❌ ${launch.symbol}: buy failed: ${emsg}`);
        launch.status = 'stopped_out';
        this.savePosition(launch);
        await telegramNotifier.sendMessage(`❌ Buy ${launch.symbol} FAILED\n${emsg.substring(0, 200)}`);
      }
    }
  }

  // ============================================================
  // Immediate buy (triggered by inline button tap)
  // ============================================================

  /**
   * Execute an immediate buy for a tracked launch — on curve or DEX.
   */
  private async handleImmediateBuy(launch: TrackedLaunch, xprAmount: number): Promise<void> {
    const curve = await this.readCurveState(launch.curveId);

    if (curve && !curve.graduated) {
      // Buy on bonding curve
      await this.immediateCurveBuy(launch, curve, xprAmount);
    } else if (curve && curve.graduated && curve.dexPoolId > 0) {
      // Buy on SimpleDEX
      await this.immediateDexBuy(launch, curve.dexPoolId, xprAmount);
    } else {
      await telegramNotifier.sendMessage(`❌ ${launch.symbol}: curve not found or no DEX pool`);
    }
  }

  private async immediateCurveBuy(launch: TrackedLaunch, curve: CurveState, xprAmount: number): Promise<void> {
    const buyAmountRaw = BigInt(Math.round(xprAmount * 10000));
    const expectedTokens = this.calculateBuyOutput(curve.virtualXpr, curve.virtualTokens, buyAmountRaw);

    if (expectedTokens <= 0n) {
      await telegramNotifier.sendMessage(`❌ ${launch.symbol}: zero tokens expected for ${xprAmount} XPR`);
      return;
    }

    const minTokensOut = expectedTokens * BigInt(Math.floor((1 - SLIPPAGE_TOLERANCE) * 1000)) / 1000n;
    const buyAmountStr = `${xprAmount.toFixed(4)} XPR`;
    const memo = `buy:${launch.curveId}:${minTokensOut.toString()}`;

    if (this.config.dryRun) {
      const tokensFloat = Number(expectedTokens) / (10 ** launch.precision);
      await telegramNotifier.sendMessage(
        `[DRY RUN] Would buy ~${tokensFloat.toFixed(launch.precision)} ${launch.symbol} for ${buyAmountStr}`
      );
      return;
    }

    const holdingsBefore = await this.checkCurveHoldings(launch.curveId);

    const actions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: { from: this.username, to: 'simplelaunch', quantity: buyAmountStr, memo },
    }];

    let txId: string;
    try {
      const txResult = await this.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
      txId = (txResult as any)?.transaction_id || 'unknown';
    } catch (error: any) {
      logger.error(`❌ Curve buy ${launch.symbol} failed: ${error.message}`);
      await telegramNotifier.sendMessage(`❌ ${launch.symbol} curve buy failed: ${error.message.substring(0, 200)}`);
      return;
    }

    // Verify holdings actually increased
    await new Promise(r => setTimeout(r, 1500));
    const holdingsAfter = await this.checkCurveHoldings(launch.curveId);

    if (holdingsAfter <= holdingsBefore) {
      logger.warn(`⚠️ ${launch.symbol}: curve buy TX ${txId} returned but holdings unchanged`);
      await telegramNotifier.sendMessage(
        `⚠️ ${launch.symbol} curve buy unconfirmed\n` +
        `TX ${txId} returned but holdings unchanged on chain.`
      );
      return;
    }

    const tokensReceived = holdingsAfter - holdingsBefore;
    const tokensFloat = Number(tokensReceived) / (10 ** launch.precision);
    const rate = tokensFloat / xprAmount;

    // Update tracked state
    launch.tokensHeld += tokensReceived;
    launch.originalTokensBought += tokensReceived;
    this.totalXprDeployed += xprAmount;
    if (launch.status === 'stopped_out' || launch.status === 'fully_sold') {
      launch.status = 'bought';
      launch.entryPriceXprPerToken = xprAmount / tokensFloat;
    }
    this.savePosition(launch);

    const totalHeld = Number(launch.tokensHeld) / (10 ** launch.precision);

    await telegramNotifier.sendMessage(
      `🎯 BOUGHT ${launch.symbol} (curve)\n\n` +
      `Spent: ${buyAmountStr}\n` +
      `Got: ${tokensFloat.toFixed(launch.precision)} ${launch.symbol}\n` +
      `Rate: ${rate.toFixed(2)} ${launch.symbol}/XPR\n` +
      `Total held: ${totalHeld.toFixed(launch.precision)} ${launch.symbol}\n\n` +
      `TX: ${txId}`
    );
  }

  private async immediateDexBuy(launch: TrackedLaunch, poolId: number, xprAmount: number): Promise<void> {
    const buyAmountStr = `${xprAmount.toFixed(4)} XPR`;

    if (this.config.dryRun) {
      await telegramNotifier.sendMessage(
        `[DRY RUN] Would swap ${buyAmountStr} for ${launch.symbol} on SimpleDEX pool ${poolId}`
      );
      return;
    }

    const balanceBefore = await this.checkTokenBalance(launch.symbol, launch.precision);

    // SimpleDEX swap: transfer XPR to simpledex with memo swap:POOL_ID:MIN_OUT:IS_TOKEN_A_IN
    // XPR is tokenA in these pools, so IS_TOKEN_A_IN = 1, MIN_OUT = 0 (use slippage on-chain)
    const memo = `swap:${poolId}:0:1`;
    const actions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: { from: this.username, to: 'simpledex', quantity: buyAmountStr, memo },
    }];

    let txId: string;
    try {
      const txResult = await this.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
      txId = (txResult as any)?.transaction_id || 'unknown';
    } catch (error: any) {
      logger.error(`❌ DEX buy ${launch.symbol} failed: ${error.message}`);
      await telegramNotifier.sendMessage(`❌ ${launch.symbol} DEX buy failed: ${error.message.substring(0, 200)}`);
      return;
    }

    // Wait briefly for balance to update
    await new Promise(r => setTimeout(r, 1500));
    const balanceAfter = await this.checkTokenBalance(launch.symbol, launch.precision);

    if (balanceAfter <= balanceBefore) {
      logger.warn(`⚠️ ${launch.symbol}: DEX buy TX ${txId} returned but balance unchanged`);
      await telegramNotifier.sendMessage(
        `⚠️ ${launch.symbol} DEX buy unconfirmed\n` +
        `TX ${txId} returned but token balance unchanged on chain.`
      );
      return;
    }

    const tokensReceived = balanceAfter - balanceBefore;
    const tokensFloat = Number(tokensReceived) / (10 ** launch.precision);
    const rate = tokensFloat > 0 ? tokensFloat / xprAmount : 0;

    // Update tracked state
    launch.tokensHeld += tokensReceived;
    launch.originalTokensBought += tokensReceived;
    this.totalXprDeployed += xprAmount;
    if (launch.status !== 'bought' && launch.status !== 'partial_sold') {
      launch.status = 'bought';
      if (tokensFloat > 0) launch.entryPriceXprPerToken = xprAmount / tokensFloat;
    }
    this.savePosition(launch);

    const totalHeld = Number(launch.tokensHeld) / (10 ** launch.precision);

    await telegramNotifier.sendMessage(
      `🎯 BOUGHT ${launch.symbol} (DEX pool ${poolId})\n\n` +
      `Spent: ${buyAmountStr}\n` +
      `Got: ${tokensFloat.toFixed(launch.precision)} ${launch.symbol}\n` +
      `Rate: ${rate.toFixed(2)} ${launch.symbol}/XPR\n` +
      `Total held: ${totalHeld.toFixed(launch.precision)} ${launch.symbol}\n\n` +
      `TX: ${txId}`
    );
  }

  // ============================================================
  // Claim graduated tokens
  // ============================================================

  /**
   * Claim tokens from a graduated curve → transfers to simpletoken balance.
   */
  private async claimGraduatedTokens(launch: TrackedLaunch): Promise<void> {
    logger.info(`🎓 Claiming ${launch.symbol} tokens from graduated curve ${launch.curveId}`);

    if (this.config.dryRun) {
      const held = Number(launch.tokensHeld) / (10 ** launch.precision);
      logger.info(`  [DRY RUN] Would claim ${held.toFixed(launch.precision)} ${launch.symbol}`);
      return;
    }

    try {
      const actions = [{
        account: 'simplelaunch',
        name: 'claim',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          account: this.username,
          tokenId: launch.curveId,
        },
      }];

      const txResult = await this.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
      const txId = (txResult as any)?.transaction_id || 'unknown';

      // Verify tokens arrived in simpletoken (wait for chain state to update)
      await new Promise(r => setTimeout(r, 1500));
      const balance = await this.checkTokenBalance(launch.symbol, launch.precision);
      const balanceFloat = Number(balance) / (10 ** launch.precision);

      logger.info(`✅ Claimed ${launch.symbol} → ${balanceFloat.toFixed(launch.precision)} in wallet (TX: ${txId})`);

      await telegramNotifier.sendMessage(
        `🎓 ${launch.symbol} graduated!\n\n` +
        `Claimed ${balanceFloat.toFixed(launch.precision)} ${launch.symbol} to wallet\n` +
        `Now tradeable on SimpleDEX pool ${launch.curveId}\n` +
        `TX: ${txId}`
      );
    } catch (error: any) {
      logger.error(`❌ Claim ${launch.symbol} failed: ${error.message}`);
      await telegramNotifier.sendMessage(`❌ Claim ${launch.symbol} FAILED\n${error.message.substring(0, 200)}`);
    }
  }

  /**
   * Dump graduated tokens on SimpleDEX for XPR immediately after claiming.
   */
  private async graduationDump(launch: TrackedLaunch, poolId: number): Promise<void> {
    const balance = await this.checkTokenBalance(launch.symbol, launch.precision);
    if (balance <= 0n) {
      logger.info(`🎓 ${launch.symbol}: no token balance to dump after claim`);
      return;
    }

    const tokensFloat = Number(balance) / (10 ** launch.precision);
    const assetStr = `${tokensFloat.toFixed(launch.precision)} ${launch.symbol}`;

    logger.info(`🎓 Dumping ${assetStr} on SimpleDEX pool ${poolId}`);

    if (this.config.dryRun) {
      logger.info(`  [DRY RUN] Would swap ${assetStr} → XPR on SimpleDEX pool ${poolId}`);
      return;
    }

    const xprBefore = await this.checkXprBalance();

    try {
      // Token is tokenB in graduated pools, XPR is tokenA → IS_TOKEN_A_IN = 0
      const memo = `swap:${poolId}:0:0`;
      const actions = [{
        account: launch.tokenContract,
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'simpledex',
          quantity: assetStr,
          memo,
        },
      }];

      const txResult = await this.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
      const txId = (txResult as any)?.transaction_id || 'unknown';

      await new Promise(r => setTimeout(r, 1500));
      const xprAfter = await this.checkXprBalance();
      const xprReceived = xprAfter - xprBefore;
      const xprReceivedFloat = Number(xprReceived) / 10000;

      launch.tokensHeld = 0n;
      this.totalXprReturned += xprReceivedFloat;

      logger.info(`✅ Graduation dump: ${assetStr} → ${xprReceivedFloat.toFixed(4)} XPR (TX: ${txId})`);

      await telegramNotifier.sendMessage(
        `🎓 GRADUATION DUMP ${launch.symbol}\n\n` +
        `Sold: ${assetStr} on SimpleDEX pool ${poolId}\n` +
        `Got: ${xprReceivedFloat.toFixed(4)} XPR\n` +
        `TX: ${txId}`
      );
    } catch (error: any) {
      logger.error(`❌ Graduation dump ${launch.symbol} failed: ${error.message}`);
      await telegramNotifier.sendMessage(
        `❌ Graduation dump ${launch.symbol} FAILED\n${error.message.substring(0, 200)}`
      );
    }
  }

  /**
   * Check XPR balance (eosio.token, 4 decimal precision).
   */
  private async checkXprBalance(): Promise<bigint> {
    try {
      const result = await this.rpc.get_table_rows({
        code: 'eosio.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true,
      });

      for (const row of result.rows) {
        const balance = row.balance as string;
        if (balance.includes('XPR')) {
          const amount = parseFloat(balance.split(' ')[0]);
          return BigInt(Math.round(amount * 10000));
        }
      }
      return 0n;
    } catch (error: any) {
      logger.debug(`checkXprBalance error: ${error.message}`);
      return 0n;
    }
  }

  // ============================================================
  // Position monitoring & sells
  // ============================================================

  private async monitorPositions(): Promise<void> {
    for (const [curveId, launch] of this.trackedLaunches) {
      // Monitor any position that still holds tokens (moonbag included)
      // Only skip positions with zero tokens or terminal states with nothing left
      if (launch.tokensHeld <= 0n) continue;
      if (launch.status === 'graduated' || launch.status === 'stopped_out' || launch.status === 'waiting') continue;

      const curve = await this.readCurveState(curveId);
      if (!curve) continue;

      // Check graduation — claim tokens and dump on SimpleDEX
      // But KEEP moonbag tokens (partial_sold = momentum exit already took profit)
      if (curve.graduated) {
        logger.info(`🎓 ${launch.symbol} graduated to SimpleDEX pool ${curve.dexPoolId}`);
        if (launch.tokensHeld > 0n) {
          await this.claimGraduatedTokens(launch);
          if (curve.dexPoolId > 0) {
            // If we already did momentum exit / partial sell, remaining tokens are moonbag — keep them
            if (launch.momentumExitDone || launch.status === 'partial_sold') {
              logger.info(`🌙 ${launch.symbol}: keeping moonbag (${(Number(launch.tokensHeld) / (10 ** launch.precision)).toFixed(launch.precision)} tokens) — not dumping`);
              await telegramNotifier.sendMessage(
                `🌙 ${launch.symbol} graduated — keeping moonbag!\n` +
                `Tokens: ${(Number(launch.tokensHeld) / (10 ** launch.precision)).toFixed(launch.precision)} ${launch.symbol}\n` +
                `SimpleDEX pool: ${curve.dexPoolId}`
              );
            } else {
              // Never sold anything — dump the whole bag
              await this.graduationDump(launch, curve.dexPoolId);
            }
          }
        }
        launch.status = 'graduated';
        this.savePosition(launch);
        continue;
      }

      const currentPrice = this.calculateCurrentPrice(curve.virtualXpr, curve.virtualTokens);
      const priceMultiple = currentPrice / launch.entryPriceXprPerToken;

      // Momentum exit: if price rose fast, take profit early (but wait minHoldSeconds first)
      if (this.config.momentumExit.enabled && !launch.momentumExitDone) {
        const ageSeconds = (Date.now() - launch.buyExecutedAt) / 1000;
        if (ageSeconds >= this.config.momentumExit.minHoldSeconds
            && ageSeconds <= this.config.momentumExit.maxAgeSeconds
            && priceMultiple >= this.config.momentumExit.minPriceMultiple) {
          const pct = this.config.momentumExit.percentToSell;
          const tokensToSell = this.calculateSellAmount(launch, pct, -1);
          if (tokensToSell > 0n) {
            logger.info(`🚀 ${launch.symbol}: ${priceMultiple.toFixed(2)}x in ${ageSeconds.toFixed(0)}s → MOMENTUM EXIT (${pct}%)`);
            const success = await this.executeSell(launch, curve, tokensToSell,
              `momentum ${priceMultiple.toFixed(1)}x in ${Math.round(ageSeconds)}s`);
            if (success) {
              launch.momentumExitDone = true;
              launch.status = launch.tokensHeld > 0n ? 'partial_sold' : 'fully_sold';
              this.savePosition(launch);
            }
            continue; // Skip normal targets this tick
          }
        }
      }

      // Check sell targets in order (but respect min hold time)
      const holdSeconds = (Date.now() - launch.buyExecutedAt) / 1000;
      if (holdSeconds < this.config.momentumExit.minHoldSeconds) continue;
      for (let i = 0; i < this.config.sellTargets.length; i++) {
        if (launch.sellTargetsHit[i]) continue;
        const target = this.config.sellTargets[i];

        if (priceMultiple >= target.priceMultiple) {
          // Calculate amount to sell
          const tokensToSell = this.calculateSellAmount(launch, target.percentToSell, i);
          if (tokensToSell <= 0n) continue;

          logger.info(`📈 ${launch.symbol}: price ${priceMultiple.toFixed(2)}x entry → selling ${target.percentToSell}% at ${target.priceMultiple}x target`);
          const success = await this.executeSell(launch, curve, tokensToSell, `${target.priceMultiple}x target`);

          if (success) {
            launch.sellTargetsHit[i] = true;

            // Update status — NEVER mark fully_sold while tokens remain (moonbag)
            if (launch.sellTargetsHit.every(h => h) && launch.tokensHeld <= 0n) {
              launch.status = 'fully_sold';
            } else {
              launch.status = 'partial_sold';
            }
            this.savePosition(launch);
          }
          // If !success, target NOT marked hit → will retry next tick
          break;  // One sell per tick to avoid stale curve state
        }
      }

      // Stop loss check
      if (this.config.stopLoss.enabled && priceMultiple <= this.config.stopLoss.priceMultiple) {
        if (launch.tokensHeld > 0n) {
          logger.info(`📉 ${launch.symbol}: price ${priceMultiple.toFixed(2)}x entry → STOP LOSS at ${this.config.stopLoss.priceMultiple}x`);
          const success = await this.executeSell(launch, curve, launch.tokensHeld, 'stop loss');
          if (success) {
            launch.status = 'stopped_out';
            this.savePosition(launch);
          }
        }
      }
    }
  }

  /**
   * Calculate how many tokens to sell for a given target.
   * percentToSell is percent of ORIGINAL position, not current holdings.
   * This ensures consistent sell amounts regardless of prior sells.
   * MOONBAG FLOOR: always keep at least 20% of original — no config can bypass this.
   */
  private calculateSellAmount(launch: TrackedLaunch, percentToSell: number, targetIndex: number): bigint {
    if (launch.tokensHeld <= 0n) return 0n;

    // Use original buy amount as base (falls back to current holdings if not set)
    const original = launch.originalTokensBought > 0n
      ? launch.originalTokensBought
      : launch.tokensHeld;

    // MOONBAG FLOOR: never sell below 20% of original position
    const moonBagFloor = original * 20n / 100n;

    // 100% means sell everything ABOVE the moonbag floor
    if (percentToSell >= 100) {
      const sellable = launch.tokensHeld - moonBagFloor;
      return sellable > 0n ? sellable : 0n;
    }

    const amount = original * BigInt(percentToSell) / 100n;
    // Cap: never sell below moonbag floor
    const maxSellable = launch.tokensHeld - moonBagFloor;
    if (maxSellable <= 0n) return 0n;

    const capped = amount > maxSellable ? maxSellable : amount;
    return capped > 0n ? capped : 0n;
  }

  private async executeSell(launch: TrackedLaunch, curve: CurveState, tokenAmount: bigint, reason: string): Promise<boolean> {
    // Calculate expected XPR out
    const expectedXprOut = this.calculateSellOutput(curve.virtualXpr, curve.virtualTokens, tokenAmount);
    const minXprOut = expectedXprOut * BigInt(Math.floor((1 - SLIPPAGE_TOLERANCE) * 1000)) / 1000n;

    const tokensFloat = Number(tokenAmount) / (10 ** launch.precision);
    const xprOutFloat = Number(expectedXprOut) / 10000;

    logger.info(`💰 SELL ${launch.symbol}: ${tokensFloat.toFixed(launch.precision)} tokens → ~${xprOutFloat.toFixed(4)} XPR (${reason})`);

    if (this.config.dryRun) {
      logger.info(`  [DRY RUN] Would sell ${tokensFloat.toFixed(launch.precision)} ${launch.symbol}`);
      return true;  // Treat dry run as success
    }

    try {
      const actions = [{
        account: 'simplelaunch',
        name: 'sell',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          seller: this.username,
          tokenId: launch.curveId,
          tokenAmount: tokenAmount.toString(),
          minXpr: minXprOut.toString(),
        },
      }];

      const txResult = await this.api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 120,
      });

      const txId = (txResult as any)?.transaction_id || 'unknown';

      // Verify sell actually reduced holdings on chain
      await new Promise(r => setTimeout(r, 1500));
      const holdingsAfter = await this.checkCurveHoldings(launch.curveId);
      launch.tokensHeld = holdingsAfter >= 0n ? holdingsAfter : (launch.tokensHeld - tokenAmount);
      this.totalXprReturned += xprOutFloat;

      logger.info(`✅ Sold ${tokensFloat.toFixed(launch.precision)} ${launch.symbol} for ~${xprOutFloat.toFixed(4)} XPR (TX: ${txId})`);

      const priceMultiple = this.calculateCurrentPrice(curve.virtualXpr, curve.virtualTokens) / launch.entryPriceXprPerToken;

      await telegramNotifier.sendMessage(
        `💰 SOLD ${launch.symbol} (${reason})\n` +
        `${tokensFloat.toFixed(launch.precision)} ${launch.symbol} → ~${xprOutFloat.toFixed(4)} XPR\n` +
        `Price: ${priceMultiple.toFixed(2)}x entry\n` +
        `Remaining: ${(Number(launch.tokensHeld) / (10 ** launch.precision)).toFixed(launch.precision)} ${launch.symbol}\n` +
        `TX: ${txId}`
      );
      return true;
    } catch (error: any) {
      logger.error(`❌ Sell ${launch.symbol} failed: ${error.message}`);

      // If insufficient holdings, refresh tokensHeld from chain to stop retrying wrong amounts
      if (error.message?.includes('Insufficient holdings')) {
        const actual = await this.checkCurveHoldings(launch.curveId);
        if (actual >= 0n) {
          logger.warn(`⚠️ ${launch.symbol}: chain holdings=${actual}, was tracking ${launch.tokensHeld} — syncing`);
          launch.tokensHeld = actual;
          this.savePosition(launch);
        }
      }

      await telegramNotifier.sendMessage(`❌ Sell ${launch.symbol} FAILED (${reason})\n${error.message.substring(0, 200)}`);
      return false;
    }
  }

  // ============================================================
  // Bonding curve math
  // ============================================================

  /**
   * Calculate tokens received for a given XPR input (1% buy fee).
   * tokensOut = (virtualTokens * xprAfterFee) / (virtualXpr + xprAfterFee)
   */
  private calculateBuyOutput(virtualXpr: bigint, virtualTokens: bigint, inputXprRaw: bigint): bigint {
    const xprAfterFee = inputXprRaw * 99n / 100n; // 1% fee
    return (virtualTokens * xprAfterFee) / (virtualXpr + xprAfterFee);
  }

  /**
   * Calculate XPR received for selling tokens (1% sell fee on output).
   * xprOut = (virtualXpr * tokensIn) / (virtualTokens + tokensIn) * 0.99
   */
  private calculateSellOutput(virtualXpr: bigint, virtualTokens: bigint, tokensIn: bigint): bigint {
    const xprOutBeforeFee = (virtualXpr * tokensIn) / (virtualTokens + tokensIn);
    return xprOutBeforeFee * 99n / 100n; // 1% fee
  }

  /**
   * Current spot price in XPR per token (from virtual reserves).
   */
  private calculateCurrentPrice(virtualXpr: bigint, virtualTokens: bigint): number {
    return Number(virtualXpr) / Number(virtualTokens);
  }

  // ============================================================
  // Chain reads
  // ============================================================

  private async readCurveState(curveId: number): Promise<CurveState | null> {
    try {
      const result = await this.rpc.get_table_rows({
        code: 'simplelaunch',
        scope: 'simplelaunch',
        table: 'curves',
        lower_bound: curveId,
        upper_bound: curveId,
        limit: 1,
        json: true,
      });

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        symbol: row.symbol,
        creator: row.creator,
        virtualXpr: BigInt(row.virtualXpr),
        virtualTokens: BigInt(row.virtualTokens),
        realXpr: BigInt(row.realXpr),
        realTokensSold: BigInt(row.realTokensSold),
        graduated: row.graduated === 1,
        dexPoolId: row.dexPoolId || 0,
        createdAt: row.createdAt || 0,
      };
    } catch (error: any) {
      logger.debug(`readCurveState(${curveId}) error: ${error.message}`);
      return null;
    }
  }

  private async checkTokenBalance(symbol: string, precision: number): Promise<bigint> {
    try {
      const result = await this.rpc.get_table_rows({
        code: 'simpletoken',
        scope: this.username,
        table: 'accounts',
        limit: 100,
        json: true,
      });

      for (const row of result.rows) {
        const balance = row.balance as string;
        if (balance.includes(symbol)) {
          const amount = parseFloat(balance.split(' ')[0]);
          return BigInt(Math.round(amount * (10 ** precision)));
        }
      }
      return 0n;
    } catch (error: any) {
      logger.debug(`checkTokenBalance(${symbol}) error: ${error.message}`);
      return 0n;
    }
  }

  /**
   * Check token holdings on the bonding curve (tokens stay here until graduation).
   */
  private async checkCurveHoldings(curveId: number): Promise<bigint> {
    try {
      const result = await this.rpc.get_table_rows({
        code: 'simplelaunch',
        scope: this.username,
        table: 'holdings',
        lower_bound: curveId,
        upper_bound: curveId,
        limit: 1,
        json: true,
      });

      if (result.rows.length > 0 && result.rows[0].tokenId === curveId) {
        return BigInt(result.rows[0].amount);
      }
      return 0n;
    } catch (error: any) {
      logger.debug(`checkCurveHoldings(${curveId}) error: ${error.message}`);
      return 0n;
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private parsePrecision(symbolStr: string): number {
    // Format: "4,MOTHER" → precision 4
    const parts = symbolStr.split(',');
    return parts.length > 1 ? parseInt(parts[0], 10) : 4;
  }

  private countActivePositions(): number {
    let count = 0;
    for (const launch of this.trackedLaunches.values()) {
      if (launch.status === 'waiting' || launch.status === 'bought' || launch.status === 'partial_sold') {
        count++;
      }
    }
    return count;
  }

  /**
   * Fill in symbol/precision/creator from indexer for an ad-hoc tracked launch.
   */
  private async enrichLaunchFromIndexer(launch: TrackedLaunch): Promise<void> {
    try {
      const resp = await fetch(`${this.config.indexerUrl}/api/tokens?sort=newest&limit=50`);
      if (!resp.ok) return;
      const body = await resp.json() as any;
      const tokens: any[] = body.tokens || body;
      const match = tokens.find((t: any) => t.tokenId === launch.curveId);
      if (match) {
        launch.symbol = match.symbol;
        launch.creator = match.creator;
      }
    } catch {
      // best-effort
    }

    // Also try reading precision from chain
    try {
      const curve = await this.readCurveState(launch.curveId);
      if (curve) {
        launch.precision = this.parsePrecision(curve.symbol);
        // Update symbol from chain if indexer didn't help
        if (launch.symbol.startsWith('CURVE')) {
          const parts = curve.symbol.split(',');
          if (parts.length > 1) launch.symbol = parts[1];
        }
      }
    } catch {
      // best-effort
    }
  }

  /**
   * Persist a tracked launch to the database.
   */
  private savePosition(launch: TrackedLaunch): void {
    try {
      launchSniperRepository.upsertPosition({
        curve_id: launch.curveId,
        symbol: launch.symbol,
        precision_val: launch.precision,
        creator: launch.creator,
        detected_at: launch.detectedAt,
        buy_executed_at: launch.buyExecutedAt,
        entry_price_xpr_per_token: launch.entryPriceXprPerToken,
        tokens_held: launch.tokensHeld.toString(),
        original_tokens_bought: launch.originalTokensBought.toString(),
        token_contract: launch.tokenContract,
        sell_targets_hit: JSON.stringify(launch.sellTargetsHit),
        status: launch.status,
        total_xpr_spent: this.buyAmountOverrides.get(launch.curveId) || 0,
        momentum_exit_done: launch.momentumExitDone ? 1 : 0,
      });
    } catch (error: any) {
      logger.debug(`savePosition(${launch.symbol}) error: ${error.message}`);
    }
  }

  /**
   * Load persisted positions from DB and re-hydrate trackedLaunches.
   * Also refreshes token holdings from chain for active positions.
   */
  private async loadPositionsFromDB(): Promise<void> {
    try {
      const rows = launchSniperRepository.getAllActivePositions();
      if (rows.length === 0) return;

      logger.info(`🚀 Restoring ${rows.length} positions from database...`);

      for (const row of rows) {
        this.knownCurveIds.add(row.curve_id);

        let sellTargetsHit: boolean[];
        try {
          sellTargetsHit = JSON.parse(row.sell_targets_hit);
        } catch {
          sellTargetsHit = this.config.sellTargets.map(() => false);
        }

        // Ensure sellTargetsHit array matches current config length
        while (sellTargetsHit.length < this.config.sellTargets.length) {
          sellTargetsHit.push(false);
        }

        const launch: TrackedLaunch = {
          curveId: row.curve_id,
          symbol: row.symbol,
          precision: row.precision_val,
          creator: row.creator,
          detectedAt: row.detected_at,
          buyExecutedAt: row.buy_executed_at,
          entryPriceXprPerToken: row.entry_price_xpr_per_token,
          tokensHeld: BigInt(row.tokens_held),
          originalTokensBought: BigInt(row.original_tokens_bought || '0'),
          tokenContract: row.token_contract,
          sellTargetsHit,
          momentumExitDone: !!(row as any).momentum_exit_done,
          status: row.status as TrackedLaunch['status'],
        };

        // Refresh holdings from chain
        const curveState = await this.readCurveState(row.curve_id);
        if (curveState && !curveState.graduated) {
          const holdings = await this.checkCurveHoldings(row.curve_id);
          if (holdings > 0n) {
            launch.tokensHeld = holdings;
            // Fix stale fully_sold: if tokens remain, keep monitoring
            if (launch.status === 'fully_sold') {
              logger.info(`  ⚠️ ${launch.symbol}: was fully_sold but still holds ${Number(holdings) / (10 ** launch.precision)} tokens — fixing to partial_sold`);
              launch.status = 'partial_sold';
            }
          }
        } else if (curveState && curveState.graduated) {
          // Graduated curve — check if tokens need claiming or are already in wallet
          const curveHoldings = await this.checkCurveHoldings(row.curve_id);
          const walletBalance = await this.checkTokenBalance(row.symbol, row.precision_val);

          if (curveHoldings > 0n) {
            // Tokens still on curve — need to claim
            logger.info(`  🎓 ${launch.symbol}: graduated but ${Number(curveHoldings) / (10 ** launch.precision)} tokens unclaimed on curve — will claim`);
            launch.tokensHeld = curveHoldings;
            // Set status so monitor will process graduation
            launch.status = 'partial_sold';
          } else if (walletBalance > 0n) {
            launch.tokensHeld = walletBalance;
            launch.status = 'graduated';
          } else {
            launch.status = 'graduated';
          }
        }

        const targetsHitCount = sellTargetsHit.filter(h => h).length;
        const tokensFloat = Number(launch.tokensHeld) / (10 ** launch.precision);
        const originalFloat = Number(launch.originalTokensBought) / (10 ** launch.precision);
        logger.info(`  Restored ${launch.symbol} (curve ${launch.curveId}): ${tokensFloat.toFixed(launch.precision)} tokens (original: ${originalFloat.toFixed(launch.precision)}), status=${launch.status}, targets hit: ${targetsHitCount}/${this.config.sellTargets.length}`);

        this.trackedLaunches.set(row.curve_id, launch);
      }
    } catch (error: any) {
      logger.warn(`loadPositionsFromDB error: ${error.message}`);
    }
  }

  private logPnlSummary(): void {
    if (this.totalXprDeployed === 0) return;
    const pnl = this.totalXprReturned - this.totalXprDeployed;
    const pnlPct = (pnl / this.totalXprDeployed) * 100;
    logger.info(`🚀 Launch Sniper P&L: deployed ${this.totalXprDeployed.toFixed(4)} XPR, returned ${this.totalXprReturned.toFixed(4)} XPR, net ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} XPR (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`);
  }
}
