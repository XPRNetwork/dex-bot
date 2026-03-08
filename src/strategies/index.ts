import { TradingStrategy, TradingStrategyConstructor } from '../interfaces/index.js';
import { GridBotStrategy } from './gridbot.js';
import { MarketMakerStrategy } from './marketmaker.js';
import { AMMDEXArbitrageStrategy } from './amm-dex-arbitrage.js';
import { ClaudeAdaptiveMMStrategy } from './claude-adaptive-mm.js';
import { CrossVenueArbitrageStrategy } from './cross-venue-arbitrage.js';

const strategiesMap = new Map<string, TradingStrategyConstructor>([
    ['gridBot', GridBotStrategy],
    ['marketMaker', MarketMakerStrategy],
    ['amm-dex-arbitrage', AMMDEXArbitrageStrategy],
    ['claude-adaptive-mm', ClaudeAdaptiveMMStrategy],
    ['cross-venue-arbitrage', CrossVenueArbitrageStrategy]
]);

export function getStrategy(name: string): TradingStrategy {
    const strategy = strategiesMap.get(name);
    if (strategy) {
        return new strategy();
    }
    throw new Error(`No strategy named ${name} found.`);
}

export function getAvailableStrategies(): string[] {
    return Array.from(strategiesMap.keys());
}

export { TradingStrategyBase } from './base.js';
export type { MarketDetails } from './base.js';
export { GridBotStrategy } from './gridbot.js';
export { MarketMakerStrategy } from './marketmaker.js';
export { AMMDEXArbitrageStrategy } from './amm-dex-arbitrage.js';
export type { ArbConfig, ArbPoolConfig } from './amm-dex-arbitrage.js';
export { ClaudeAdaptiveMMStrategy } from './claude-adaptive-mm.js';
export type { AdaptiveMMConfig, AdaptiveMMPair } from './claude-adaptive-mm.js';
export { CrossVenueArbitrageStrategy } from './cross-venue-arbitrage.js';
export type { CrossVenueConfig, ArbitragePair } from './cross-venue-arbitrage.js';
