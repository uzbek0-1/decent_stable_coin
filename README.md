# Decentralized Stablecoin (DSC)

A minimal, overcollateralized decentralized stablecoin, built with Hardhat + Solidity 0.8.20.
This follows the well-known "Foundry DeFi Stablecoin" tutorial pattern (Cyfrin/Patrick Collins),
reimplemented here with Hardhat tooling.

## How it works

- **`DecentralizedStableCoin.sol`** — the ERC20 token (`DSC`). Mint/burn are restricted to
  its owner, which is set to `DSCEngine` after deployment.
- **`DSCEngine.sol`** — all the actual logic:
  - Deposit approved collateral (WETH / WBTC in this setup).
  - Mint DSC against your collateral, as long as you stay **≥ 200% collateralized**
    (health factor ≥ 1).
  - Redeem collateral / burn DSC to unwind your position.
  - **Liquidate** any user whose health factor drops below 1 — the liquidator repays
    the user's debt and receives their collateral plus a 10% bonus.
- **`OracleLib.sol`** — wraps Chainlink price feed calls and reverts if the price hasn't
  been updated in over 3 hours (stale-price protection).
- Peg target: **1 DSC ≈ $1 USD**, maintained algorithmically (no fiat reserve — just
  collateral + liquidations), same as MakerDAO's original design in miniature.

**Core invariant:** total USD value of collateral in `DSCEngine` must always be
≥ total USD value of DSC in circulation. The test suite includes checks for this.

## Quickstart

```bash
nvm use          # or just make sure you're on Node 18+
npm install
npm test
```

> Note: the first `npx hardhat compile` needs internet access to download the
> Solidity compiler binary (`binaries.soliditylang.org`). If you're behind a
> restrictive proxy/firewall, allow that host or `npm install solc` and compile
> via solc-js directly.

## Local deploy

In-process Hardhat network (spins up, deploys, and tears down in one command):

```bash
npm run deploy:hardhat
```

Or against a persistent local node (useful if you want to interact with contracts
afterward, e.g. via a frontend or Hardhat console):

```bash
npx hardhat node
# in a second terminal:
npm run deploy:local
```

On local/hardhat networks, the deploy script automatically deploys `MockV3Aggregator`
price feeds (seeded at $2000/ETH and $60000/BTC) and `ERC20Mock` tokens standing in
for WETH/WBTC, so you don't need real testnet assets to try it out.

## Sepolia deploy

1. Copy `.env.example` to `.env` and fill in:
   ```
   SEPOLIA_RPC_URL=...
   PRIVATE_KEY=...
   ETHERSCAN_API_KEY=...
   ```
2. Run:
   ```bash
   npm run deploy:sepolia
   ```
   This uses real Chainlink ETH/USD and BTC/USD feeds on Sepolia (addresses in
   `helper-hardhat-config.js`).

⚠️ **Never commit `.env` or put a real private key in it if that key holds
mainnet funds.** Use a burner wallet for testnets.

## Tests

```bash
npm test
```

Covers: collateral valuation via price feeds, deposit + mint, health-factor
enforcement (reverts on undercollateralized mints), redeem-for-DSC, and a full
liquidation scenario after simulating a price crash.

## Security notes (read before using this for anything real)

This is an educational/reference implementation, not audited:
- No governance, no fees, no stability pool — just the core mint/burn/liquidate loop.
- Liquidations require the liquidator to already hold enough DSC to cover the debt
  they're repaying (no flash-loan-friendly liquidation path included here).
- The 3-hour staleness window in `OracleLib` is a judgment call — tune it to your
  actual feed's heartbeat.
- Do not deploy to mainnet with real value without a professional audit.
