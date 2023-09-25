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
  const CSXToken = await deployCSXToken(hre);
  addressMap.set("csxToken", CSXToken.target as string);
  // Deploy Staked CSX
  const [stakedCSX, wethAddress, usdcAddress, usdtAddress] = await deployStakedCSX(hre, addressMap.get("csxToken")!);
  addressMap.set("stakedCSX", stakedCSX.target as string);
  addressMap.set("weth", wethAddress);
  addressMap.set("usdc", usdcAddress);
  addressMap.set("usdt", usdtAddress);
  
  // Deploy Escrowed CSX
  const EscrowedCSX = await deployEscrowedCSX(hre, addressMap.get("csxToken")!);
  addressMap.set("escrowedCSX", EscrowedCSX.target as string);

  // Deploy VestedCSX
  const VestedCSX = await deployVestedCSX(
    hre,
    addressMap.get("escrowedCSX")!,
    addressMap.get("stakedCSX")!,
    addressMap.get("weth")!,
    addressMap.get("usdc")!,
    addressMap.get("csxToken")!,
    addressMap.get("usdt")!
  );
  addressMap.set("vestedCSX", VestedCSX.target as string);

  // Deploy Keepers contract
  const Keepers = await deployKeepers(hre);
  addressMap.set("keepers", Keepers.target as string);

  // Deploy Users contract
  const Users = await deployUsers(hre, addressMap.get("keepers")!);
  addressMap.set("users", Users.target as string);

  // Deploy UserProfileLevel
  const UserProfileLevel = await deployUserProfileLevel(hre, addressMap.get("csxToken")!)
  addressMap.set("userProfileLevel", UserProfileLevel.target as string);

  // Deploy ReferralRegistry
  const ReferralRegistry = await deployReferralRegistry(hre);
  addressMap.set("referralRegistry", ReferralRegistry.target as string); // Deploy the ReferralRegistry contract
  
  // Deploy TradeFactoryBaseStorage
  const TradeFactoryBaseStorage = await deployTradeFactoryBaseStorage(hre, addressMap.get("keepers")!, addressMap.get("users")!);
  addressMap.set("tradeFactoryBaseStorage", TradeFactoryBaseStorage.target as string);

  // Deploy BuyAssistoor
  const BuyAssistoor = await deployBuyAssistoor(hre, addressMap.get("weth")!);
  addressMap.set("buyAssistoor", BuyAssistoor.target as string);

  // Deploy CSXTradeFactory
  const TradeFactory = await deployCSXTradeFactory(
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
  );
  addressMap.set("tradeFactory", TradeFactory.target as string);

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
