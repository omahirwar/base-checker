# Base Allocation Estimator (Unofficial)

An unofficial, estimates-only Base activity dashboard built for one-click Vercel deployment. It never requests a wallet connection, signature, approval, or private key.

## Deploy on Vercel

1. Upload this folder to a Git repository.
2. Import the repository into Vercel.
3. Choose **Other** as the framework preset if it is not detected automatically.
4. Deploy with the default settings; no environment variables or build command are required.

The Vercel Function at `/api/activity` reads public address data from the Base Blockscout explorer API.

## Estimation model

- FDV choices: `$2B`, `$4B`, `$6B`, `$8B`, `$10B`, `$12B`.
- Supply assumptions: `1B`, `5B`, or `10B` hypothetical tokens.
- Airdrop pool assumptions: `2.5%`, `5%`, `10%`, `15%`, or `20%` of supply.
- Recipient assumptions: `50K`, `100K`, `200K`, `500K`, or `1M` wallets.
- Activity tier is estimated from public sampled transactions, active dates, interacted addresses, visible bridge/deposit signals, and ETH balance.
- Recommended baseline is `10B` hypothetical supply, a `5%` user pool and `500K` recipients.

Token allocation is a simulation:

```text
average tokens = (assumed supply x assumed pool percentage) / assumed recipients
model weight = smooth activity score weighting with sampled-activity detail
estimated tokens = rounded(average tokens x model weight), capped at a comparative L2 upper benchmark
estimated value (USDT) = estimated tokens x (selected FDV / assumed supply)
```

Base has not announced official tokenomics or an official claimable airdrop allocation. The app is for scenario modelling only. It uses Optimism Airdrop #1 and reported Arbitrum airdrop distribution levels only as broad calibration benchmarks, not as evidence of a Base allocation.

## Data references

- Base network documentation: <https://docs.base.org/base-chain/quickstart/connecting-to-base>
- Public Base explorer API documentation: <https://base.blockscout.com/api-docs>
- User-facing cross-check links included in the interface: <https://basescan.org/> and <https://layerhub.xyz/search?p=basetransation>
- Optimism Airdrop #1 allocation reference: <https://community.optimism.io/op-token/airdrops/airdrop-1>
