import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { PaymentTokensStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";
import { listingParams } from "../../scripts/deploy/utils/list-demo";
import { CSXTrade } from "../../typechain-types";
import { InitParamsStruct } from "../../typechain-types/contracts/CSX/StakedCSX";

describe("Users", function () {
    let council: Signer,
    keeperNode: Signer,
    keeperUser: Signer,
    user1: Signer,
    user2: Signer,
    tradeAddress: Signer,
    deployer: Signer;

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
    tradeFactory: any;

    beforeEach(async function () {
        [deployer, council, keeperNode, keeperUser, user1, user2, tradeAddress] = await ethers.getSigners();

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
        keepers.connect(council).addKeeper(await keeperUser.getAddress());

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
        {weth: weth.target, usdc: usdc.target, usdt: usdt.target} as PaymentTokensStruct,
        referralRegistryInstance.target,
        scsx.target,
        buyAssistoor.target
        );
        await tradeFactory.waitForDeployment();
        await referralRegistryInstance.connect(council).changeContracts(tradeFactory.target, keepers.target);
        await users.connect(council).changeContracts(tradeFactory.target, keepers.target);
        await tradeFactoryBaseStorage.connect(council).init(tradeFactory.target);
    });

    describe("Managing Users", function () {
        it("should allow warning a user", async function () {
            await users.connect(keeperUser).warnUser(await user1.getAddress());
            const userData = await users.getUserData(await user1.getAddress());
            expect(Number(userData.warnings)).to.equal(1);
        });

        it("should allow banning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeperNode).banUser(await user.getAddress());
            const isBanned = await users.isBanned(await user.getAddress());
            expect(isBanned).to.be.true;
        });

        it("should allow unbanning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeperNode).banUser(await user.getAddress());
            const isBanned1st = await users.isBanned(await user.getAddress());
            expect(isBanned1st).to.be.true;
            await users.connect(keeperNode).unbanUser(await user.getAddress());
            const isBanned2nd = await users.isBanned(await user.getAddress());
            expect(isBanned2nd).to.be.false;
        });
    });

    describe("User Reputation", function () {
        it("should not be allowed to make rep without trade", async function () {
            const tradeAddress = `0x${"0".repeat(40)}`;
            const user = (await ethers.getSigners())[4];
            await expect(users.connect(user).repAfterTrade(tradeAddress, true)).to.be.revertedWithCustomError(users, "ZeroTradeAddress");
        });
        it("should be able to rep after trade", async function () {
            await tradeFactory.connect(user1).createListingContract(listingParams);
            const tradeAddress = await tradeFactoryBaseStorage.getTradeContractByIndex('0');
            const CSXTrade = await ethers.getContractFactory("CSXTrade");
            const csxTrade: CSXTrade = CSXTrade.attach(tradeAddress) as CSXTrade;

            const mockTradeUrl = listingParams.tradeUrl;
            const affLink = ethers.encodeBytes32String("someRefCode");
            await weth.connect(user2).deposit({value: ethers.parseEther("1")});
            await weth.connect(user2).approve(csxTrade.target, ethers.parseEther("1"));
            await csxTrade.connect(user2).commitBuy(mockTradeUrl, affLink, await user2.getAddress());
            await csxTrade.connect(user2).buyerConfirmReceived();

            await users.connect(user1).repAfterTrade(tradeAddress, true);
            const user2Data = await users.getUserData(await user2.getAddress());
            expect(Number(user2Data.reputationPos)).to.equal(1);
            const user1DataBefore = await users.getUserData(await user1.getAddress());
            expect(Number(user1DataBefore.reputationPos)).to.equal(0);
            await users.connect(user2).repAfterTrade(tradeAddress, false);
            const user1DataAfter = await users.getUserData(await user1.getAddress());
            expect(Number(user1DataAfter.reputationNeg)).to.equal(1);
            const _getUserTotalTradeUIs = await users.getUserTotalTradeUIs(await user2.getAddress());
            expect(Number(_getUserTotalTradeUIs)).to.equal(1);
            const _getUserTradeUIByIndex = await users.getUserTradeUIByIndex(await user2.getAddress(), 0);
            expect(_getUserTradeUIByIndex[0]).to.equal(tradeAddress);
            expect(_getUserTradeUIByIndex[1]).to.equal(0);
            expect(_getUserTradeUIByIndex[2]).to.equal(6);
            const _hasMadeRepOnTrade = await users.hasMadeRepOnTrade(tradeAddress);
            expect(_hasMadeRepOnTrade[0]).to.be.true;
            expect(_hasMadeRepOnTrade[1]).to.be.true;
            expect(_hasMadeRepOnTrade[2]).to.be.true;
        });
    });

    describe("Asset ID Operations", async function () {
        const assetId = "uniqueAssetId";
        const assetId2 = "GG1";

        await users.connect(tradeFactory).setAssetIdUsed(assetId, await user1.getAddress(), await tradeAddress.getAddress());

        it("should check that an asset is not already listed", async function () {
            const hasListed = await users.hasAlreadyListedItem(assetId2, await user1.getAddress());
            expect(hasListed).to.be.false;
        });

        it("should check that an asset is already listed", async function () {
            const hasListed = await users.hasAlreadyListedItem(assetId, await user1.getAddress());
            expect(hasListed).to.be.true;
        });

        it("Should not be able to setAssetIdUsed if not factory", async function () {
            await expect(users.connect(user1).setAssetIdUsed(assetId, await user1.getAddress(), await tradeAddress.getAddress())).to.be.revertedWithCustomError(users, "NotFactory");
        });
    });
});
