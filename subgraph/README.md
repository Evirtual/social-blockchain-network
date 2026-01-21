# SocialPosts Subgraph

This folder contains a minimal The Graph subgraph that indexes `SocialPosts` into a stable `posts` feed.

It is designed to match the frontend query used by the app:

```graphql
query FeedPosts($first: Int!) {
  posts(first: $first, orderBy: mintBlockNumber, orderDirection: desc) {
    tokenId
    author
    tokenURI
    mintTxHash
    mintBlockNumber
    mintTimestamp
    likes
    comments
    saves
    tipsWei
    burnedAtBlock
  }
}
```

## Configure

This repo is currently testing these networks, so there are three manifests:

- Base Sepolia: [subgraph.yaml](subgraph.yaml)
- Ethereum Sepolia: [subgraph.sepolia.yaml](subgraph.sepolia.yaml)
- BSC Testnet: [subgraph.bsc-testnet.yaml](subgraph.bsc-testnet.yaml)

Edit the manifest for the chain you are deploying:

- Set `network` to your chain (e.g. `base`, `base-sepolia`, `mainnet`, `sepolia`)
  - Note: the exact network string depends on your indexing provider.
- Set `source.address` to your deployed `SocialPosts` contract
- Set `startBlock` to the deployment block (recommended)

## Build

From the repo root:

- `cd subgraph`
- `npm install`

Then run one of:

- Base Sepolia: `npm run build:base-sepolia`
- Ethereum Sepolia: `npm run build:sepolia`
- BSC Testnet: `npm run build:bsc-testnet`

Tip: print the exact Studio deploy commands (based on your `.env/.env.local` addresses):

- `npm run studio:commands`

## Deploy

Deployment depends on your hosting/indexing provider:

- **The Graph Studio** (recommended for testing/staging): create a subgraph, then deploy with the Graph CLI.
- **Goldsky**: create a subgraph and deploy via their CLI.

### Deploy to Graph Studio

IMPORTANT: Always pass the manifest file (e.g. `subgraph.bsc-testnet.yaml`).

If you run `npx graph deploy <slug>` without a file, Graph CLI will default to `subgraph.yaml`.
In this repo `subgraph.yaml` is Base Sepolia, so you can accidentally deploy Base Sepolia indexing to every slug.

1) Create one subgraph per chain in https://thegraph.com/studio/ (same code, different network/address).

2) Get the deploy key from each subgraph page.

3) Authenticate (stores the key locally for the CLI):

- `npx graph auth <DEPLOY_KEY>`

4) Deploy (use the manifest for the chain):

Run these from this repo's `subgraph/` directory (do NOT `graph init` into a new folder; the subgraph is already scaffolded here):

- Base Sepolia:
  - `npx graph deploy base-sepolia subgraph.yaml --version-label v1.0.0-testnet`
- Ethereum Sepolia:
  - `npx graph deploy ethereum-sepolia subgraph.sepolia.yaml --version-label v1.0.0-testnet`
- BSC Testnet:
  - `npx graph deploy bsc-testnet subgraph.bsc-testnet.yaml --version-label v1.0.0-testnet`

If your Studio page shows a different slug, use that exact slug.

Notes:

- If Studio rejects the `network:` value in a manifest, update the `network:` field to the exact identifier Studio expects.
- BSC testnet support can vary. If Studio does not support BSC Testnet, use Goldsky or self-host Graph Node for that chain.

5) In Studio, use the "Query" button to copy the GraphQL endpoint URL.

Once deployed, set the app env var for the chain, for example:

- `VITE_BASE_SUBGRAPH_URL=<your-subgraph-graphql-endpoint>`

For the testnets in this repo:

- `VITE_BASE_SEPOLIA_SUBGRAPH_URL=<Studio query endpoint>`
- `VITE_ETH_SEPOLIA_SUBGRAPH_URL=<Studio query endpoint>`
- `VITE_BSC_TESTNET_SUBGRAPH_URL=<Studio query endpoint>`

Then the frontend feed will prefer the subgraph over RPC block scanning.
