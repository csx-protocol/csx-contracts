import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer} from "ethers";
import { PaymentTokensStruct, TradeUrlStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";
import { InitParamsStruct } from "../../typechain-types/contracts/CSX/StakedCSX";
import { CSXTrade } from "../../typechain-types";

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
      tradeFactory: any,
      csxTrade: CSXTrade;

  let deployer: Signer,
      council: Signer,
      keeperNodeAddress: Signer,
      user1: Signer,
      user2: Signer,
      user3: Signer;

  const referralCode = ethers.encodeBytes32String("refCode123");
  const referralCodeWithSpace = ethers.encodeBytes32String("refCode 123");
  const ownerRatio = 60;
  const buyerRatio = 40;

  beforeEach(async function () {
    [deployer, council, keeperNodeAddress, user1, user2, user3] = await ethers.getSigners();

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
    keepers = await Keepers.deploy(council.getAddress(), keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();
    
    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    const stakedInitParams = {
      KEEPERS_INTERFACE: keepers.target,
      TOKEN_CSX: csx.target,
      TOKEN_WETH: weth.target,
      TOKEN_USDC: usdc.target,
      TOKEN_USDT: usdt.target,
    } as InitParamsStruct;
    scsx = await StakedCSX.deploy(stakedInitParams);
    await scsx.waitForDeployment();

    const ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
    referralRegistryInstance = await ReferralRegistry.deploy(keepers.target, weth.target, usdc.target, usdt.target);
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

    await referralRegistryInstance.connect(council).changeContracts(tradeFactory.target, keepers.target);
    expect(await referralRegistryInstance.factory()).to.equal(tradeFactory.target);
    await users.connect(council).changeContracts(tradeFactory.target, keepers.target);

    await tradeFactoryBaseStorage.connect(council).init(tradeFactory.target);

  });

  it("should register a referral code", async function () {
    await referralRegistryInstance.connect(user1).registerReferralCode(referralCode, ownerRatio, buyerRatio);
    const referralInfo = await referralRegistryInstance.getReferralInfo(referralCode);
    expect(referralInfo.owner).to.equal(await user1.getAddress());
    expect(Number(referralInfo.ownerRatio)).to.equal(ownerRatio);
    expect(Number(referralInfo.buyerRatio)).to.equal(buyerRatio);
    const _getRebatePerCodePerPaymentToken = await referralRegistryInstance.getRebatePerCodePerPaymentToken(referralCode, weth.target);
    expect(Number(_getRebatePerCodePerPaymentToken)).to.equal(0);
    const _getReferralCodesByUser = await referralRegistryInstance.getReferralCodesByUser(await user1.getAddress());
    expect(_getReferralCodesByUser[0]).to.equal(referralCode);
    const _getReferralCodeRatios = await referralRegistryInstance.getReferralCodeRatios(referralCode);
    expect(Number(_getReferralCodeRatios[0])).to.equal(ownerRatio);
    expect(Number(_getReferralCodeRatios[1])).to.equal(buyerRatio);
  });

  it("should not register a referral code with a space", async function () {
    await expect(referralRegistryInstance.connect(user1).registerReferralCode(referralCodeWithSpace, ownerRatio, buyerRatio)).to.be.revertedWithCustomError(referralRegistryInstance,"InvalidReferralCode").withArgs("Referral code cannot contain spaces");
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

  it("should receive the correct rebate amount after a trade", async function () {
    // Item price (1 ETH, 18 decimals)
    const itemFullPrice = ethers.parseUnits("1", 18);

    // Create listing
    const params = {
      itemMarketName: 'TEST',
      tradeUrl: ['0', 'TEST'],
      assetId: 'TEST',
      inspectLink: 'TEST',
      itemImageUrl: 'TEST',
      weiPrice: itemFullPrice,
      skinInfo: [
        "[0.8, 0.06, 0.35223010182380676]",
        "8",
        "27",
      ],
      stickers: [],
      weaponType: 'TEST',
      priceType: '0',
    };
    await tradeFactory.connect(deployer).createListingContract(params);

    // get contract address
    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');

    // connect trade contract
    const CSXTrade = await ethers.getContractFactory("CSXTrade");
    csxTrade = CSXTrade.attach(tradeAddress) as CSXTrade;

    // create referral code for user1
    await referralRegistryInstance.connect(user1).registerReferralCode(referralCode, ownerRatio, buyerRatio);

    // user3 buys item
    await weth.connect(user3).deposit({value: itemFullPrice});
    await weth.connect(user3).approve(csxTrade.target, itemFullPrice);
    const tradeUrl: TradeUrlStruct = {
      partner: "2",
      token: ""
    };
    await csxTrade.connect(user3).commitBuy(tradeUrl, referralCode, await user3.getAddress());

    // proceed to complete trade
    await csxTrade.connect(user3).buyerConfirmReceived();

    // 1. Get base fee
    const baseFee = await tradeFactory.baseFee();
    // 2. Calculate base fee value
    const baseFeeValue = (itemFullPrice * baseFee) / 1000n;
    // 3. Calculate half of base fee value
    const halfBaseFeeValue = baseFeeValue / 2n;
    // 4. Calculate ref rebate
    const refRebate = halfBaseFeeValue * BigInt(ownerRatio) / 100n;
    // 5. Get claimable rewards per user per payment token
    const claimableRewardsPerUserPerPaymentToken = 
      await referralRegistryInstance.claimableRewardsPerUserPerPaymentToken(await user1.getAddress(), weth.target);
    // 6. Expect claimable rewards to equal ref rebate
    expect(claimableRewardsPerUserPerPaymentToken).to.equal(refRebate);
    // 7. Get weth balance before claiming
    const wethBalanceBefore = await weth.balanceOf(await user1.getAddress());
    // 8. Claim ref rebate
    await referralRegistryInstance.connect(user1).claimReferralRewards(true, false, false);
    // 9. Get weth balance after claiming
    const wethBalanceAfter = await weth.balanceOf(await user1.getAddress());
    // 10. Expect weth balance after to equal self calculated ref rebate
    expect(wethBalanceAfter).to.equal(refRebate);
    // 11. Get claimable rewards per user per payment token after claiming
    const claimableRewardsPerUserPerPaymentTokenAfter = 
      await referralRegistryInstance.claimableRewardsPerUserPerPaymentToken(await user1.getAddress(), weth.target);
    // 12. Expect claimable rewards after to equal weth balance before (zero)
    expect(claimableRewardsPerUserPerPaymentTokenAfter).to.equal(wethBalanceBefore);
  });
});
