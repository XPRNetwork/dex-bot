import { BigNumber } from 'bignumber.js';
import chai from 'chai';
import strategy from '../../strategies/marketmaker.js';

const { assert } = chai;
const { createBuyOrder, createSellOrder } = strategy.internals;

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

describe('createBuyOrder', () => {
  it('should always create an XPR_XUSDC buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const order = createBuyOrder({
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

  it('should always create an XPR_XMD buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const order = createBuyOrder({
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

  it('should always create an XBTC_XUSDT buy order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXbtcXusdt;
      const order = createBuyOrder({
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
});

describe('createSellOrder', () => {
  it('should always create an XPR_XUSDC sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXusdc;
      const order = createSellOrder({
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

  it('should always create an XPR_XMD sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXprXmd;
      const order = createSellOrder({
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

  it('should always create an XBTC_XUSDC sell order that is at least the order_min value', () => {
    for (let i = 0; i < 10; i += 1) {
      const market = marketXbtcXusdt;
      const order = createSellOrder({
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
});
