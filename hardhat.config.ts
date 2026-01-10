import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.hardhat" });
dotenv.config();

function normalizePrivateKey(maybePk: string | undefined) {
  const pk = (maybePk ?? "").trim();
  if (!pk) return undefined;

  const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      "Invalid DEPLOYER_PRIVATE_KEY. Expected 64 hex chars (with or without 0x prefix)."
    );
  }

  return normalized;
}

function accounts() {
  const pk = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
  return pk ? [pk] : [];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    ethereum: {
      url: process.env.ETH_RPC_URL || "",
      accounts: accounts()
    },
    sepolia: {
      url: process.env.ETH_SEPOLIA_RPC_URL || "",
      accounts: accounts()
    },
    base: {
      url: process.env.BASE_RPC_URL || "",
      accounts: accounts()
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts: accounts()
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "",
      accounts: accounts()
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "",
      accounts: accounts()
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  }
};

export default config;
