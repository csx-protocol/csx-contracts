import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";
dotenv.config();

const privateKeyDev = process.env.HEXKEY!;
const RPC_URL_ARB_SEPOLIA = process.env.RPCURL_ARB_SEPOLIA!;

const config: HardhatUserConfig = {
  mocha: {
    timeout: 888888888888, // 28 years should be enough
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    ganache: {
      url: "http://127.0.0.1:7545", // Localhost (default: none)
      // accounts: {
      //   mnemonic: "test test test test test test test test test test test junk" // Replace with your Ganache mnemonic or private key
      // },
      // gas: 8721974,
      chainId: 1337,
    },
    arbitrumSepolia: {
      url: RPC_URL_ARB_SEPOLIA,
      accounts: [privateKeyDev],
    },
  },
  etherscan: {
    apiKey: {
      arbitrumSepolia: process.env.ARBSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
    ]
  },
  sourcify: {
    enabled: true,
  },
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 300,
      },
      // evmVersion: "paris"
    },
  },
};

export default config;

// Network name
// Arbitrum Sepolia Testnet
// Network URL
// https://sepolia-rollup.arbitrum.io/rpc
// Chain ID
// 421614
// Currency symbol
// ETH
// Block explorer URL
// https://sepolia.arbiscan.io/
