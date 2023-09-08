import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployCSXToken from "./deploy/1_CSXToken.deploy";

const contractNames = [
  "csxToken",
  "stakedCSX",
  "escrowedCSX",
  "usdc",
  "usdt",
  "weth",
  "vestedCSX",
  "keepers",
  "users",
  "userProfileLevel",
  "referralRegistry",
  "tradeFactoryBaseStorage",
  "buyAssistoor",
  "tradeFactory",
];

const main = async () => {
  const hre: HardhatRuntimeEnvironment = await import("hardhat");
  const addressMap: Map<string, string> = new Map();

  // Deploy CSX Token
  addressMap.set("csxToken", await deployCSXToken(hre));

  // Deploy other contracts as needed
  // ...

  // Logging contract addresses
  contractNames.forEach((contractName) => {
    console.log(`${contractName.padEnd(24)} ${addressMap.get(contractName)}`);
  });
};

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
