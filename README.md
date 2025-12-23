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

## Testing

### Contracts (Hardhat)

- Run contract tests:
   - `npm run test:contracts`

### Frontend (Vitest)

- Run frontend unit tests:
   - `npm run test:frontend`

### Run everything

- Run both contract + frontend tests:
   - `npm test`

## CI

GitHub Actions runs on every PR and push to `main`:

- Contract tests
- Frontend tests
- Production build

## Deploying to Ethereum + Base

GitHub Pages (or any static host) can host the frontend, but the contract must be deployed to each chain separately.

### 1) Configure deploy environment

- Copy `.env.example` to `.env` (for Hardhat)
- Copy `.env.example` to `.env.local` (for Vite) if you want to run the frontend locally

Set at minimum:

- `DEPLOYER_PRIVATE_KEY` (no `0x` prefix)
- RPC URLs:
   - `ETH_RPC_URL`
   - `BASE_RPC_URL`

### 2) Deploy

- Ethereum mainnet:
   - `npm run deploy:eth`
- Base mainnet:
   - `npm run deploy:base`

Testnets:

- Ethereum Sepolia:
   - `npm run deploy:sepolia`
- Base Sepolia:
   - `npm run deploy:base:sepolia`

Deploy both Sepolia networks (with a preflight RPC/chainId check):

- `npm run deploy:sepolias`

Optional: BSC is also supported, and you can deploy Base Sepolia + BSC Testnet via:

- `npm run deploy:testnets`

Each deploy writes the resulting address into `.env` using a chain-specific key:

- `VITE_CONTRACT_ADDRESS_ETH` for Ethereum (chainId 1)
- `VITE_CONTRACT_ADDRESS_SEPOLIA` for Ethereum Sepolia (chainId 11155111)
- `VITE_CONTRACT_ADDRESS_BASE` for Base (chainId 8453)
- `VITE_CONTRACT_ADDRESS_BSC` for BSC (chainId 56)

The frontend will automatically select the correct address based on the user’s connected network.

## Production notes / readiness

This repo is set up great for demos and local development.

Before using it in production on a public network:

- **Do not ship `VITE_PINATA_JWT`**. Vite exposes all `VITE_` variables to the browser, so a Pinata JWT would be public. Use a backend or serverless function to pin files/JSON to IPFS.
- **Set a real contract address per network**. Prefer `VITE_CONTRACT_ADDRESS_BASE` (Base) and `VITE_CONTRACT_ADDRESS_BSC` (BSC). `VITE_CONTRACT_ADDRESS` remains as a legacy single-network fallback.
- **Review contract and wallet flows**. If real value is involved, do a security review/audit.
