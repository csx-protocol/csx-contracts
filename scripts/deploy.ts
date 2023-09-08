import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployCSXToken from "./deploy/1_CSXToken.deploy";
import deployStakedCSX from "./deploy/2_StakedCSX.deploy";
import deployEscrowedCSX from "./deploy/3_EscrowedCSX.deploy";
import deployVestedCSX from "./deploy/4_VestedCSX.deploy";
import deployKeepers from "./deploy/5_Keepers.deploy";
import deployUsers from "./deploy/6_Users.deploy";
import deployUserProfileLevel from "./deploy/7_UserProfileLevel.deploy";
import deployReferralRegistry from "./deploy/8_ReferralRegistry.deploy";
import deployTradeFactoryBaseStorage from "./deploy/9_TradeFactoryBaseStorage.deploy";
import deployBuyAssistoor from "./deploy/10_BuyAssistoor.deploy";
import deployCSXTradeFactory from "./deploy/11_TradeFactory.deploy";

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

  // Deploy Users contract
  addressMap.set("users", await deployUsers(hre, addressMap.get("keepers")!));

  // Deploy UserProfileLevel
  addressMap.set("userProfileLevel", await deployUserProfileLevel(hre, addressMap.get("csxToken")!));

  // Deploy ReferralRegistry
  addressMap.set("referralRegistry", await deployReferralRegistry(hre)); // Deploy the ReferralRegistry contract
  
  // Deploy TradeFactoryBaseStorage
  addressMap.set("tradeFactoryBaseStorage", await deployTradeFactoryBaseStorage(hre, addressMap.get("keepers")!, addressMap.get("users")!));

  // Deploy BuyAssistoor
  addressMap.set("buyAssistoor", await deployBuyAssistoor(hre, addressMap.get("weth")!));

  // Deploy CSXTradeFactory
  addressMap.set("tradeFactory", await deployCSXTradeFactory(
    hre,
    addressMap.get("keepers")!,
    addressMap.get("users")!,
    addressMap.get("tradeFactoryBaseStorage")!,
    addressMap.get("weth")!,
    addressMap.get("usdc")!,
    addressMap.get("usdt")!,
    addressMap.get("referralRegistry")!,
    addressMap.get("tradeFactoryBaseStorage")!,
    addressMap.get("buyAssistoor")!
  ));  

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
