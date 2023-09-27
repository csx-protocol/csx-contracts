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
      keeperNode: Signer,
      keeperUser1: Signer,
      seller: Signer,
      buyer: Signer;

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
    [deployer, council, keeperNode, seller, buyer, keeperUser1] = await ethers.getSigners();

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
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNode.getAddress());
    await keepers.waitForDeployment();
    keepers.connect(council).addKeeper(await keeperUser1.getAddress());

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
    await tradeFactory.connect(seller).createListingContract(listingParams);

    const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');
    const CSXTrade = await ethers.getContractFactory("CSXTrade");
    csxTrade = CSXTrade.attach(tradeAddress);
  });

  describe("Initialization", async function() {
    it("should properly initialize the contract", async function() {      
      expect(await csxTrade.seller()).to.equal(await seller.getAddress());
      expect(await csxTrade.itemMarketName()).to.equal(listingParams.itemMarketName);
      const sellerTradeUrl = await csxTrade.sellerTradeUrl();
      expect(sellerTradeUrl.partner.toString()).to.equal(listingParams.tradeUrl.partner);
      expect(sellerTradeUrl.token.toString()).to.equal(listingParams.tradeUrl.token);
    });
  });

  describe("sellerCancel()", async function() {
    it("should allow the seller to cancel a sale", async function() {
      await csxTrade.connect(seller).sellerCancel();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCancelled);
    });
    it("should not allow others to cancel a sale", async function() {
      await expect(csxTrade.connect(buyer).sellerCancel()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
    it("should not allow the seller to cancel after buyer committed", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await expect(csxTrade.connect(seller).sellerCancel()).to.be.revertedWithCustomError(csxTrade, "NotForSale");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCommitted);
    });
  });

  describe("commitBuy()", async function() {
    it("should allow the buyer to commit to buy", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      expect(await csxTrade.buyer()).to.equal(buyerAddress);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCommitted);
    });
    it("should not allow the seller to commit as a buyer", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await expect(csxTrade.connect(seller).commitBuy(mockTradeUrl, affLink, await seller.getAddress())).to.be.revertedWithCustomError(csxTrade, "NotSeller");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.ForSale);
    });
  });

  describe("buyerCancel()", async function() {
    it("should allow the buyer to cancel after 24 hours", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await csxTrade.connect(buyer).buyerCancel();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCancelled);
    });
    it("should not allow the buyer to cancel before 24 hours", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await expect(csxTrade.connect(buyer).buyerCancel()).to.be.revertedWithCustomError(csxTrade, "TimeNotElapsed");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCommitted);
    });
    it("should not allow non buyer to cancel", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await expect(csxTrade.connect(seller).buyerCancel()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
  });

  describe("sellerTradeVeridict()", async function() {
    it("should allow the seller to confirm the trade", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
    });
    it("should allow the seller to deny the trade", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(false);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCancelledAfterBuyerCommitted);
    });
  });

  describe("buyerConfirmReceived()", async function() {
    it("should allow the buyer to confirm the trade", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(buyer).buyerConfirmReceived();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Completed);
    });
    it("should not allow the seller to confirm the trade", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await expect(csxTrade.connect(seller).buyerConfirmReceived()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
    it("should allow the buyer to confirm the trade before seller verdict", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(buyer).buyerConfirmReceived();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Completed);
    });
  });

  describe("sellerConfirmsTrade()", async function() {
    it("should allow the seller to confirm the trade after 8 days", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await ethers.provider.send("evm_increaseTime", [691200]);
      await ethers.provider.send("evm_mine", []);
      await csxTrade.connect(seller).sellerConfirmsTrade();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Completed);
    });
    it("should not allow the seller to confirm the trade before 8 days", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await expect(csxTrade.connect(seller).sellerConfirmsTrade()).to.be.revertedWithCustomError(csxTrade, "TimeNotElapsed");
    });
    it("should not allow the buyer to confirm the trade after 8 days", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await ethers.provider.send("evm_increaseTime", [691200]);
      await ethers.provider.send("evm_mine", []);
      await expect(csxTrade.connect(buyer).sellerConfirmsTrade()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
    it("should not allow the buyer to confirm the trade before 8 days", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await expect(csxTrade.connect(buyer).sellerConfirmsTrade()).to.be.revertedWithCustomError(csxTrade, "NotParty");
    });
    it("should not allow the seller to confirm the trade before seller verdict", async function() {
      await expect(csxTrade.connect(seller).sellerConfirmsTrade()).to.be.revertedWithCustomError(csxTrade, "StatusNotSellerCommitted");
    });
  });

  describe("keeperNodeConfirmsTrade()", async function() {
    it("should not allow the keeper node to confirm the trade if status is not BuyerCommitted or SellerCommitted", async function() {
      await expect(csxTrade.connect(keeperNode).keeperNodeConfirmsTrade(true)).to.be.revertedWithCustomError(csxTrade, "StatusNotBuyerCommitted");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.ForSale);      
    });
    it("should allow the keeperNode to confirm the trade if status is BuyerCommitted", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCommitted);
      await csxTrade.connect(keeperNode).keeperNodeConfirmsTrade(true);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Completed);
    });
    it("should allow the keeperNode to reject the trade if status is BuyerCommitted", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.BuyerCommitted);
      await csxTrade.connect(keeperNode).keeperNodeConfirmsTrade(false);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Clawbacked);
    });
    it("should allow the keeperNode to confirm the trade if status is SellerCommitted", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(keeperNode).keeperNodeConfirmsTrade(true);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Completed);      
    });
    it("should allow the keeperNode to reject the trade if status is SellerCommitted", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(keeperNode).keeperNodeConfirmsTrade(false);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Clawbacked);      
    });
    it("should not allow non keeperNode to confirm the trade", async function() {
      await expect(csxTrade.connect(buyer).keeperNodeConfirmsTrade(true)).to.be.revertedWithCustomError(csxTrade, "NotKeeperNode");
    });
  });

  describe("openDispute()", async function() {
    it("should not allow seller to open a dispute in ForSale status", async function() {
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.ForSale);
      await expect(csxTrade.connect(seller).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
    it("should allow seller to open a dispute in BuyerCommitted status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const sellerAddress = await seller.getAddress();
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);      
    });
    it("should allow buyer to open a dispute in BuyerCommitted status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(buyer).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);      
    });
    it("should allow seller to open a dispute in SellerCommitted status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);      
    });
    it("should allow buyer to open a dispute in SellerCommitted status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(buyer).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);      
    });
    it("should allow seller to open a dispute in Completed status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(buyer).buyerConfirmReceived();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Completed);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);      
    });
    it("should allow buyer to open a dispute in Completed status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, await buyer.getAddress());
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(buyer).buyerConfirmReceived();
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Completed);
      await csxTrade.connect(buyer).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);      
    });
    it("should not allow non seller or buyer to open a dispute", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).openDispute("Item not received");
      await expect(csxTrade.connect(keeperNode).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "NotGroup");
    });
    it("should not allow seller to open a dispute if already disputed", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(buyer).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      await expect(csxTrade.connect(seller).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
    it("should not allow buyer to open a dispute if already disputed", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(buyer).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      await expect(csxTrade.connect(buyer).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
    it("should not allow seller or buyer to open a dispute if resolved status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);
      await csxTrade.connect(keeperNode).resolveDispute(false, false, false, false);
      const status3 = await csxTrade.status();
      expect(status3 as number).to.equal(TradeStatus.Resolved);
      await expect(csxTrade.connect(seller).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
      await expect(csxTrade.connect(buyer).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
    it("should not allow seller or buyer to open a dispute if clawbacked status", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(seller).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));
      await weth.connect(seller).approve(csxTrade.target, ethers.parseEther("1"));      
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Disputed);
      await csxTrade.connect(keeperNode).resolveDispute(true, false, false, false);
      const status3 = await csxTrade.status();
      expect(status3 as number).to.equal(TradeStatus.Clawbacked);
      await expect(csxTrade.connect(seller).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
      await expect(csxTrade.connect(buyer).openDispute("Item not received")).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
  });

  describe("resolveDispute()", async function() {
    it("should not allow seller to resolve a dispute", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));   
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await expect(csxTrade.connect(seller).resolveDispute(true, false, false, false)).to.be.revertedWithCustomError(csxTrade, "NotKeeperOrNode");
    });
    it("should not allow buyer to resolve a dispute", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));    
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await expect(csxTrade.connect(buyer).resolveDispute(true, false, false, false)).to.be.revertedWithCustomError(csxTrade, "NotKeeperOrNode");
    });
    it("should not allow keeperNode to resolve a dispute when status is not disputed", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));    
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.SellerCommitted);
      await expect(csxTrade.connect(keeperNode).resolveDispute(true, false, false, false)).to.be.revertedWithCustomError(csxTrade, "StatusNotDisputeReady");
    });
    it("should allow keeperNode to resolve a dispute when status is disputed to clawbacked", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));     
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      await csxTrade.connect(keeperNode).resolveDispute(true, false, false, false);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Clawbacked);
    });
    it("should allow keeperNode to resolve a dispute when status is disputed to resolved", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));     
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      await csxTrade.connect(keeperNode).resolveDispute(false, false, false, false);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Resolved);
    });
    it("should send the buyer the funds if isFavourOfBuyer & isWithValue is true", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));   
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      const isFavourOfBuyer = true;
      const isWithValue = true;
      await csxTrade.connect(keeperNode).resolveDispute(isFavourOfBuyer, false, false, isWithValue);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Clawbacked);
      const buyerBalance = await weth.balanceOf(buyerAddress);
      expect(buyerBalance).to.equal(ethers.parseEther("1"));
    });
    it("should send the seller the funds if isFavourOfBuyer is false & isWithValue is true", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const buyerAddress = await buyer.getAddress();
      const sellerAddress = await seller.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));   
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      const isFavourOfBuyer = false;
      const isWithValue = true;
      await csxTrade.connect(keeperNode).resolveDispute(isFavourOfBuyer, false, false, isWithValue);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Resolved);
      const sellerBalance = await weth.balanceOf(sellerAddress);
      const dep = ethers.parseEther("1");
      const feeinPercent = 26n;
      const expectedSellerBalance = dep - (dep * feeinPercent / 1000n);
      expect(sellerBalance).to.equal(expectedSellerBalance);
    });
    it("should warn users if giveWarningToSeller and giveWarningToBuyer are true", async function() {
      const mockTradeUrl = listingParams.tradeUrl;
      const affLink = ethers.encodeBytes32String("someRefCode");
      const sellerAddress = await seller.getAddress();
      const buyerAddress = await buyer.getAddress();
      await weth.connect(buyer).deposit({value: ethers.parseEther("1")});
      await weth.connect(buyer).approve(csxTrade.target, ethers.parseEther("1"));   
      await csxTrade.connect(buyer).commitBuy(mockTradeUrl, affLink, buyerAddress);
      await csxTrade.connect(seller).sellerTradeVeridict(true);
      await csxTrade.connect(seller).openDispute("Item not received");
      const status = await csxTrade.status();
      expect(status as number).to.equal(TradeStatus.Disputed);
      const isFavourOfBuyer = true;
      const isWithValue = true;
      const giveWarningToSeller = true;
      const giveWarningToBuyer = true;
      await csxTrade.connect(keeperNode).resolveDispute(isFavourOfBuyer, giveWarningToSeller, giveWarningToBuyer, isWithValue);
      const status2 = await csxTrade.status();
      expect(status2 as number).to.equal(TradeStatus.Clawbacked);
      const sellerBalance = await weth.balanceOf(sellerAddress);
      expect(sellerBalance).to.equal(ethers.parseEther("0"));
      const buyerBalance = await weth.balanceOf(buyerAddress);
      expect(buyerBalance).to.equal(ethers.parseEther("1"));
      const sellerData = await users.getUserData(sellerAddress);
      expect(sellerData.warnings).to.equal(1);
      expect(sellerData.reputationNeg).to.equal(3);
      const buyerData = await users.getUserData(buyerAddress);
      expect(buyerData.warnings).to.equal(1);
      expect(buyerData.reputationNeg).to.equal(3);
    });
  });
});
