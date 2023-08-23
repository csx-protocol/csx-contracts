const { expect } = require('chai');
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const CSXTrade = artifacts.require("CSXTrade");

const ReferralRegistry = artifacts.require("ReferralRegistry");
const Keepers = artifacts.require("Keepers");
const Users = artifacts.require("Users");

const CSXToken = artifacts.require("CSXToken");
const StakedCSX = artifacts.require("StakedCSX");
const BuyAssistoor = artifacts.require("BuyAssistoor");

const TradeFactory = artifacts.require("CSXTradeFactory");
const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");
const USDCToken = artifacts.require("USDCToken");
const USDTToken = artifacts.require("USDTToken");
const WETH9Mock = artifacts.require("WETH9Mock");

contract("CSXTrade", accounts => {

  const [
   deployer, 
   council, 
   keeperNodeAddress,
   user1, 
   user2
  ] = accounts;

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

  beforeEach(async () => {
    csx = await CSXToken.new();
    weth = await WETH9Mock.new();
    usdc = await USDCToken.new();
    usdt = await USDTToken.new();
    scsx = await StakedCSX.new(csx.address, weth.address, usdc.address, usdt.address);

    referralRegistryInstance = await ReferralRegistry.new({ from: deployer });
    keepers = await Keepers.new(council, keeperNodeAddress, { from: deployer });
    users = await Users.new(keepers.address, { from: deployer });

    buyAssistoor = await BuyAssistoor.new(weth.address, { from: deployer });
    tradeFactoryBaseStorage = await TradeFactoryBaseStorage.new(keepers.address, users.address, { from: deployer });

    tradeFactory = await TradeFactory.new(
      keepers.address,
      users.address,
      tradeFactoryBaseStorage.address,
      '26',
      [weth.address, usdc.address, usdt.address],
      referralRegistryInstance.address,
      scsx.address,
      buyAssistoor.address,
      { from: deployer }
    );

    await referralRegistryInstance.initFactory(tradeFactory.address, { from: deployer });
    assert.equal(await referralRegistryInstance.factory(), tradeFactory.address, "Factory initialization failed");
    await users.setFactoryAddress(tradeFactory.address, { from: council });
    await tradeFactoryBaseStorage.init(tradeFactory.address, { from: council });

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
  
    tradeFactory.createListingContract(listingParams, { from: user1 });

    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');

    csxTrade = await CSXTrade.at(tradeAddress);
  });

  describe("Initialization", () => {
    it("should properly initialize the contract", async () => {
        expect(await csxTrade.seller()).to.equal(user1);
        expect(await csxTrade.itemMarketName()).to.equal(listingParams.itemMarketName);

        const sellerTradeUrl = await csxTrade.sellerTradeUrl();
        expect(sellerTradeUrl.partner).to.equal(listingParams.tradeUrl.partner);
        expect(sellerTradeUrl.token).to.equal(listingParams.tradeUrl.token);
    });
  });

  describe("Seller cancel", () => {
    it("should allow the seller to cancel a sale", async () => {
        await csxTrade.sellerCancel({ from: user1 });
        const statusBN = await csxTrade.status();
        const statusNumber = statusBN.toNumber();
        expect(statusNumber).to.equal(TradeStatus.SellerCancelled);
    });

    it("should not allow others to cancel a sale", async () => {
        await expectRevert(
        csxTrade.sellerCancel({ from: user2 }),
        "!party"
        );
    });
  });

});
