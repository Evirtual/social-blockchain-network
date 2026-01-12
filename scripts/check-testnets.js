/* eslint-disable no-console */

// Validates testnet deploy configuration for:
// - Base Sepolia + BSC Testnet (default)
// - Base Sepolia + Ethereum Sepolia
// Reads .env via dotenv (never commit .env).

const dotenv = require("dotenv");

// Mirror Hardhat config env loading:
// - .env.hardhat for deploy secrets (override in case the shell has empty vars)
// - fallback to .env for non-secret defaults
dotenv.config({ path: ".env.hardhat", override: true });
dotenv.config();

function parseTarget(argv) {
  const arg = argv.find((a) => a.startsWith("--target="));
  const raw = arg ? arg.split("=", 2)[1]?.trim() : "base+bsc";
  if (!raw) return { wantBase: true, wantBsc: true, wantEth: false };

  if (raw === "all") return { wantBase: true, wantBsc: true, wantEth: true };

  // Allow combinations like:
  // - base+bsc
  // - base+eth
  // - base+eth+bsc (equivalent to all)
  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);

  const set = new Set(parts);
  const wantBase = set.has("base");
  const wantEth = set.has("eth") || set.has("ethereum");
  const wantBsc = set.has("bsc");

  if (!wantBase) {
    throw new Error("--target must include 'base' (this script always checks Base Sepolia)");
  }
  for (const p of set) {
    if (p !== "base" && p !== "bsc" && p !== "eth" && p !== "ethereum") {
      throw new Error(`Unknown --target part: ${p}`);
    }
  }

  return { wantBase, wantBsc, wantEth };
}

async function fetchChainId(rpcUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const hex = json?.result;
    if (typeof hex !== "string" || !hex.startsWith("0x")) {
      throw new Error("Invalid eth_chainId response");
    }
    const n = Number.parseInt(hex, 16);
    if (!Number.isFinite(n)) throw new Error("Invalid chainId number");
    return n;
  } finally {
    clearTimeout(timeout);
  }
}

function requireEnv(key) {
  const v = process.env[key];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env var: ${key}`);
  }
  return String(v).trim();
}

async function main() {
  const target = parseTarget(process.argv.slice(2));

  requireEnv("DEPLOYER_PRIVATE_KEY");
  const baseRpc = requireEnv("BASE_SEPOLIA_RPC_URL");

  const bscRpc = target.wantBsc ? requireEnv("BSC_TESTNET_RPC_URL") : null;
  const ethRpc = target.wantEth ? requireEnv("ETH_SEPOLIA_RPC_URL") : null;

  console.log("Checking RPC endpoints...");

  const checks = [
    fetchChainId(baseRpc).then((id) => ({ key: "BASE_SEPOLIA_RPC_URL", id, expected: 84532 }))
  ];
  if (bscRpc) {
    checks.push(fetchChainId(bscRpc).then((id) => ({ key: "BSC_TESTNET_RPC_URL", id, expected: 97 })));
  }
  if (ethRpc) {
    checks.push(fetchChainId(ethRpc).then((id) => ({ key: "ETH_SEPOLIA_RPC_URL", id, expected: 11155111 })));
  }

  const results = await Promise.all(checks);
  for (const r of results) {
    if (r.id !== r.expected) {
      throw new Error(`${r.key} points to chainId ${r.id} (expected ${r.expected})`);
    }
  }

  console.log("OK: env + RPCs look correct");
  for (const r of results) {
    console.log(`- ${r.key} chainId:`, r.id);
  }
}

main().catch((err) => {
  console.error("Testnet config check failed:");
  console.error(err?.message || err);
  process.exitCode = 1;
});
