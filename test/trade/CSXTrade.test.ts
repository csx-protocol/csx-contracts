import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { PaymentTokensStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";

describe("CSXTrade", async function() {
  let csx: any,
      weth: any,
      usdc: any,
      usdt: any,
      scsx: any,
      referralRegistryInstance: any,
      keepers: any,
      users: any,
      buyAssistoor: any,
      tradeFactoryBaseStorage: any,
      tradeFactory: any,
      csxTrade: any;

  let deployer: Signer,
      council: Signer,
      keeperNodeAddress: Signer,
      user1: Signer,
      user2: Signer;

  const TradeStatus = {
    ForSale: 0,
    SellerCancelled: 1,
    BuyerCommitted: 2,
    BuyerCancelled: 3,
    SellerCommitted: 4,
    SellerCancelledAfterBuyerCommitted: 5,
    Completed: 6,
    Disputed: 7,
    Resolved: 8,
    Clawbacked: 9
  };

  const listingParams = {
    itemMarketName: "itemMarketName",
    tradeUrl: {
      partner: '225482466',
      token: 'EP2Wgs2R'
    },
    assetId: "assetId",
    inspectLink: "inspectLink",
    itemImageUrl: "itemImageUrl",
    weiPrice: "1000000000000000000",
    skinInfo: [
      '[0.8, 0.06, 0.35223010182380676]',
      '8',
      '27'
    ],
    stickers: [{
      name: 'Sticker',
      material: 'sticker/sticker',
      slot: 0,
      imageLink: 'imageLink'
    }],
    weaponType: "weaponType",
    priceType: "0"
  };

  beforeEach(async function() {
    [deployer, council, keeperNodeAddress, user1, user2] = await ethers.getSigners();

    const CSXToken = await ethers.getContractFactory("CSXToken");
    csx = await CSXToken.deploy();
    await csx.waitForDeployment();

    const WETH9Mock = await ethers.getContractFactory("WETH9Mock");
    weth = await WETH9Mock.deploy();
    await weth.waitForDeployment();

    const USDCToken = await ethers.getContractFactory("USDCToken");
    usdc = await USDCToken.deploy();
    await usdc.waitForDeployment();

    const USDTToken = await ethers.getContractFactory("USDTToken");
    usdt = await USDTToken.deploy();
    await usdt.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();

    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    scsx = await StakedCSX.deploy(csx.target, weth.target, usdc.target, usdt.target, keepers.target);
    await scsx.waitForDeployment();

    const ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
    referralRegistryInstance = await ReferralRegistry.deploy();
    await referralRegistryInstance.waitForDeployment();

    const Users = await ethers.getContractFactory("Users");
    users = await Users.deploy(keepers.target);
    await users.waitForDeployment();

    const BuyAssistoor = await ethers.getContractFactory("BuyAssistoor");
    buyAssistoor = await BuyAssistoor.deploy(weth.target);
    await buyAssistoor.waitForDeployment();

    const TradeFactoryBaseStorage = await ethers.getContractFactory("TradeFactoryBaseStorage");
    tradeFactoryBaseStorage = await TradeFactoryBaseStorage.deploy(keepers.target, users.target);
    await tradeFactoryBaseStorage.waitForDeployment();

    const TradeFactory = await ethers.getContractFactory("CSXTradeFactory");
    tradeFactory = await TradeFactory.deploy(
      keepers.target,
      users.target,
      tradeFactoryBaseStorage.target,
      '26',
      {weth: weth.target, usdc: usdc.target, usdt: usdt.target} as PaymentTokensStruct,
      referralRegistryInstance.target,
      scsx.target,
      buyAssistoor.target
    );
    await tradeFactory.waitForDeployment();

        
    await referralRegistryInstance.initFactory(tradeFactory.target);
    await users.connect(council).setFactoryAddress(tradeFactory.target);

    await tradeFactoryBaseStorage.connect(council).init(tradeFactory.target);
    await tradeFactory.connect(user1).createListingContract(listingParams);

    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');
    const CSXTrade = await ethers.getContractFactory("CSXTrade");
    csxTrade = CSXTrade.attach(tradeAddress);
  });

  describe("Initialization", async function() {
    it("should properly initialize the contract", async function() {      
      expect(await csxTrade.seller()).to.equal(await user1.getAddress());
      expect(await csxTrade.itemMarketName()).to.equal(listingParams.itemMarketName);
      const sellerTradeUrl = await csxTrade.sellerTradeUrl();
      expect(sellerTradeUrl.partner.toString()).to.equal(listingParams.tradeUrl.partner);
      expect(sellerTradeUrl.token.toString()).to.equal(listingParams.tradeUrl.token);
    });
  });

  describe("Seller cancel", async function() {
    it("should allow the seller to cancel a sale", async function() {
      await csxTrade.connect(user1).sellerCancel();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCancelled);
    });

    it("should not allow others to cancel a sale", async function() {
      await expect(csxTrade.connect(user2).sellerCancel()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
  });
});
