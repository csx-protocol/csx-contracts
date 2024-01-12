import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployCSXToken from "./deploy/1_CSXToken.deploy";
import deployKeepers from "./deploy/2_Keepers.deploy";
import deployStakedCSX from "./deploy/3_StakedCSX.deploy";
import deployEscrowedCSX from "./deploy/4_EscrowedCSX.deploy";
import deployVestedCSX from "./deploy/5_VestedCSX.deploy";
import deployUsers from "./deploy/6_Users.deploy";
import deployUserProfileLevel from "./deploy/7_UserProfileLevel.deploy";
import deployReferralRegistry from "./deploy/8_ReferralRegistry.deploy";
import deployTradeFactoryBaseStorage from "./deploy/9_TradeFactoryBaseStorage.deploy";
import deployBuyAssistoor from "./deploy/10_BuyAssistoor.deploy";
import deployCSXTradeFactory from "./deploy/11_TradeFactory.deploy";
import {
  _tradeUrl,
  assetIds,
  imgs,
  inspctLink,
  names,
  priceTypes,
  prices,
  skinInfo,
  stickers,
  weaponTypes,
} from "./deploy/utils/list-demo";

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

const INIT_CONTRACTS: boolean = true;
const LIST_TEST_ITEMS: boolean = true;
const VERIFY_ON_ETHERSCAN: boolean = true;

const main = async () => {
  const hre: HardhatRuntimeEnvironment = await import("hardhat");
  const addressMap: Map<string, string> = new Map();

  // Deploy CSX Token
  const CSXToken = await deployCSXToken(hre);
  addressMap.set("csxToken", CSXToken.target as string);

  // Deploy Keepers contract
  const Keepers = await deployKeepers(hre);
  addressMap.set("keepers", Keepers.target as string);

  // Deploy Staked CSX
  const [stakedCSX, wethAddress, usdcAddress, usdtAddress] =
    await deployStakedCSX(hre, addressMap.get("csxToken")!, addressMap.get("keepers")!);
  addressMap.set("stakedCSX", stakedCSX.target as string);
  addressMap.set("weth", wethAddress);
  addressMap.set("usdc", usdcAddress);
  addressMap.set("usdt", usdtAddress);

  // Deploy Escrowed CSX
  const EscrowedCSX = await deployEscrowedCSX(hre, CSXToken.target as string);
  addressMap.set("escrowedCSX", EscrowedCSX.target as string);

  // Deploy VestedCSX
  const VestedCSX = await deployVestedCSX(
    hre,
    addressMap.get("escrowedCSX")!,
    addressMap.get("stakedCSX")!,
    addressMap.get("weth")!,
    addressMap.get("usdc")!,
    addressMap.get("csxToken")!,
    addressMap.get("usdt")!,
    addressMap.get("keepers")!
  );
  addressMap.set("vestedCSX", VestedCSX.target as string);

  // Deploy Users contract
  const Users = await deployUsers(hre, addressMap.get("keepers")!);
  addressMap.set("users", Users.target as string);

  // Deploy UserProfileLevel
  const UserProfileLevel = await deployUserProfileLevel(
    hre,
    addressMap.get("csxToken")!,
    addressMap.get("keepers")!
  );
  addressMap.set("userProfileLevel", UserProfileLevel.target as string);

  // Deploy ReferralRegistry
  const ReferralRegistry = await deployReferralRegistry(hre, addressMap.get("keepers")!);
  addressMap.set("referralRegistry", ReferralRegistry.target as string); // Deploy the ReferralRegistry contract

  // Deploy TradeFactoryBaseStorage
  const TradeFactoryBaseStorage = await deployTradeFactoryBaseStorage(
    hre,
    addressMap.get("keepers")!,
    addressMap.get("users")!
  );
  addressMap.set(
    "tradeFactoryBaseStorage",
    TradeFactoryBaseStorage.target as string
  );

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
    addressMap.get("stakedCSX")!,
    addressMap.get("buyAssistoor")!
  );
  addressMap.set("tradeFactory", TradeFactory.target as string);

  if (INIT_CONTRACTS) {
    await CSXToken.init(Keepers.target);

    await EscrowedCSX.init(VestedCSX.target);

    await TradeFactoryBaseStorage.init(TradeFactory.target);

    // Council Actions
    if (
      hre.network.name === "hardhat" ||
      hre.network.name === "localhost" ||
      hre.network.name === "ganache" ||
      hre.network.name === "goerli"
    ) {
      await ReferralRegistry.changeContracts(TradeFactory.target, Keepers.target);
      await Users.changeContracts(TradeFactory.target, Keepers.target);
    } else {
      // TODO: Implement optional hardware wallet signing for production networks
      // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-ledger.html
      console.warn(
        `Please call changeContracts() on ReferralRegistry and Users contracts with the following params:
        \n\nReferralRegistry.changeContracts(${TradeFactory.target}, ${Keepers.target});
        \nUsers.changeContracts(${TradeFactory.target}, ${Keepers.target});\n\n`
      )
    }

  }

  // Logging contract addresses
  contractNames.forEach((contractName) => {
    console.log(`${contractName.padEnd(24)} ${addressMap.get(contractName)}`);
  });

  console.log(`\n\n${"=".repeat(50)}\n\n`);

  if (LIST_TEST_ITEMS) {
    console.log(`Creating Demo Listings...`);
    
    for (let i = 0; i < prices.length; i++) {
      const params = {
        itemMarketName: names[i],
        tradeUrl: _tradeUrl,
        assetId: assetIds[i],
        inspectLink: inspctLink[i],
        itemImageUrl: imgs[i],
        weiPrice: prices[i],
        skinInfo: skinInfo[i],
        stickers: stickers[i],
        weaponType: weaponTypes[i],
        priceType: priceTypes[i],
      };
      const txResponse = await TradeFactory.createListingContract(params);
      console.log(`Created listing for ${names[i]}`);
      await txResponse.wait(1);
      if(txResponse.hash){
        console.log(`Transaction ${txResponse.hash} successful!`);
      }
    }
    const totalListings = await TradeFactory.totalContracts();
    console.log(`Total Demo Listings: ${totalListings}`);
  }

  if(VERIFY_ON_ETHERSCAN){
    await hre.run("verify:verify", {
      address: addressMap.get("csxToken"),
      constructorArguments: [],
    });    
    await hre.run("verify:verify", {
      address: addressMap.get("stakedCSX")!,
      constructorArguments: [
        addressMap.get("csxToken"),
        addressMap.get("weth"),
        addressMap.get("usdc"),
        addressMap.get("usdt"),
        addressMap.get("keepers"),
      ],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("escrowedCSX"),
      constructorArguments: [addressMap.get("csxToken")],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("vestedCSX"),
      constructorArguments: [
        addressMap.get("escrowedCSX"),
        addressMap.get("stakedCSX"),
        addressMap.get("weth"),
        addressMap.get("usdc"),
        addressMap.get("csxToken"),
        addressMap.get("usdt"),
        addressMap.get("keepers"),
      ],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("keepers"),
      constructorArguments: [
        process.env.COUNCIL_ADDRESS || "",
        process.env.ORACLE_NODE_ADDRESS || "",
      ],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("users"),
      constructorArguments: [addressMap.get("keepers")],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("userProfileLevel"),
      constructorArguments: [
        addressMap.get("csxToken"),
        addressMap.get("users"),
        addressMap.get("keepers"),
      ],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("referralRegistry"),
      constructorArguments: [addressMap.get("keepers")],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("tradeFactoryBaseStorage"),
      constructorArguments: [addressMap.get("keepers"), addressMap.get("users")],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("buyAssistoor"),
      constructorArguments: [addressMap.get("weth")],
    });
    await hre.run("verify:verify", {
      address: addressMap.get("tradeFactory"),
      constructorArguments: [
        addressMap.get("keepers"),
        addressMap.get("users"),
        addressMap.get("tradeFactoryBaseStorage"),
        '26',
        {
          weth: addressMap.get("weth"),
          usdc: addressMap.get("usdc"),
          usdt: addressMap.get("usdt"),
        },        
        addressMap.get("referralRegistry"),
        addressMap.get("stakedCSX"),
        addressMap.get("buyAssistoor"),
      ],
    });
    console.log(`\n\n${"=".repeat(50)}\n\n`);
    console.log(`Verify on Etherscan completed!`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
