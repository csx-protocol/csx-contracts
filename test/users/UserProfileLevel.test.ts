import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { BuyAssistoor, CSXToken, CSXTradeFactory, Keepers, ReferralRegistry, StakedCSX, TradeFactoryBaseStorage, UserProfileLevel, Users } from "../../typechain-types";
import { PaymentTokensStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";

describe("UserProfileLevel", function () {
    let userProfileLevelInstance: UserProfileLevel;
    let referralRegistryInstance: ReferralRegistry;
    let csx: CSXToken;
    let scsx: StakedCSX;
    let users: Users;
    let keepers: Keepers;
    let buyAssistoor: BuyAssistoor;
    let weth: any,
        usdc: any,
        usdt: any;
    let tradeFactoryBaseStorage: TradeFactoryBaseStorage;
    let tradeFactory: CSXTradeFactory;

    let deployer: Signer;
    let council: Signer;
    let keeperNode: Signer;
    let user1: Signer;
    let user2: Signer;
    let user3: Signer;

    beforeEach(async function () {
        [deployer, council, keeperNode, user1, user2, user3] = await ethers.getSigners();

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

        const StakedCSX = await ethers.getContractFactory("StakedCSX");
        scsx = await StakedCSX.deploy(csx.target, weth.target, usdc.target, usdt.target, keepers.target);
        await scsx.waitForDeployment();

        const Users = await ethers.getContractFactory("Users");
        users = await Users.deploy(keepers.target);
        await users.waitForDeployment();        

        const UserProfileLevel = await ethers.getContractFactory("UserProfileLevel");
        userProfileLevelInstance = await UserProfileLevel.deploy(csx.target, users.target, keepers.target);
        await userProfileLevelInstance.waitForDeployment();

        const BuyAssistoor = await ethers.getContractFactory("BuyAssistoor");
        buyAssistoor = await BuyAssistoor.deploy(weth.target);
        await buyAssistoor.waitForDeployment();

        const TradeFactoryBaseStorage = await ethers.getContractFactory("TradeFactoryBaseStorage");
        tradeFactoryBaseStorage = await TradeFactoryBaseStorage.deploy(keepers.target, users.target);
        await tradeFactoryBaseStorage.waitForDeployment();

        const ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
        referralRegistryInstance = await ReferralRegistry.deploy(keepers.target);
        await referralRegistryInstance.waitForDeployment();

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

        await csx.transfer(await user1.getAddress(), ethers.parseEther('40000000'));
        await csx.transfer(await user2.getAddress(), ethers.parseEther('40000000'));

        await csx.connect(user1).approve(userProfileLevelInstance.target, ethers.parseEther('40000000'));
        await csx.connect(user2).approve(userProfileLevelInstance.target, ethers.parseEther('40000000'));
    });

    describe("Level Up", function() {
        it("allows a user to level up", async function () {
            const tokenAmount = ethers.parseEther('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);

            const userLevel = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            expect(userLevel).to.equal(1);
        });

        it("checks the cost of leveling up", async function () {
            const tokenAmount = ethers.parseEther('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);

            const userLevel = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            const costForNextLevel = await userProfileLevelInstance.getCostForNextLevels(await user1.getAddress(), 1);
            const expectedCost = await userProfileLevelInstance.getLevelUpCost(userLevel, 1);
            expect(costForNextLevel).to.equal(expectedCost);
        });

        it("reverts when trying to level up with insufficient tokens", async function () {
            const tokenAmount = ethers.parseEther('0.1');
            const levelsToIncrease = 1;
            await expect(userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "InsufficientTokens");
        });
    
        it("reverts when trying to level up with 0 levels", async function () {
            const tokenAmount = ethers.parseEther('10');
            const levelsToIncrease = 0;
            await expect(userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "ZeroLevels");
        });
    
        it("levels up a user from 0 to 100 all at once", async function () {
            const currentLevel = Number(0);
            const targetLevel = Number(100);
            const levelsToIncrease = targetLevel - currentLevel;
        
            const totalTokenAmount = await userProfileLevelInstance.getLevelUpCost(currentLevel, levelsToIncrease);
    
            await csx.transfer(await user1.getAddress(), totalTokenAmount);
            await csx.connect(user1).approve(userProfileLevelInstance.target, totalTokenAmount);
            await userProfileLevelInstance.connect(user1).levelUp(totalTokenAmount, levelsToIncrease);
        
            const userLevel = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            expect(userLevel).to.equal(targetLevel);
            const user1Balance = await csx.balanceOf(await user1.getAddress());
            expect(user1Balance).to.gte(0);
        });

        it("levels up a user from 0 to 100 in 10 steps", async function () {
            const currentLevel = Number(0);
            const targetLevel = Number(100);
            const levelsToIncrease = 100;
        
            const totalTokenAmount = await userProfileLevelInstance.getLevelUpCost(currentLevel, levelsToIncrease);
    
            await csx.transfer(await user1.getAddress(), totalTokenAmount);
            await csx.connect(user1).approve(userProfileLevelInstance.target, totalTokenAmount);
            for (let i = 0; i < 10; i++) {
                const tknAmount = await userProfileLevelInstance.getLevelUpCost(i*10, 10);
                await userProfileLevelInstance.connect(user1).levelUp(tknAmount, 10);               
            }

            const userLevel = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            expect(userLevel).to.equal(targetLevel);
            const user1Balance = await csx.balanceOf(await user1.getAddress());
            expect(user1Balance).to.gte(0);
        });
    });

    describe("User Data", function () {
        beforeEach(async function() {
            const tokenAmount = ethers.parseEther('15');
            const levelsToIncrease = 5;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);
        });

        it("returns the correct user data", async function() {
            const userData = await userProfileLevelInstance.getUserData(await user1.getAddress());
            const userLevel = userData[0].toString();
            const costForNextLevel = userData[1].toString();
            const costForNext5Levels = userData[2].toString();
            const costForNext10Levels = userData[3].toString();

            expect(userLevel).to.equal('5');

            const expectedCostForNextLevel = await userProfileLevelInstance.getLevelUpCost(userLevel, 1);
            const expectedCostForNext5Levels = await userProfileLevelInstance.getLevelUpCost(userLevel, 5);
            const expectedCostForNext10Levels = await userProfileLevelInstance.getLevelUpCost(userLevel, 10);

            expect(costForNextLevel).to.equal(expectedCostForNextLevel);
            expect(costForNext5Levels).to.equal(expectedCostForNext5Levels);
            expect(costForNext10Levels).to.equal(expectedCostForNext10Levels);
        });
    });
});
