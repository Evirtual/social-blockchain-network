import { ethers } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const SocialPosts = await ethers.getContractFactory("SocialPosts");
  const contract = await SocialPosts.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SocialPosts deployed to:", address);

  // Write contract address for Vite
  const envPath = path.join(process.cwd(), ".env.local");
  const content = `VITE_CONTRACT_ADDRESS=${address}\n`;
  fs.writeFileSync(envPath, content, { encoding: "utf8" });
  console.log("Wrote", envPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
