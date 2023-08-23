
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

const { expectRevert } = require("@openzeppelin/test-helpers");

contract("BuyAssistoor", function(accounts) {

  const [
    deployer, 
    council, 
    keeperNodeAddress,
    user1, 
    user2
  ] = accounts;

  beforeEach(async function() {
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
  });

  it("should buy with ETH and convert to WETH", async function() {
    const buyer = user2;
    const value = web3.utils.toWei("1", "ether");
    const _buyerTradeUrl = {
      partner: '225421466',
      token: 'EP2Wwd2R'
    }; 
    const _affLink = web3.utils.sha3("0x0000000000000000000000000000000000000000000000000000000000000000");

    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');

    await buyAssistoor.BuyWithEthToWeth(_buyerTradeUrl, _affLink, tradeAddress, { from: buyer, value });

    const wethBalance = await weth.balanceOf(tradeAddress);
    assert.equal(wethBalance.toString(), value, "WETH balance is incorrect");
  });

  it("should revert with invalid buy contract address", async function() {
    const buyer = accounts[1];
    const value = web3.utils.toWei("1", "ether");
    const _buyerTradeUrl = {
      partner: '225421466',
      token: 'EP2Wwd2R'
    }; 
    const _affLink = "0x0000000000000000000000000000000000000000000000000000000000000000";

    await expectRevert(
      buyAssistoor.BuyWithEthToWeth(_buyerTradeUrl, _affLink, "0x0000000000000000000000000000000000000000", { from: buyer, value }),
      "Invalid buy contract address"
    );
  });
});