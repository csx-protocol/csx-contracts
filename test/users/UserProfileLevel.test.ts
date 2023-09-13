import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("UserProfileLevel", function () {
    let userProfileLevelInstance: any;
    let csxTokenInstance: any;

    let deployer: Signer;
    let user1: Signer;
    let user2: Signer;
    let user3: Signer;

    beforeEach(async function () {
        [deployer, user1, user2, user3] = await ethers.getSigners();

        const CSXToken = await ethers.getContractFactory("CSXToken");
        csxTokenInstance = await CSXToken.deploy();
        await csxTokenInstance.waitForDeployment();

        const UserProfileLevel = await ethers.getContractFactory("UserProfileLevel");
        userProfileLevelInstance = await UserProfileLevel.deploy(csxTokenInstance.target);
        await userProfileLevelInstance.waitForDeployment();

        await csxTokenInstance.transfer(await user1.getAddress(), ethers.parseEther('40000000'));
        await csxTokenInstance.transfer(await user2.getAddress(), ethers.parseEther('40000000'));

        await csxTokenInstance.connect(user1).approve(userProfileLevelInstance.target, ethers.parseEther('40000000'));
        await csxTokenInstance.connect(user2).approve(userProfileLevelInstance.target, ethers.parseEther('40000000'));
    });

    describe("Level Up", function() {
        it("allows a user to level up", async function () {
            const tokenAmount = ethers.parseEther('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);

            const userLevel: number = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            expect(userLevel).to.equal(1);
        });

        it("checks the cost of leveling up", async function () {
            const tokenAmount = ethers.parseEther('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);

            const userLevel: number = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
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
    
            await csxTokenInstance.transfer(await user1.getAddress(), totalTokenAmount);
            await csxTokenInstance.connect(user1).approve(userProfileLevelInstance.target, totalTokenAmount);
            await userProfileLevelInstance.connect(user1).levelUp(totalTokenAmount, levelsToIncrease);
        
            const userLevel: number = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            expect(userLevel).to.equal(targetLevel);
            const user1Balance: number = await csxTokenInstance.balanceOf(await user1.getAddress());
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

    describe("Transfer Profile", function () {
        beforeEach(async function() {
            const tokenAmount = ethers.parseEther('15');
            const levelsToIncrease = 5;
            await userProfileLevelInstance.connect(user1).levelUp(tokenAmount, levelsToIncrease);
        });

        it("transfers the user profile to another address", async function () {
            await userProfileLevelInstance.connect(user1).transferProfile(await user2.getAddress());

            const user1Level: number = await userProfileLevelInstance.getUserLevel(await user1.getAddress());
            const user2Level: number = await userProfileLevelInstance.getUserLevel(await user2.getAddress());

            expect(user1Level).to.equal(0);
            expect(user2Level).to.equal(5);
        });

        it("reverts when trying to transfer profile to an address with non-zero levels", async function () {
            const tokenAmount = ethers.parseEther('1');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.connect(user2).levelUp(tokenAmount, levelsToIncrease);

            await expect(userProfileLevelInstance.connect(user1).transferProfile(await user2.getAddress()))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "NewAddressHasLevels");
        });

        it("reverts when trying to transfer profile to the zero address", async function () {
            await expect(userProfileLevelInstance.connect(user1).transferProfile('0x0000000000000000000000000000000000000000'))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "InvalidNewAddress");
        });

        it("reverts when trying to transfer profile to the same address as the sender", async function () {
            await expect(userProfileLevelInstance.connect(user1).transferProfile(await user1.getAddress()))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "NewAddressHasLevels");
        });

        it("reverts when trying to transfer profile with zero levels", async function () {
            await expect(userProfileLevelInstance.connect(user2).transferProfile(await user3.getAddress()))
                .to.be.revertedWithCustomError(userProfileLevelInstance, "SenderHasNoLevels");
        });
    });

});
