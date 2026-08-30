# Social Blockchain Network

A social network where every post is an NFT and every reaction is a signed
transaction. Posts, likes, comments, saves, follows and tips all live on chain,
media lives on IPFS, and reads come from a subgraph rather than from the chain
directly.

**Live on testnet:** [social.edgarasneverdauskas.com](https://social.edgarasneverdauskas.com)

Deployed to three testnets — Base Sepolia, Ethereum Sepolia and BSC Testnet —
and the feed reads from all of them at once. An account holds a separate profile
on each network, because each network runs its own deployment of the contract.

## How it fits together

```
SocialPosts.sol  ──emits──▶  subgraph  ──▶  Cloudflare worker  ──▶  React app
   (per chain)              (per chain)      (proxy + cache)          │
                                                                      │
                              IPFS ◀── pinata worker ◀── media upload ─┘
```

The contract emits per-recipient events so the indexer never has to call back
into it. The workers sit in front of the subgraph and IPFS to add caching and to
keep credentials out of the browser. The frontend reads from the subgraph where
one is configured, and falls back to reading event logs over RPC — per chain, so
one network's subgraph failing does not affect the others.

Written with React + Vite, a Hardhat-based `SocialPosts` contract, and a
Graph subgraph per network.

- [docs/architecture/](docs/architecture/) — how individual features work
- [docs/feature-test-log.md](docs/feature-test-log.md) — what has been verified
  by hand against a real wallet, and what has not

Repo structure:

- Repo root: frontend (Vite)
- [contracts/](contracts/): Hardhat project (contract, tests, deploy scripts)
- [subgraph/](subgraph/): The Graph subgraph

## Local development

1. Install deps
   - `npm install`

   Install contract deps:

   - `npm run install:contracts`

2. Start a local chain
   - `npm run chain`

3. Deploy the contract to localhost
   - `npm run deploy:local`

   This writes the deployed address into the repo root `.env` as `VITE_CONTRACT_ADDRESS_LOCAL`.

4. Create `.env` (frontend)
   - If you didn't run `npm run deploy:local`, copy `.env.example` to `.env`
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

`.github/workflows/ci.yml` runs on every push and pull request:

- **Frontend** — typecheck (`tsc -b`), the test suite (`vitest`), production build
- **Workers** — typechecked against `workers/tsconfig.json`, which the frontend build does not cover
- **Contracts** — the Hardhat suite

`.github/workflows/pages.yml` separately builds `main` and deploys it to GitHub Pages.

## GitHub Pages (Actions)

To deploy via GitHub Pages:

1. In GitHub → Settings → Pages, select **GitHub Actions** as the source.
2. In GitHub → Settings → Secrets and variables → Actions, add repo variables for the `VITE_*` values you want to bake into the build (see `.env.example`).
3. Push to `main` to trigger `.github/workflows/pages.yml`.

Note: the workflow sets `VITE_BASE=/` and `public/CNAME` pins the custom domain (`social.edgarasneverdauskas.com`) so asset paths and the domain persist across Pages deploys.

## Deploying to Ethereum + Base

GitHub Pages (or any static host) can host the frontend, but the contract must be deployed to each chain separately.

### 1) Configure deploy environment

- Copy `contracts/.env.example` to `contracts/.env` (for Hardhat)
- Copy `.env.example` to `.env` (for Vite frontend config)

Set at minimum (in `contracts/.env`):

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
   - `cd workers/pinata`
   - `wrangler deploy`
2. Set the secret
   - `wrangler secret put PINATA_JWT`
3. Configure the frontend
   - Set `VITE_PINATA_WORKER_URL` in `.env.local` to your worker URL

## Media gateway worker (Cloudflare)

To reduce Pinata gateway bandwidth (and add an edge cache + a single stable gateway URL for the app), deploy the included media proxy worker:

1. Deploy the worker
   - `cd workers/media`
   - `wrangler deploy`
2. Configure origin gateways (optional)
   - Edit `workers/media/wrangler.toml` (`ORIGIN_GATEWAYS`, `ALLOW_ORIGINS`)
3. Configure the frontend gateway
   - Set `VITE_IPFS_GATEWAY` to your worker URL (example: `https://your-worker.your-domain.workers.dev/ipfs/`)

## Subgraph proxy worker (Cloudflare)

If you use The Graph Studio endpoints with low daily request limits, deploy the included subgraph proxy worker to add edge caching + basic rate limiting.

1. Deploy the worker
   - `cd workers/subgraph`
   - `wrangler deploy`
2. Configure upstream subgraphs
   - Edit `workers/subgraph/wrangler.toml` (`SUBGRAPH_*_URL`, TTLs, rate limit)
3. Configure the frontend
   - Set each `VITE_*_SUBGRAPH_URL` to the worker route you want, for example:
     - `https://your-worker.your-domain.workers.dev/base-sepolia`
     - `https://your-worker.your-domain.workers.dev/eth-sepolia`

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

Tip: use `subgraph/.env.example` as a starter for the per-network subgraph endpoints.
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



