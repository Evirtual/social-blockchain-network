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

## Production notes / readiness

This repo is set up great for demos and local development.

Before using it in production on a public network:

- **Do not ship `VITE_PINATA_JWT`**. Vite exposes all `VITE_` variables to the browser, so a Pinata JWT would be public. Use a backend or serverless function to pin files/JSON to IPFS.
- **Set a real contract address per network**. `VITE_CONTRACT_ADDRESS` should point to a deployed contract on the chain your users will connect to.
- **Review contract and wallet flows**. If real value is involved, do a security review/audit.
