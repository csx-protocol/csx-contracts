import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from 'dotenv';
dotenv.config();

const privateKeyDev = process.env.HEXKEY!;
const rpcLink = process.env.RPCURL!;

const config: HardhatUserConfig = {
  mocha: {
    timeout: 888888888888 // 28 years should be enough
  },
  defaultNetwork: "hardhat",  
  networks: {
    hardhat: {
    },
    ganache: {
      url: "http://127.0.0.1:7545",  // Localhost (default: none)
      // accounts: {
      //   mnemonic: "test test test test test test test test test test test junk" // Replace with your Ganache mnemonic or private key
      // },
      // gas: 8721974,
      chainId: 1337,
    },
    goerli: {
      url: rpcLink,
      accounts: [privateKeyDev],
      chainId: 421613,
    }
  },
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 300
      },
      // evmVersion: "byzantium"
    }
  }
};

export default config;
