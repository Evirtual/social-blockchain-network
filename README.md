# Social Blockchain Network

A React + Vite frontend with a Hardhat-based `SocialPosts` contract.

## Local development

1. Install deps
   - `npm install`

2. Start a local chain
   - `npm run chain`

3. Deploy the contract to localhost
   - `npm run deploy:local`

4. Create `.env.local`
   - Copy from `.env.example`
   - Set `VITE_CONTRACT_ADDRESS` to the deployed address

5. Start the frontend
   - `npm run dev`

## Deploying to Base + BSC

GitHub Pages (or any static host) can host the frontend, but the contract must be deployed to each chain separately.

### 1) Configure deploy environment

- Copy `.env.example` to `.env` (for Hardhat)
- Copy `.env.example` to `.env.local` (for Vite) if you want to run the frontend locally

Set at minimum:

- `DEPLOYER_PRIVATE_KEY` (no `0x` prefix)
- RPC URLs:
   - `BASE_RPC_URL`
   - `BSC_RPC_URL`

### 2) Deploy

- Base mainnet:
   - `npm run deploy:base`
- BSC mainnet:
   - `npm run deploy:bsc`

Each deploy writes the resulting address into `.env.local` using a chain-specific key:

- `VITE_CONTRACT_ADDRESS_BASE` for Base (chainId 8453)
- `VITE_CONTRACT_ADDRESS_BSC` for BSC (chainId 56)

The frontend will automatically select the correct address based on the user’s connected network.

## Production notes / readiness

This repo is set up great for demos and local development.

Before using it in production on a public network:

- **Do not ship `VITE_PINATA_JWT`**. Vite exposes all `VITE_` variables to the browser, so a Pinata JWT would be public. Use a backend or serverless function to pin files/JSON to IPFS.
- **Set a real contract address per network**. Prefer `VITE_CONTRACT_ADDRESS_BASE` (Base) and `VITE_CONTRACT_ADDRESS_BSC` (BSC). `VITE_CONTRACT_ADDRESS` remains as a legacy single-network fallback.
- **Review contract and wallet flows**. If real value is involved, do a security review/audit.
