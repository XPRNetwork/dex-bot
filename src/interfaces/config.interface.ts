export interface GridBotPair {
    symbol: string;
    upperLimit: number;
    lowerLimit: number;
    gridLevels: number;
    bidAmountPerLevel: number;
}

export interface GridBotPairRaw extends Omit<GridBotPair, 'upperLimit' | 'lowerLimit' | 'gridLevels' | 'bidAmountPerLevel'>{
    upperLimit: number | string;
    lowerLimit: number | string;
    gridLevels: number | string;
    bidAmountPerLevel: number | string;
}

export interface MarketMakerPair {
    symbol: string;
    gridLevels: number;
    gridInterval: number;
    base: number;
    orderSide: number;
}

export interface BotConfig {
    tradeIntervalMS: number;
    cancelOpenOrdersOnExit: boolean;
    strategy: 'gridBot' | 'marketMaker';
    marketMaker: {
        pairs: MarketMakerPair[];
    };
    gridBot: {
        pairs: GridBotPairRaw[]
    };
    rpc: {
        privateKeyPermission: string;
        endpoints : string[];
        apiRoot: string;
        lightApiRoot: string;
        privateKey: string;
    };
    username: string;
}