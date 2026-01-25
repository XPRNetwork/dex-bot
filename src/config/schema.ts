import { z } from 'zod';

/**
 * GridBot pair configuration schema
 */
export const GridBotPairSchema = z.object({
  symbol: z.string(),
  upperLimit: z.union([z.number(), z.string()]).transform(v => Number(v)),
  lowerLimit: z.union([z.number(), z.string()]).transform(v => Number(v)),
  gridLevels: z.union([z.number(), z.string()]).transform(v => Number(v)),
  bidAmountPerLevel: z.union([z.number(), z.string()]).transform(v => Number(v))
});

/**
 * MarketMaker pair configuration schema
 */
export const MarketMakerPairSchema = z.object({
  symbol: z.string(),
  gridLevels: z.number(),
  gridInterval: z.number(),
  base: z.number(),
  orderSide: z.number(),
  bidAmountPerLevel: z.number()
});

/**
 * Adaptive Market Maker pair configuration schema
 */
export const AdaptiveMMPairSchema = z.object({
  symbol: z.string(),
  bidAmountPerLevel: z.number().positive(),
  baseSpreadBps: z.number().optional(),
  maxPositionUSD: z.number().optional(),
  enabled: z.boolean().default(true)
});

/**
 * Arbitrage pool configuration schema
 */
export const ArbitragePoolSchema = z.object({
  poolSymbol: z.string(),
  dexMarketSymbol: z.string(),
  baseToken: z.string(),
  quoteToken: z.string(),
  enabled: z.boolean().default(true)
});

/**
 * RPC configuration schema
 */
export const RPCConfigSchema = z.object({
  privateKeyPermission: z.string().default('active'),
  endpoints: z.array(z.string()).min(1),
  apiRoot: z.string().url(),
  lightApiRoot: z.string().url(),
  privateKey: z.string()
});

/**
 * Persistence configuration schema
 */
export const PersistenceConfigSchema = z.object({
  type: z.enum(['sqlite']).default('sqlite'),
  path: z.string().default('./data/dex-bot.db')
});

/**
 * Risk configuration schema
 */
export const RiskConfigSchema = z.object({
  maxPositionUSD: z.number().positive().default(10000),
  maxTotalExposureUSD: z.number().positive().default(50000),
  maxPositionPercent: z.number().min(0).max(100).default(20),
  minOrderSizeUSD: z.number().nonnegative().default(1),
  maxOrdersPerMinute: z.number().positive().default(60),
  maxDrawdownPercent: z.number().min(0).max(100).default(5),
  dailyLossLimitUSD: z.number().positive().default(1000),
  consecutiveLossLimit: z.number().positive().default(10),
  circuitBreakerEnabled: z.boolean().default(true),
  cooldownMinutes: z.number().positive().default(60),
  autoReset: z.boolean().default(false)
});

/**
 * Claude AI configuration schema
 */
export const ClaudeConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default('claude-sonnet-4-20250514'),
  analysisIntervalMS: z.number().positive().default(60000),
  maxTokens: z.number().positive().default(1024),
  temperature: z.number().min(0).max(1).default(0.3),
  enabled: z.boolean().default(true)
});

/**
 * Arbitrage configuration schema
 */
export const ArbitrageConfigSchema = z.object({
  minProfitBPS: z.number().nonnegative().default(10),
  maxTradeSizeUSD: z.number().positive().default(1000),
  checkIntervalMS: z.number().positive().default(5000),
  pools: z.array(ArbitragePoolSchema).default([]),
  dryRun: z.boolean().default(false),
  enabled: z.boolean().default(true)
});

/**
 * Claude Adaptive Market Maker configuration schema
 */
export const ClaudeAdaptiveMMConfigSchema = z.object({
  pairs: z.array(AdaptiveMMPairSchema).default([]),
  analysisIntervalMS: z.number().positive().default(60000),
  orderRefreshMS: z.number().positive().default(30000),
  baseSpreadBps: z.number().positive().default(50),
  targetInventoryRatio: z.number().min(0).max(1).default(0.5),
  maxPositionUSD: z.number().positive().default(10000),
  gridLevels: z.number().positive().default(3),
  enabled: z.boolean().default(true)
});

/**
 * Strategy configuration schema
 */
export const StrategyConfigSchema = z.object({
  name: z.enum(['gridBot', 'marketMaker', 'amm-dex-arbitrage', 'claude-adaptive-mm']),
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(1).optional()
});

/**
 * Monitoring configuration schema
 */
export const MonitoringConfigSchema = z.object({
  healthCheckIntervalMS: z.number().positive().default(30000),
  metricsEnabled: z.boolean().default(true),
  prometheusPort: z.number().positive().optional(),
  alerting: z.object({
    slackEnabled: z.boolean().default(false),
    slackWebhookUrl: z.string().optional(),
    discordEnabled: z.boolean().default(false),
    discordWebhookUrl: z.string().optional(),
    telegramEnabled: z.boolean().default(false),
    telegramBotToken: z.string().optional(),
    telegramChatId: z.string().optional()
  }).optional()
});

/**
 * Complete bot configuration schema
 */
export const BotConfigSchema = z.object({
  // Existing fields
  tradeIntervalMS: z.union([z.number(), z.string()]).transform(v => Number(v)).default(10000),
  slackIntervalMS: z.union([z.number(), z.string()]).transform(v => Number(v)).default(1000000),
  slackBotToken: z.string().optional().default(''),
  channelId: z.string().optional().default(''),
  cancelOpenOrdersOnExit: z.boolean().default(true),
  gridPlacement: z.boolean().default(true),
  strategy: z.enum(['gridBot', 'marketMaker', 'amm-dex-arbitrage', 'claude-adaptive-mm']).default('gridBot'),
  username: z.string(),

  // Existing strategy configs
  marketMaker: z.object({
    pairs: z.array(MarketMakerPairSchema).default([])
  }).optional(),
  gridBot: z.object({
    pairs: z.array(GridBotPairSchema).default([])
  }).optional(),

  // RPC config
  rpc: RPCConfigSchema,

  // NEW: Extended configuration
  persistence: PersistenceConfigSchema.optional(),
  risk: RiskConfigSchema.optional(),
  claude: ClaudeConfigSchema.optional(),
  arbitrage: ArbitrageConfigSchema.optional(),
  claudeAdaptiveMM: ClaudeAdaptiveMMConfigSchema.optional(),
  monitoring: MonitoringConfigSchema.optional(),

  // Multi-strategy support
  strategies: z.array(StrategyConfigSchema).optional()
});

// Type exports
export type GridBotPair = z.infer<typeof GridBotPairSchema>;
export type MarketMakerPair = z.infer<typeof MarketMakerPairSchema>;
export type AdaptiveMMPair = z.infer<typeof AdaptiveMMPairSchema>;
export type ArbitragePool = z.infer<typeof ArbitragePoolSchema>;
export type RPCConfig = z.infer<typeof RPCConfigSchema>;
export type PersistenceConfig = z.infer<typeof PersistenceConfigSchema>;
export type RiskConfig = z.infer<typeof RiskConfigSchema>;
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
export type ArbitrageConfig = z.infer<typeof ArbitrageConfigSchema>;
export type ClaudeAdaptiveMMConfig = z.infer<typeof ClaudeAdaptiveMMConfigSchema>;
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type BotConfig = z.infer<typeof BotConfigSchema>;

/**
 * Validate and parse bot configuration
 */
export function validateConfig(config: unknown): BotConfig {
  return BotConfigSchema.parse(config);
}

/**
 * Validate configuration with partial data (for updates)
 */
export function validatePartialConfig(config: unknown): Partial<BotConfig> {
  return BotConfigSchema.partial().parse(config);
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Partial<BotConfig> {
  return {
    tradeIntervalMS: 10000,
    slackIntervalMS: 1000000,
    slackBotToken: '',
    channelId: '',
    cancelOpenOrdersOnExit: true,
    gridPlacement: true,
    strategy: 'gridBot',
    persistence: {
      type: 'sqlite',
      path: './data/dex-bot.db'
    },
    risk: {
      maxPositionUSD: 10000,
      maxTotalExposureUSD: 50000,
      maxPositionPercent: 20,
      minOrderSizeUSD: 1,
      maxOrdersPerMinute: 60,
      maxDrawdownPercent: 5,
      dailyLossLimitUSD: 1000,
      consecutiveLossLimit: 10,
      circuitBreakerEnabled: true,
      cooldownMinutes: 60,
      autoReset: false
    },
    claude: {
      model: 'claude-sonnet-4-20250514',
      analysisIntervalMS: 60000,
      maxTokens: 1024,
      temperature: 0.3,
      enabled: true
    },
    arbitrage: {
      minProfitBPS: 10,
      maxTradeSizeUSD: 1000,
      checkIntervalMS: 5000,
      pools: [],
      dryRun: false,
      enabled: true
    }
  };
}
