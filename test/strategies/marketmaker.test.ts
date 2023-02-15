import { BigNumber } from 'bignumber.js';
import chai from 'chai';
import { MarketMakerStrategy } from '../../src/strategies/marketmaker';
import { getConfig } from '../../src/utils';

const { assert } = chai;
// const { createBuyOrder, createSellOrder } = MarketMakerStrategy;

const marketXbtcXusdt = {
  market_id: 2,
  symbol: 'XBTC_XUSDT',
  status_code: 1,
  type: 'spot',
  maker_fee: 0.001,
  taker_fee: 0.002,
  order_min: '100000',
  bid_token: {
    code: 'XBTC', precision: 8, contract: 'xtokens', multiplier: 100000000,
  },
  ask_token: {
    code: 'XUSDT', precision: 6, contract: 'xtokens', multiplier: 1000000,
  },
};
const marketXprXusdc = {
  market_id: 1,
  symbol: 'XPR_XUSDC',
  status_code: 1,
  type: 'spot',
  maker_fee: 0.001,
  taker_fee: 0.002,
  order_min: '100000',
  bid_token: {
    code: 'XPR', precision: 4, contract: 'eosio.token', multiplier: 10000,
  },
  ask_token: {
    code: 'XUSDC', precision: 6, contract: 'xtokens', multiplier: 1000000,
  },
};
const marketXprXmd = {
  market_id: 3,
  symbol: 'XPR_XMD',
  status_code: 1,
  type: 'spot',
  maker_fee: 0.001,
  taker_fee: 0.002,
  order_min: '10',
  bid_token: {
    code: 'XPR', precision: 4, contract: 'eosio.token', multiplier: 10000,
  },
  ask_token: {
    code: 'XMD', precision: 6, contract: 'xmd.token', multiplier: 1000000,
  },
};

let currentStrategy: MarketMakerStrategy;

describe('createBuyOrder', () => {
  beforeEach(() => {
    const config = getConfig();
    currentStrategy = new MarketMakerStrategy();
    currentStrategy.initialize(config.marketMaker);

  })

  it('should always create an XPR_XUSDC buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        
        highestBid: 0.3745,
        lowestAsk: 0.3925,
        market,
        price: 0.38,
      }, i);
      const total = +(new BigNumber(order.quantity)
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  xit('should always create an XPR_XMD buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 0.0456,
        lowestAsk: 0.1001,
        market,
        price: 0.1001,
      }, i);
      const total = +(new BigNumber(order.quantity)
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  // No such pair in default set
  xit('should always create an XBTC_XUSDT buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXbtcXusdt;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 18345.1234,
        lowestAsk: 18345.0111,
        market,
        price: 18345.2222,
      }, i);
      const total = +(new BigNumber(order.quantity)
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  it('should create an XPR_XUSDC buy order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const lowestAsk = 0.3925;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 0.3745,
        lowestAsk,
        market,
        price: 0.38,
      }, i);
      const price = parseFloat(order.price);
      assert.isBelow(price, lowestAsk, `buy order would execute, price:${order.price} lowestAsk: ${lowestAsk}`);
    }
  });

  xit('should create an XPR_XMD buy order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const lowestAsk = 0.1001;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 0.0456,
        lowestAsk,
        market,
        price: 0.1001,
      }, i);
      const price = parseFloat(order.price);
      assert.isBelow(price, lowestAsk, `buy order would execute, price:${order.price} lowestAsk: ${lowestAsk}`);
    }
  });
  
  // No such pair in default set
  xit('should create an XBTC_XUSDT buy order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const lowestAsk = 18345.0111;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 18345.1234,
        lowestAsk,
        market,
        price: 18345.2222,
      }, i);
      const price = parseFloat(order.price);
      assert.isBelow(price, lowestAsk, `buy order would execute, price:${order.price} lowestAsk: ${lowestAsk}`);
    }
  });
});

describe('createSellOrder', () => {
  it('should always create an XPR_XUSDC sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const order = (currentStrategy as any).createBuyOrder(market.symbol, {
        highestBid: 0.3745,
        lowestAsk: 0.3925,
        market,
        price: 0.38,
      }, i);
      const total = +(new BigNumber(order.price)
        .times(new BigNumber(order.quantity))
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  xit('should always create an XPR_XMD sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const order = (currentStrategy as any).createSellOrder(market.symbol, {
        highestBid: 0.3745,
        lowestAsk: 0.3925,
        market,
        price: 0.38,
      }, i);
      const total = +(new BigNumber(order.price)
        .times(new BigNumber(order.quantity))
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  xit('should always create an XBTC_XUSDC sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXbtcXusdt;
      const order = (currentStrategy as any).createSellOrder(market.symbol, {
        highestBid: 18345.1234,
        lowestAsk: 18345.0111,
        market,
        price: 18345.2222,
      }, i);
      const total = +(new BigNumber(order.price)
        .times(new BigNumber(order.quantity))
        .times(new BigNumber(market.ask_token.multiplier)));
      const orderMin = parseInt(market.order_min, 10);
      assert.isAtLeast(total, orderMin, `total: ${total}, orderMin: ${orderMin}`);
    }
  });

  it('should create an XPR_XUSDC sell order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const highestBid = 0.3745;
      const order = (currentStrategy as any).createSellOrder(market.symbol, {
        highestBid,
        lowestAsk: 0.3925,
        market,
        price: 0.38,
      }, i);
      const price = parseFloat(order.price);
      assert.isAbove(price, highestBid, `sell order would execute, price:${order.price} lowestAsk: ${highestBid}`);
    }
  });

  xit('should create an XPR_XMD sell order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const highestBid = 0.0456;
      const order = (currentStrategy as any).createSellOrder(market.symbol, {
        highestBid,
        lowestAsk: 0.1001,
        market,
        price: 0.1001,
      }, i);
      const price = parseFloat(order.price);
      assert.isAbove(price, highestBid, `sell order would execute, price:${order.price} lowestAsk: ${highestBid}`);
    }
  });

  xit('should create an XBTC_XUSDT sell order that will succeed as a postonly order', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const highestBid = 18345.1234;
      const order = (currentStrategy as any).createSellOrder(market.symbol, {
        highestBid,
        lowestAsk: 18345.0111,
        market,
        price: 18345.2222,
      }, i);
      const price = parseFloat(order.price);
      assert.isAbove(price, highestBid, `sell order would execute, price:${order.price} lowestAsk: ${highestBid}`);
    }
  });
});
