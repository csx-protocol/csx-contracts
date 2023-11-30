import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("BuyAssistoor", async function() {
  let referralRegistryInstance: any,
      csx: any,
      weth: any,
      usdc: any,
      usdt: any,
      scsx: any,
      keepers: any,
      users: any,
      buyAssistoor: any,
      tradeFactoryBaseStorage: any,
      tradeFactory: any;

  let deployer: Signer,
      council: Signer,
      keeperNodeAddress: Signer,
      user1: Signer,
      user2: Signer;

  const referralCode = ethers.encodeBytes32String("refCode123");
  const ownerRatio = 60;
  const buyerRatio = 40;

  beforeEach(async function () {
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
    referralRegistryInstance = await ReferralRegistry.deploy(keepers.target);
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
      { weth: weth.target, usdc: usdc.target, usdt: usdt.target },
      referralRegistryInstance.target,
      scsx.target,
      buyAssistoor.target
    );
    await tradeFactory.waitForDeployment();

    await referralRegistryInstance.connect(council).changeContracts(tradeFactory.target, keepers.target);
    expect(await referralRegistryInstance.factory()).to.equal(tradeFactory.target);
    await users.connect(council).changeContracts(tradeFactory.target, keepers.target);
    await tradeFactoryBaseStorage.connect(council).init(tradeFactory.target);
       
        
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

    await tradeFactory.connect(user1).createListingContract(listingParams);
  });

  it("should buy with ETH and convert to WETH", async function() {
    const buyer = user2;
    const value = ethers.parseEther("1");
    const _buyerTradeUrl = {
      partner: '225421466',
      token: 'EP2Wwd2R'
    }; 
    const zeroBytes32 = `0x${"0".repeat(64)}`;
    const _affLink = zeroBytes32;
    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');
    await buyAssistoor.connect(buyer).BuyWithEthToWeth(_buyerTradeUrl, _affLink, tradeAddress, { value: value });
    const wethBalance = await weth.balanceOf(tradeAddress);
    expect(wethBalance.toString()).to.equal(value.toString());
  });

  it("should revert with invalid buy contract address", async function() {
    const buyer = user2;
    const value = ethers.parseEther("1");
    const _buyerTradeUrl = {
      partner: '225421466',
      token: 'EP2Wwd2R'
    };
    const zeroBytes32 = `0x${"0".repeat(64)}`;
    const zeroAddress = `0x${"0".repeat(40)}`;
    const _affLink = zeroBytes32;
    await expect(buyAssistoor.connect(buyer).BuyWithEthToWeth(_buyerTradeUrl, _affLink, zeroAddress, { value: value }))
      .to.be.revertedWithCustomError(buyAssistoor, "ZeroAddress");
  });
});
