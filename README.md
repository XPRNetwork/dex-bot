# dexbot

This is code for a basic trading bot against the Proton DEX, https://protondex.com/.

## Getting Started

### prerequisites
- a proton account (https://www.proton.org/wallet/)
- enough funds in your account in the markets that you want to trade in

### run the code
1. `npm install`
1. update config in dexrpc.js to use your own username and private key
1. edit the main method in index.js to include the action you want to try
1. `npm run bot`

### coding references
- basics for a simple limit order placement, including signing: https://www.docs.protondex.com/developers-dex/submit-dex-order
- instructions on finding your private key: https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
- actions available on the DEX contract: https://www.docs.protondex.com/developers-dex/actions
- general documentation on interacting with proton contracts: https://docs.protonchain.com/built-with-proton.html#sdks

## Current capabilities

### Markets
- fetchMarkets - retrieves all markets that exist on the proton dex

### Orders
- cancelOrder - cancel a single order
- cancelAllOrders - cancel all orders for a user one by one (not in bulk)
- fetchOpenOrders - retrieve all open orders for a given user
- submitLimitOrder - submit a buy or sell limit order to the dex in postonly mode (ensure it is a maker trade)

