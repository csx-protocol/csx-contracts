import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployCSXToken from "./deploy/1_CSXToken.deploy";
import deployStakedCSX from "./deploy/2_StakedCSX.deploy";
import deployEscrowedCSX from "./deploy/3_EscrowedCSX.deploy";
import deployVestedCSX from "./deploy/4_VestedCSX.deploy";
import deployKeepers from "./deploy/5_Keepers.deploy";

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

  // Deploy Staked CSX
  const [stakedCSX, wethAddress, usdcAddress, usdtAddress] = await deployStakedCSX(hre, addressMap.get("csxToken")!);
  addressMap.set("stakedCSX", stakedCSX);
  addressMap.set("weth", wethAddress);
  addressMap.set("usdc", usdcAddress);
  addressMap.set("usdt", usdtAddress);
  
  // Deploy Escrowed CSX
  addressMap.set("escrowedCSX", await deployEscrowedCSX(hre, addressMap.get("csxToken")!));

  // Deploy VestedCSX
  addressMap.set("vestedCSX", await deployVestedCSX(
    hre,
    addressMap.get("escrowedCSX")!,
    addressMap.get("stakedCSX")!,
    addressMap.get("weth")!,
    addressMap.get("usdc")!,
    addressMap.get("csxToken")!,
    addressMap.get("usdt")!
  ));

  // Deploy Keepers contract
  addressMap.set("keepers", await deployKeepers(hre)); 


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
