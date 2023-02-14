import { TradingStrategy, TradingStrategyConstructor } from '../interfaces';
import { GridBotStrategy } from './gridbot';
import { MarketMakerStrategy } from './marketmaker';

const strategiesMap = new Map<string, TradingStrategyConstructor>([
    ['gridBot', GridBotStrategy],
    ['marketMaker', MarketMakerStrategy]
])

export function getStrategy(name: string): TradingStrategy {
    const strategy = strategiesMap.get(name);
    if(strategy){
        return new strategy();
    }
    throw new Error(`No strategy named ${name} found.`)
}
