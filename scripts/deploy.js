const { ethers } = require("hardhat");
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
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const SocialPosts = await ethers.getContractFactory("SocialPosts");
  const contract = await SocialPosts.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SocialPosts deployed to:", address);

  const envPath = path.join(process.cwd(), ".env.local");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const next = upsertEnvVar(existing, "VITE_CONTRACT_ADDRESS", address);
  fs.writeFileSync(envPath, next, { encoding: "utf8" });
  console.log("Wrote", envPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
