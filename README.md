# Social Blockchain Network

A React + Vite frontend with a Hardhat-based `SocialPosts` contract.

## Local development

1. Install deps
   - `npm install`

2. Start a local chain
   - `npm run chain`

3. Deploy the contract to localhost
   - `npm run deploy:local`

   This writes the deployed address into `.env.local` as `VITE_CONTRACT_ADDRESS_LOCAL`.

4. Create `.env.local`
   - If you didn't run `npm run deploy:local`, copy `.env.example` to `.env.local`
   - Set the per-network vars (recommended)

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

- Production build (`npm run build`)

## GitHub Pages (Actions)

To deploy via GitHub Pages:

1. In GitHub → Settings → Pages, select **GitHub Actions** as the source.
2. In GitHub → Settings → Secrets and variables → Actions, add repo variables for the `VITE_*` values you want to bake into the build (see `.env.example`).
3. Push to `main` to trigger `.github/workflows/pages.yml`.

Note: the workflow sets `VITE_BASE=/<repo>/` so asset paths work on Pages.

## Deploying to Ethereum + Base

GitHub Pages (or any static host) can host the frontend, but the contract must be deployed to each chain separately.

### 1) Configure deploy environment

- Copy `.env.hardhat.example` to `.env.hardhat` (for Hardhat)
- Copy `.env.example` to `.env.local` (for Vite) if you want to run the frontend locally

Set at minimum (in `.env.hardhat`):

- `DEPLOYER_PRIVATE_KEY` (no `0x` prefix)
- RPC URLs:
   - `ETH_RPC_URL`
   - `BASE_RPC_URL`

Optional (recommended): also configure the chain-specific testnet RPC URLs from `.env.example`.

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

Deploy a set of supported testnets (with a preflight RPC/chainId check):

- `npm run deploy:testnets`

Optional: BSC is also supported, and you can deploy Base Sepolia + BSC Testnet via:

- `npm run deploy:testnets`

Each deploy writes the resulting address into `.env` using a chain-specific key:

- `VITE_CONTRACT_ADDRESS_ETH` for Ethereum (chainId 1)
- `VITE_CONTRACT_ADDRESS_SEPOLIA` for Ethereum Sepolia (chainId 11155111)
- `VITE_CONTRACT_ADDRESS_BASE` for Base (chainId 8453)
- `VITE_CONTRACT_ADDRESS_BSC` for BSC (chainId 56)
- `VITE_CONTRACT_ADDRESS_BASE_SEPOLIA` for Base Sepolia (chainId 84532)
- `VITE_CONTRACT_ADDRESS_BSC_TESTNET` for BSC Testnet (chainId 97)
- `VITE_CONTRACT_ADDRESS_LOCAL` for Hardhat/local (chainId 31337)

The frontend will automatically select the correct address based on the user's connected network.

## Pinata worker (Cloudflare)

To avoid exposing a Pinata JWT in the browser, run the included Cloudflare Worker:

1. Deploy the worker
   - `cd worker/pinata`
   - `wrangler deploy`
2. Set the secret
   - `wrangler secret put PINATA_JWT`
3. Configure the frontend
   - Set `VITE_PINATA_WORKER_URL` in `.env.local` to your worker URL

## Frontend environment variables

See `.env.example` for the full list. Common ones:

- Contract address selection:
   - `VITE_CONTRACT_ADDRESS_<NETWORK>` (recommended multi-network)
- Optional multi-network feed reads (browser-side, must be CORS-enabled):
   - `VITE_<NETWORK>_RPC_URL` (e.g. `VITE_BASE_RPC_URL`)
- Optional WebSocket RPC endpoints (enable event-driven refresh without polling):
   - `VITE_<NETWORK>_RPC_WS_URL` (e.g. `VITE_BASE_RPC_WS_URL`)
- Optional The Graph subgraph feeds (recommended for stability on long-lived networks):
   - `VITE_<NETWORK>_SUBGRAPH_URL` (e.g. `VITE_BASE_SUBGRAPH_URL`)
   - Use Subgraph Studio for testing/staging; publish to The Graph Network to appear in Graph Explorer.
- Explorer base URLs for transaction links:
   - `VITE_ETH_EXPLORER_BASE_URL`
   - `VITE_ETH_SEPOLIA_EXPLORER_BASE_URL`
   - `VITE_BASE_EXPLORER_BASE_URL`
   - `VITE_BASE_SEPOLIA_EXPLORER_BASE_URL`
   - `VITE_BSC_EXPLORER_BASE_URL`
   - `VITE_BSC_TESTNET_EXPLORER_BASE_URL`
- Optional subgraph request logging:
   - `VITE_SUBGRAPH_LOG=true`
   - `VITE_SUBGRAPH_LOG_SUMMARY_EVERY` (default 25)

Tip: use `.env.subgraph.example` as a starter for the per-network subgraph endpoints.
- Optional IPFS gateway override:
   - `VITE_IPFS_GATEWAY` (e.g. `https://gateway.pinata.cloud/ipfs/`)
- Optional Pinata worker (recommended for production uploads):
   - `VITE_PINATA_WORKER_URL` (e.g. `https://your-worker.your-domain.workers.dev`)

## Production notes / readiness

This repo is set up great for demos and local development.

Before using it in production on a public network:

- **Do not ship `VITE_PINATA_JWT`**. Vite exposes all `VITE_` variables to the browser. Use a backend/worker to pin files/JSON to IPFS.
- **Set a real contract address per network**. Prefer `VITE_CONTRACT_ADDRESS_BASE` (Base) and `VITE_CONTRACT_ADDRESS_BSC` (BSC).
- **Review contract and wallet flows**. If real value is involved, do a security review/audit.



