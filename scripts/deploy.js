const hre = require("hardhat");
const { ethers } = hre;
const fs = require("node:fs");
const path = require("node:path");

function upsertEnvVar(existing, key, value) {
  const lines = (existing ?? "").split(/\r?\n/);
  const out = [];
  let replaced = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith(`${key}=`)) {
      out.push(`${key}=${value}`);
      replaced = true;
      continue;
    }
    out.push(line);
  }

  if (!replaced) out.push(`${key}=${value}`);
  return out.join("\n") + "\n";
}

async function main() {
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const SocialPosts = await ethers.getContractFactory("SocialPosts");
  const contract = await SocialPosts.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SocialPosts deployed to:", address);

  const keyByNetwork = {
    localhost: "VITE_CONTRACT_ADDRESS_LOCAL",
    hardhat: "VITE_CONTRACT_ADDRESS_LOCAL",
    ethereum: "VITE_CONTRACT_ADDRESS_ETH",
    sepolia: "VITE_CONTRACT_ADDRESS_SEPOLIA",
    base: "VITE_CONTRACT_ADDRESS_BASE",
    baseSepolia: "VITE_CONTRACT_ADDRESS_BASE_SEPOLIA",
    bsc: "VITE_CONTRACT_ADDRESS_BSC",
    bscTestnet: "VITE_CONTRACT_ADDRESS_BSC_TESTNET"
  };

  const envKey = keyByNetwork[networkName] || "VITE_CONTRACT_ADDRESS_LOCAL";

  // Local dev should not overwrite deployment config.
  // - localhost/hardhat: write to .env.local (dev-only overrides)
  // - everything else: write to .env (deploy + build-time config)
  const envFilename = networkName === "localhost" || networkName === "hardhat" ? ".env.local" : ".env";
  const envPath = path.join(process.cwd(), envFilename);
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const next = upsertEnvVar(existing, envKey, address);
  fs.writeFileSync(envPath, next, { encoding: "utf8" });
  console.log("Wrote", envPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
