import fs from "node:fs";
import path from "node:path";

function readEnvFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function parseEnv(text) {
  const out = {};
  const lines = String(text ?? "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function pick(env, key) {
  const v = env[key];
  return typeof v === "string" ? v.trim() : "";
}

const repoRoot = path.resolve(process.cwd(), "..");
const envLocalPath = path.join(repoRoot, ".env.local");
const envPath = path.join(repoRoot, ".env");

const env = {
  ...parseEnv(readEnvFile(envPath)),
  ...parseEnv(readEnvFile(envLocalPath)),
  ...process.env
};

const contracts = {
  baseSepolia: pick(env, "VITE_CONTRACT_ADDRESS_BASE_SEPOLIA"),
  sepolia: pick(env, "VITE_CONTRACT_ADDRESS_SEPOLIA"),
  bscTestnet: pick(env, "VITE_CONTRACT_ADDRESS_BSC_TESTNET")
};

const studioNode = "https://api.studio.thegraph.com/deploy/";

const slugs = {
  baseSepolia: pick(env, "STUDIO_SLUG_BASE_SEPOLIA") || "social-posts-base-sepolia",
  sepolia: pick(env, "STUDIO_SLUG_ETH_SEPOLIA") || "social-posts-eth-sepolia",
  bscTestnet: pick(env, "STUDIO_SLUG_BSC_TESTNET") || "social-posts-bsc-testnet"
};

const versionLabel = pick(env, "STUDIO_VERSION_LABEL");

function header(title) {
  console.log("\n=== " + title + " ===");
}

header("Detected contract addresses (from .env/.env.local)");
console.log("Base Sepolia:", contracts.baseSepolia || "(missing)");
console.log("Ethereum Sepolia:", contracts.sepolia || "(missing)");
console.log("BSC Testnet:", contracts.bscTestnet || "(missing)");

header("1) Authenticate (one-time per machine)");
console.log("npx graph auth <DEPLOY_KEY>");

header("2) Deploy (replace <STUDIO_SUBGRAPH_SLUG> per chain)");
const versionFlag = versionLabel ? ` --version-label ${versionLabel}` : "";
console.log(`# Base Sepolia\nnpx graph deploy ${slugs.baseSepolia} subgraph.yaml --node ${studioNode}${versionFlag}`);
console.log(`# Ethereum Sepolia\nnpx graph deploy ${slugs.sepolia} subgraph.sepolia.yaml --node ${studioNode}${versionFlag}`);
console.log(`# BSC Testnet\nnpx graph deploy ${slugs.bscTestnet} subgraph.bsc-testnet.yaml --node ${studioNode}${versionFlag}`);

header("3) Frontend env vars (set these after you copy Studio Query URLs)");
console.log("VITE_BASE_SEPOLIA_SUBGRAPH_URL=<STUDIO_QUERY_URL>");
console.log("VITE_ETH_SEPOLIA_SUBGRAPH_URL=<STUDIO_QUERY_URL>");
console.log("VITE_BSC_TESTNET_SUBGRAPH_URL=<STUDIO_QUERY_URL>");

console.log("\nNotes:");
console.log("- Use the exact slug Studio shows for each subgraph.");
console.log("- Set startBlock in each manifest for faster indexing (optional but recommended).");
console.log("- If Studio rejects a manifest network identifier (especially BSC testnet), you may need a different provider for that chain.");

if (!versionLabel) {
  console.log("- Tip: set STUDIO_VERSION_LABEL=v0.0.18-testnet to deploy with an explicit version label.");
}
