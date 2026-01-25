import { TradingStrategy, TradingStrategyConstructor } from '../interfaces/index.js';
import { GridBotStrategy } from './gridbot.js';
import { MarketMakerStrategy } from './marketmaker.js';
import { AMMDEXArbitrageStrategy } from './amm-dex-arbitrage.js';
import { ClaudeAdaptiveMMStrategy } from './claude-adaptive-mm.js';

const strategiesMap = new Map<string, TradingStrategyConstructor>([
    ['gridBot', GridBotStrategy],
    ['marketMaker', MarketMakerStrategy],
    ['amm-dex-arbitrage', AMMDEXArbitrageStrategy],
    ['claude-adaptive-mm', ClaudeAdaptiveMMStrategy]
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

export { TradingStrategyBase, MarketDetails } from './base.js';
export { GridBotStrategy } from './gridbot.js';
export { MarketMakerStrategy } from './marketmaker.js';
export { AMMDEXArbitrageStrategy, ArbConfig, ArbPoolConfig } from './amm-dex-arbitrage.js';
export { ClaudeAdaptiveMMStrategy, AdaptiveMMConfig, AdaptiveMMPair } from './claude-adaptive-mm.js';
