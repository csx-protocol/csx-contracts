import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer} from "ethers";
import { PaymentTokensStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";
describe("ReferralRegistry", async function () {
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
    
    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    scsx = await StakedCSX.deploy(csx.target, weth.target, usdc.target, usdt.target);
    await scsx.waitForDeployment();

    const ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
    referralRegistryInstance = await ReferralRegistry.deploy();
    await referralRegistryInstance.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(council.getAddress(), keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();

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

    expect(await referralRegistryInstance.factory()).to.equal(tradeFactory.target);
    await users.connect(council).setFactoryAddress(tradeFactory.target);
  });

  it("should register a referral code", async function () {
    await referralRegistryInstance.connect(user1).registerReferralCode(referralCode, ownerRatio, buyerRatio);
    const referralInfo = await referralRegistryInstance.getReferralInfo(referralCode);
    expect(referralInfo.owner).to.equal(await user1.getAddress());
    expect(Number(referralInfo.ownerRatio)).to.equal(ownerRatio);
    expect(Number(referralInfo.buyerRatio)).to.equal(buyerRatio);
  });

  it("should set and get a referral code", async function () {
    await referralRegistryInstance.connect(user1).registerReferralCode(referralCode, ownerRatio, buyerRatio);
    await referralRegistryInstance.connect(user2).setReferralCodeAsUser(referralCode);
    expect(await referralRegistryInstance.getReferralCode(await user2.getAddress())).to.equal(referralCode);
  });

  it("should not be able to register a code that already exists", async function () {
    await referralRegistryInstance.connect(user1).registerReferralCode(referralCode, ownerRatio, buyerRatio);
    await expect(referralRegistryInstance.connect(user2).registerReferralCode(referralCode, ownerRatio, buyerRatio)).to.be.revertedWithCustomError(referralRegistryInstance,"InvalidReferralCode").withArgs("Referral code already registered");
  });
});
