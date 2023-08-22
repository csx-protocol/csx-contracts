const { expectRevert } = require("@openzeppelin/test-helpers");

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

const Web3 = require('web3');
const web3 = new Web3();

contract("ReferralRegistry", function(accounts) {
  let referralRegistryInstance;
  // accounts
  const [
    deployer, 
    council, 
    keeperNodeAddress,
    user1, 
    user2
  ] = accounts;

  const referralCode = web3.utils.fromAscii("refCode123");
  const ownerRatio = 60;
  const buyerRatio = 40;
  const rebate = 100;
  

  beforeEach(async function() {
    csx = await CSXToken.new();
    weth = await WETH9Mock.new();
    usdc = await USDCToken.new();
    usdt = await USDTToken.new();
    scsx = await StakedCSX.new(csx.address, weth.address, usdc.address, usdt.address);

    referralRegistryInstance = await ReferralRegistry.new({ from: deployer });
    // Assuming that you have already deployed ITradeFactory and set its address in factoryAddress
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
  });

  it("should register a referral code", async function() {
    await referralRegistryInstance.registerReferralCode(referralCode, ownerRatio, buyerRatio, { from: user1 });
    const referralInfo = await referralRegistryInstance.getReferralInfo(referralCode);
    assert.equal(referralInfo.owner, user1, "Referral owner mismatch");
    assert.equal(referralInfo.ownerRatio, ownerRatio, "Owner ratio mismatch");
    assert.equal(referralInfo.buyerRatio, buyerRatio, "Buyer ratio mismatch");
  });

  it("should set and get a referral code", async function() {
    await referralRegistryInstance.registerReferralCode(referralCode, ownerRatio, buyerRatio, { from: user1 });
    await referralRegistryInstance.setReferralCodeAsUser(referralCode, { from: user2 });
    const expectedReferralCode = web3.utils.padRight(referralCode, 64); // Pad the value to 64 characters (32 bytes)
    assert.equal(await referralRegistryInstance.getReferralCode(user2), expectedReferralCode, "Referral code was not set");
  });

  it("should not be able to register a code that already exists", async function() {
    // Register the referral code by user1
    await referralRegistryInstance.registerReferralCode(referralCode, ownerRatio, buyerRatio, { from: user1 });

    // Attempt to register the same code by user2, should revert
    await expectRevert(referralRegistryInstance.registerReferralCode(referralCode, ownerRatio, buyerRatio, { from: user2 }), "Referral code already registered");
  });

});
