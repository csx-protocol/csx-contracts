import { USDCToken, USDTToken, WETH9Mock } from "../../typechain-types/contracts/CSX/mock";
import { CSXToken } from "../../typechain-types/contracts/CSX";
import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { Keepers, StakedCSX } from "../../typechain-types";
import { InitParamsStruct } from "../../typechain-types/contracts/CSX/StakedCSX";

describe("Staking", function () {
    let CSXToken: CSXToken;
    let USDCToken: USDCToken;
    let USDTToken: USDTToken;
    let WETHToken: WETH9Mock;
    let keepers: Keepers;
    let staking: StakedCSX;
    let deployer: Signer;
    let keeperNode: Signer;
    let council: Signer;
    let user1: Signer;
    let user2: Signer;
    let potentialStakers: Signer[];
    const DAY = 86400;
    const IS_WITH_LOGS = false;  

    beforeEach(async function () {
        [deployer, keeperNode, council, user1, user2, ...potentialStakers] = await ethers.getSigners();
    
        const StakingToken = await ethers.getContractFactory("CSXToken");
        CSXToken = (await StakingToken.deploy()) as CSXToken;
        await CSXToken.waitForDeployment();
     
        const RewardTokenUSDC = await ethers.getContractFactory("USDCToken");
        USDCToken = (await RewardTokenUSDC.deploy()) as USDCToken;
        await USDCToken.waitForDeployment();

        const RewardTokenUSDT = await ethers.getContractFactory("USDTToken");
        USDTToken = (await RewardTokenUSDT.deploy()) as USDTToken;
        await USDTToken.waitForDeployment();

        const RewardTokenWETH = await ethers.getContractFactory("WETH9Mock");
        WETHToken = (await RewardTokenWETH.deploy()) as WETH9Mock;

        const Keepers = await ethers.getContractFactory("Keepers");
        keepers = await Keepers.deploy(await council.getAddress(), await keeperNode.getAddress()) as Keepers;
        await keepers.waitForDeployment();
    
        const Staking = await ethers.getContractFactory("StakedCSX");

        const init: InitParamsStruct = {
            KEEPERS_INTERFACE: keepers.target,
            TOKEN_CSX: CSXToken.target,
            TOKEN_WETH: WETHToken.target,
            TOKEN_USDC: USDCToken.target,
            TOKEN_USDT: USDTToken.target,
          };

        staking = (await Staking.deploy(init)) as StakedCSX;

        await staking.waitForDeployment();
    });

    describe("StakedCSX Tests >", function () { 
        // Tests for stake function
        describe("Stake Function", function () {
            const stakeAmountBN = ethers.parseEther("100");
            const stakeAmountNumber = 100;
            const duration = 8 * DAY;
            it("should take users's CSX for sCSX", async function () {                
                await userStake(user1, stakeAmountNumber);
                const userSCSXBalance = await staking.balanceOf(await user1.getAddress());
                const userCSXBalance = await CSXToken.balanceOf(await user1.getAddress());
                expect(userSCSXBalance).to.be.equal(stakeAmountBN, "userSCSXBalance should be equal to stakeAmount");
                expect(userCSXBalance).to.be.equal(0, "userCSXBalance should be equal to 0");
            });
            it("should update rewards correctly when user stakes more", async function () {
                await userStake(user1, stakeAmountNumber);
                await userStake(user2, stakeAmountNumber);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(duration / 2);
                await userStake(user1, stakeAmountNumber*2);
                // After half the time of 100 CSX vs 100 CSX (50/50 split),
                // user1 now stakes 200 CSX more, total 300 CSX vs 100 CSX from user2 (75/25 split).
                await fastForwardTime(duration / 2);
                // After the full time of
                // first half of 100 CSX vs 100 CSX (50/50 split),
                // plus second half of 300 CSX vs 100 CSX (75/25 split)
                // user1 should have around 60% of the rewards
                // user2 should have around 40% of the rewards
                const earnedByUser1 = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const earnedByUser2 = await staking.connect(user2).earned(await user2.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                // user 1 should have around 60% of the rewards
                expect(earnedByUser1).to.be.closeTo(ethers.parseUnits("600", 6), ethers.parseUnits(mayDeviateWith.toString(), 6), "earnedByUser1 should be close to 600 USDC");
                // user 2 should have around 40% of the rewards
                expect(earnedByUser2).to.be.closeTo(ethers.parseUnits("400", 6), ethers.parseUnits(mayDeviateWith.toString(), 6), "earnedByUser2 should be close to 400 USDC");
            });
            it("should not continue to accrue rewards after sCSX has been transfered", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6, 8 * DAY);
                await fastForwardTime(4 * DAY);
                await staking.connect(user1).transfer(await user2.getAddress(), ethers.parseEther("100"));
                await fastForwardTime(4 * DAY);
                const earnedByUser1 = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const earnedByUser2 = await staking.connect(user2).earned(await user2.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                expect(earnedByUser1).to.be.closeTo(ethers.parseUnits("1000", 6) / 2n, ethers.parseUnits((mayDeviateWith).toString(), 6), "earnedByUser1 should be close to half of the reward amount");
                expect(earnedByUser2).to.be.closeTo(ethers.parseUnits("1000", 6) / 2n, ethers.parseUnits((mayDeviateWith).toString(), 6), "earnedByUser2 should be close to half of the reward amount");
            });
            it("should update rewards when user claim rewards", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(100, 6, 8 * DAY);
                await fastForwardTime(8 * DAY);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                const userRewardPerTokenPaid = await staking.userRewardPerTokenPaid(await user1.getAddress(), USDCToken.target);
                expect(userRewardPerTokenPaid).to.be.equal(0, "userRewardPerTokenPaid should be 0");
                const earnedByUser1 = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                expect(earnedByUser1).to.be.closeTo(ethers.parseUnits("100", 6), ethers.parseUnits((mayDeviateWith).toString(), 6), "earnedByUser1 should be close to 1000 USDC");
                await claimReward(user1, USDCToken.target, false);
                const userRewardPerTokenPaidAfter = await staking.userRewardPerTokenPaid(await user1.getAddress(), USDCToken.target);
                const userRewardPerTokenPaidAfterAdjusted = (userRewardPerTokenPaidAfter / (10n**12n)) / 10n;
                const mayDeviateAdjusted = ethers.parseUnits((mayDeviateWith).toString(), 6);
                expect(userRewardPerTokenPaidAfterAdjusted).to.be.closeTo(ethers.parseUnits("100", 6), mayDeviateAdjusted, "userRewardPerTokenPaidAfter should be close to 1000 USDC");
                const earnedByUser1After = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                expect(earnedByUser1After).to.be.equal(0, "earnedByUser1After should be equal to 0");
                const user1USDCBalance = await USDCToken.balanceOf(await user1.getAddress());
                expect(user1USDCBalance).to.be.equal(earnedByUser1, "user1USDCBalance should be equal to earnedByUser1");
            });
            it("should not lose pending rewards on each call to stake",async () => {
                await userStake(user1, 1000);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const unclaimedRewardsBefore = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points   
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                expect(unclaimedRewardsBefore).to.be.closeTo(ethers.parseUnits("1000", 6), ethers.parseUnits(mayDeviateWith.toString(), 6), "unclaimedRewardsBefore should be equal to 1000 USDC");
                await userStake(user1, 1000);                
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await userStake(user1, 1000);   
                await fastForwardTime(7 * DAY);
                const unclaimedRewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);               
                expect(unclaimedRewardsAfter).to.be.closeTo(ethers.parseUnits("2000", 6), ethers.parseUnits((mayDeviateWith*2).toString(), 6), "unclaimedRewardsAfter should be equal to 2000 USDC");
                await claimReward(user1, USDCToken.target, false);
                const user1USDCBalance = await USDCToken.balanceOf(await user1.getAddress());
                expect(user1USDCBalance).to.be.closeTo(ethers.parseUnits("2000", 6), ethers.parseUnits((mayDeviateWith*2).toString(), 6), "user1USDCBalance should be equal to 2000 USDC");
            });
        });
    
        // Tests for unstake function
        describe("UnStake Function", function () {
            it("should burn user's sCSX in return of CSX", async function () {
                await userStake(user1, 100);
                await staking.connect(user1).unStake(ethers.parseEther("100"));
                const userSCSXBalanceAfter = await staking.balanceOf(await user1.getAddress());
                const userCSXBalanceAfter = await CSXToken.balanceOf(await user1.getAddress());
                expect(userSCSXBalanceAfter).to.be.equal(ethers.parseEther("0"), "userSCSXBalanceBefore should be equal to 0 sCSX");
                expect(userCSXBalanceAfter).to.be.equal(ethers.parseEther("100"), "userCSXBalanceBefore should be equal to 100 CSX");
            });
            it("should update rewards when user unstakes", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const rewards = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                await staking.connect(user1).unStake(ethers.parseEther("100"));
                const rewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                expect(rewards).to.be.equal(rewardsAfter, "rewards should be equal");
            });
            it("should not continue to accrue rewards for user after unstaked", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6, 8 * DAY);
                await fastForwardTime(4 * DAY);
                await staking.connect(user1).unStake(ethers.parseEther("100"));
                await fastForwardTime(4 * DAY);
                const earnedByUser1 = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                expect(earnedByUser1).to.be.closeTo(ethers.parseUnits("1000", 6) / 2n, ethers.parseUnits((mayDeviateWith).toString(), 6), "earnedByUser1 should be close to half of the reward amount");
            });
        });
    
        // Tests for claim function
        describe("Claim Function", function () {
            it("should update rewards when user gets reward", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const rewards = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                await claimReward(user1, USDCToken.target, false);
                const rewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);

                expect(rewards).to.be.closeTo(ethers.parseUnits("1000", 6), ethers.parseUnits(mayDeviateWith.toString(), 6), "rewards should be close to 1000 USDC");
                expect(rewardsAfter).to.be.equal(0, "rewards should be zero");
            });
            it("should update rewards when user gets reward with WETH with convert", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 18);
                await fastForwardTime(7 * DAY);
                const rewards = await staking.connect(user1).earned(await user1.getAddress(), WETHToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                await claimReward(user1, WETHToken.target, true);
                const rewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), WETHToken.target);

                expect(rewards).to.be.closeTo(ethers.parseUnits("1000", 18), ethers.parseUnits(mayDeviateWith.toString(), 18), "rewards should be close to 1000 WETH");
                expect(rewardsAfter).to.be.equal(0, "rewards should be zero");

                const user1ETHBalance = await ethers.provider.getBalance(await user1.getAddress());
                expect(user1ETHBalance).to.be.closeTo(ethers.parseUnits("11000", 18), ethers.parseUnits(mayDeviateWith.toString(), 18), "user1ETHBalance should be close to 11000 ETH");
            });
            it("should update rewards when user gets reward with WETH without convert", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 18);
                await fastForwardTime(7 * DAY);
                const rewards = await staking.connect(user1).earned(await user1.getAddress(), WETHToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                await claimReward(user1, WETHToken.target, false);
                const rewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), WETHToken.target);

                expect(rewards).to.be.closeTo(ethers.parseUnits("1000", 18), ethers.parseUnits(mayDeviateWith.toString(), 18), "rewards should be equal to 1000 WETH");
                expect(rewardsAfter).to.be.equal(0, "rewards should be zero");

                const user1WETHBalance = await WETHToken.balanceOf(await user1.getAddress());
                expect(user1WETHBalance).to.be.closeTo(ethers.parseUnits("1000", 18), ethers.parseUnits(mayDeviateWith.toString(), 18), "user1WETHBalance should be equal to 1000 WETH");
            });
        });
    
        // Tests for setRewardsDuration function
        describe("Set Rewards Duration Function", function () {
            it("should set rewards duration correctly", async function () {
                await userStake(user1, 100);
                await staking.connect(council).setRewardsDuration(7 * DAY, USDCToken.target);                
                const duration = await staking.duration(USDCToken.target);
                expect(duration).to.be.equal(7 * DAY, "duration should be equal to 7 days");
            });
        });
    
        // Tests for notifyRewardAmount function
        describe("Notify Reward Amount Function", function () {
            it("should handle rewards correctly when notifying reward amount", async function () {
                // Test case logic here
                await depositDividendAndSetRewardsDurOnly(1000, 6);
                const infoBeforeNotifyRewardAmount = await contractInfo(USDCToken.target, user1);
                await staking.connect(council).notifyRewardAmount(ethers.parseUnits("1000", 6), USDCToken.target);
                const infoAfterNotifyRewardAmount = await contractInfo(USDCToken.target, user1);
                
                const shouldBeRewardRate = ethers.parseUnits("1000", 6) / BigInt(infoBeforeNotifyRewardAmount.duration); //amount / duration;
                expect(shouldBeRewardRate).to.be.equal(infoAfterNotifyRewardAmount.rewardRate, "rewardRate should match");

                expect(infoBeforeNotifyRewardAmount.nonDistributedRewardsPerToken).to.be.equal(ethers.parseUnits("1000", 6), "nonDistributedRewardsPerTokenBefore should be equal to 1k USDC");
                expect(infoAfterNotifyRewardAmount.nonDistributedRewardsPerToken).to.be.equal('0', "nonDistributedRewardsPerTokenAfter should be equal to 0 USDC");
                
                expect(infoBeforeNotifyRewardAmount.finishAt).to.be.equal('0', "rewardPerTokenPaidBefore should be equal to 0");
                
                expect(infoBeforeNotifyRewardAmount.updatedAt).to.be.equal('0', "rewardPerTokenPaidBefore should be equal to 0");
                expect(infoBeforeNotifyRewardAmount.rewardPerTokenStored).to.be.equal('0', "rewardPerTokenPaidBefore should be equal to 0");
                expect(infoAfterNotifyRewardAmount.finishAt).to.be.equal(BigInt(infoAfterNotifyRewardAmount.duration) + BigInt(infoAfterNotifyRewardAmount.updatedAt), "rewardPerTokenPaidAfter should be equal to duration + updatedAt");
            });
            it("should handle rewards correctly when notifying during same period", async function () {
                await depositDividendSetRewardDurAndNotify(1000, 6, 8 * DAY);
                await fastForwardTime(4 * DAY);        
                
                const infoBeforeDepositDividend = await contractInfo(USDCToken.target, user1);
                await USDCToken.connect(deployer).approve(staking.target, ethers.parseUnits("1000", 6));
                
                await staking.connect(deployer).depositDividend(USDCToken.target, ethers.parseUnits("1000", 6));
                await staking.connect(council).notifyRewardAmount(ethers.parseUnits("1000", 6), USDCToken.target);
                
                const blockTimeStamp = await ethers.provider.getBlock('latest').then(block => block!.timestamp);
                const infoAfterDepositDividend = await contractInfo(USDCToken.target, user1);

                const expectRewardRate = 
                (ethers.parseUnits("1000", 6) + ((BigInt(infoBeforeDepositDividend.finishAt) - BigInt(blockTimeStamp)) * BigInt(infoBeforeDepositDividend.rewardRate))) / BigInt(infoBeforeDepositDividend.duration);
                expect(expectRewardRate).to.be.equal(infoAfterDepositDividend.rewardRate, "rewardRate should match");                
            });
            it("should handle rewards correctly when notifying once per period", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const rewardsAfterFirstPeriod = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                const deviationPercentage = 800; // 0.80% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (1000 * deviationPercentage) / basisPointDivisor; // 0.80% of reward amount
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const rewardsAfterSecondPeriod = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                await claimReward(user1, USDCToken.target, false);
                const user1USDCBalance = await USDCToken.balanceOf(await user1.getAddress());
                expect(rewardsAfterFirstPeriod+(rewardsAfterSecondPeriod-rewardsAfterFirstPeriod)).to.be.equal(user1USDCBalance, "rewards should be equal to user1USDCBalance");
            });
        });
    
        // Tests for depositDividend function
        describe("Deposit Dividend Function", function () {
            it("should handle rewards correctly when depositing dividend", async function () {
                await depositDividendSetRewardDurAndNotify(1000, 6, 8 * DAY);
                await fastForwardTime(4 * DAY);
                
                await USDCToken.connect(deployer).approve(staking.target, ethers.parseUnits("1000", 6));
                
                await staking.connect(deployer).depositDividend(USDCToken.target, ethers.parseUnits("1000", 6));
                const infoAfterDepositDividend = await contractInfo(USDCToken.target, user1);
                expect(infoAfterDepositDividend.nonDistributedRewardsPerToken).to.be.equal(ethers.parseUnits("1000", 6), "nonDistributedRewardsPerTokenBefore should be equal to 1k USDC");

                await staking.connect(council).notifyRewardAmount(ethers.parseUnits("1000", 6), USDCToken.target);
                const infoAfterNotifyRewardAmount = await contractInfo(USDCToken.target, user1);
                expect(infoAfterNotifyRewardAmount.nonDistributedRewardsPerToken).to.be.equal('0', "nonDistributedRewardsPerTokenAfter should be equal to 0 USDC");             

                expect(infoAfterDepositDividend.nonDistributedRewardsPerToken).to.be.equal(ethers.parseUnits("1000", 6), "nonDistributedRewardsPerTokenBefore should be equal to 1k USDC");
                expect(infoAfterNotifyRewardAmount.usdcBalance).to.be.equal(ethers.parseUnits("2000", 6), "usdcBalance should be equal to 2000 USDC");
                expect(infoAfterNotifyRewardAmount.nonDistributedRewardsPerToken).to.be.equal(ethers.parseUnits("0", 6), "nonDistributedRewardsPerTokenAfter should be equal to 0 USDC");
            });
        });

        // Tests for alternative rewards distribution
        describe("Using ERC20::transfer instead of StakedCSX::depositDividend", () => {
            it("It should not revert for notifying rewards that exceeds nonDistributedRewardsPerToken", async () => {
                // Transfers rewards with ERC20(_token)::transfer function instead of StakedCSX::depositDividend()
                // Should be possible to notify rewards that exceeds nonDistributedRewardsPerToken
                // This is mainly to ensure rounded error rewards on notifyRewardAmount() is not lost and can be re-notified
                // But also allows transfer of rewards by interacting with the reward ERC20token contract only.
                await userStake(user1, 500, false);
                await transferRewardsAndSetRewardsDurOnly(500, 6);
                await expect(staking.connect(council).notifyRewardAmount(ethers.parseUnits("500", 6), USDCToken.target)).to.emit(staking, "Distribute");
            });
            it("It should revert for notifying rewards that exceeds contract balance", async () => {
                // Transfers rewards with ERC20(_token)::transfer function instead of StakedCSX::depositDividend()
                // Should be possible to notify rewards that exceeds nonDistributedRewardsPerToken
                // This is mainly to ensure rounded error rewards on notifyRewardAmount() is not lost and can be re-notified
                // But also allows transfer of rewards by interacting with the reward ERC20token contract only.
                await userStake(user1, 500, false);
                await transferRewardsAndSetRewardsDurOnly(500, 6);
                await expect(staking.connect(council).notifyRewardAmount(ethers.parseUnits("1000", 6), USDCToken.target)).to.be.revertedWithCustomError(staking, "RewardAmountExceedsBalance");
            });
            it("It should revert for notifying rewards that has not exceeded contract balance but exceeds the balance after rewards that has already been notified in the same period", async () => {
                // Transfers rewards with ERC20(_token)::transfer function instead of StakedCSX::depositDividend()
                // Should be possible to notify rewards that exceeds nonDistributedRewardsPerToken
                // This is mainly to ensure rounded error rewards on notifyRewardAmount() is not lost and can be re-notified
                // But also allows transfer of rewards by interacting with the reward ERC20token contract only.
                await userStake(user1, 500, false);
                // Sends 1000 USDC & notifies the reward
                await transferRewardsSetRewardDurAndNotify(1000, 6);
                // Sends additional 500 USDC during the same reward duration but does not notify the reward
                await USDCToken.connect(deployer).transfer(staking.target, ethers.parseUnits("500", 6));
                // Total contract balance is now 1500 USDC, 1000 USDC has been notified and 500 USDC has not been notified
                const contractBalance = await USDCToken.balanceOf(staking.target);
                expect(contractBalance).to.be.equal(ethers.parseUnits("1500", 6), "contractBalance should be equal to 1500 USDC");
                // Should revert when trying to notify 600 USDCToken
                await expect(staking.connect(council).notifyRewardAmount(ethers.parseUnits("600", 6), USDCToken.target)).to.be.revertedWithCustomError(staking, "RewardAmountExceedsBalance");
                // Should emit event when notifying 500 USDCToken (remaining balance non notified balance)
                await expect(staking.connect(council).notifyRewardAmount(ethers.parseUnits("500", 6), USDCToken.target)).to.emit(staking, "Distribute");
            });
        });

        // Tests for transfers combined with rewards
        describe("ERC20 Transfer/From Function", function () {
            it("should handle earned rewards correctly when transfering sCSX", async function () {
                await userStake(user1, 100);
                await depositDividendSetRewardDurAndNotify(1000, 6);
                await fastForwardTime(7 * DAY);
                const rewards = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);

                await staking.connect(user1).transfer(await user2.getAddress(), ethers.parseEther("100"));

                const rewardsAfter = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                expect(rewards).to.be.equal(rewardsAfter, "rewards should be equal");

                const user2SCSXBalance = await staking.balanceOf(await user2.getAddress());
                const user2Earned = await staking.connect(user2).earned(await user2.getAddress(), USDCToken.target);
                
                expect(user2SCSXBalance).to.be.equal(ethers.parseEther("100"), "user2SCSXBalance should be equal to 100 sCSX");
                expect(user2Earned).to.be.equal(0, "user2Earned should be equal to 0");
            });
            it("should handle sCSX token transfers and reward claims correctly", async function () {
                const duration = 8 * DAY;
                let rewardAmount = ethers.parseUnits("1000", 6); // Assuming USDC has 6 decimals
                let stakeAmount = ethers.parseUnits("100", 18); // Assuming CSX has 18 decimals
                const zeroAmount18 = ethers.parseUnits("0", 18);
                const zeroAmount6 = ethers.parseUnits("0", 6);

                // Function to test with different time splits
                // -> User1 stakes CSX tokens,
                // -> Contract receives rewards,
                // -> Council sets duration and notifies the reward,
                // -> Forward first half of duration to simulate staking duration.
                // -> User1 transfers sCSX to User2,
                // -> Forward second half of duration to simulate staking duration.
                // -> User1 and User2 claim rewards.
                // -> Check that User1 and User2 have the correct amount of USDC & sCSX.
                // -> "Clear state" for next test case.
                const testWithTimeSplits = async (firstSplitPercentage: number, secondSplitPercentage: number, _user1: Signer, _user2: Signer, _logs?: boolean, _index?: number) => {
                    const index = _index == undefined ? 0 : _index;
                    const _STAKE_AMOUNT_IN_NUMBER = parseInt(ethers.formatUnits(stakeAmount, 18));
                    const _REWARD_AMOUNT_IN_NUMBER = parseInt(ethers.formatUnits(rewardAmount, 6));
                    if (firstSplitPercentage + secondSplitPercentage != 100) throw new Error("Time splits must add up to 100");
                    if (_logs) console.log("__________________________________________________________");
                    if (_logs) console.log(`Testing with time splits ${firstSplitPercentage}% and ${secondSplitPercentage}%, index: ${index}`);
                    if (_logs) console.log("__________________________________________________________");
                    // User1 stakes CSX tokens, receives sCSX tokens.
                    await userStake(_user1, _STAKE_AMOUNT_IN_NUMBER, _logs);
                    // Council/Deployer transfers reward to staking contract, sets duration and notifies the reward.
                    await depositDividendSetRewardDurAndNotify(_REWARD_AMOUNT_IN_NUMBER, 6, duration, _logs);
                    // Forward time to simulate staking duration
                    const firstDuration = (duration * firstSplitPercentage) / 100;
                    await fastForwardTime(firstDuration, _logs);
        
                    // Perform checks and actions here for the first time split, before transfer.
                    const earnedByUser1BeforeTransfer = await staking.connect(_user1).earned(await _user1.getAddress(), USDCToken.target); 
                    const deviationPercentage = 530n; // 0.53% in basis points
                    const basisPointDivisor = 100_000n; // Basis points divisor for 6 decimal places
                    const mayDeviateWith = (rewardAmount * deviationPercentage) / basisPointDivisor; // 0.53% of reward amount
                    const actualDeviation = Math.abs(Number(earnedByUser1BeforeTransfer) - ((Number(rewardAmount) * firstSplitPercentage) / 100));
                    const actualDeviationPercentage = (actualDeviation / Number(rewardAmount)) * 100;
                    if (_logs) console.log(`Rounding Error Deviation Check\nActual: ${actualDeviation} (${actualDeviationPercentage}%)\nMax Accepted: ${mayDeviateWith} (${Number(deviationPercentage) / 1000}%)`);
                    expect(earnedByUser1BeforeTransfer).to.be.closeTo((rewardAmount * BigInt(firstSplitPercentage)) / 100n, mayDeviateWith, `earnedByUser1 should be close to reward amount's first split (Index: ${index})`);
        
                    // -- Transfer sCSX to user2 --
                    if (_logs) console.log("__________________________________________________________");
                    if (_logs) console.log(`Transfering ${stakeAmount} sCSX tokens`);
                    if (_logs) console.log("From", await _user1.getAddress());
                    if (_logs) console.log("To", await _user2.getAddress());
                    await staking.connect(_user1).transfer(await _user2.getAddress(), stakeAmount);
                    if (_logs) console.log("__________________________________________________________");
                    // ----------------------------

                    // Check directly after user1 transfers sCSX to user2 that user2 does not inherit any rewards from the transfer.
                    const earnedByUser2DirectlyAfter = await staking.connect(_user2).earned(await _user2.getAddress(), USDCToken.target);
                    if (_logs) console.log("earnedByUser2 directly after transfer", earnedByUser2DirectlyAfter.toString());
                    expect(earnedByUser2DirectlyAfter).to.be.equal(zeroAmount6, `earnedByUser2 should be equal to 0 USDC (Index: ${index})`);

                    // Forward time to simulate staking duration
                    const secondDuration = (duration * secondSplitPercentage) / 100;
                    await fastForwardTime(secondDuration, _logs);

                    // Perform checks and actions here for the second time split
                    // Using the same deviation percentage and basis point divisor as before
                    // Checking that user1's earned amount is close to the first split amount (not changed after transfer)
                    // Checking that user2's earned amount is close to the second split amount
                    const earnedByUser1AfterTransfer = await staking.connect(_user1).earned(await _user1.getAddress(), USDCToken.target);
                    const earnedByUser2AfterTransfer = await staking.connect(_user2).earned(await _user2.getAddress(), USDCToken.target);
                    if (_logs) console.log("earnedByUser1 after transfer", earnedByUser1AfterTransfer.toString());
                    if (_logs) console.log("earnedByUser2 after transfer", earnedByUser2AfterTransfer.toString());
                    expect(earnedByUser1AfterTransfer).to.be.closeTo((rewardAmount * BigInt(firstSplitPercentage)) / 100n, mayDeviateWith, `earnedByUser1 should be close to reward amount's first split#1 (Index: ${index})`);
                    expect(earnedByUser1AfterTransfer).to.be.closeTo(earnedByUser1BeforeTransfer, mayDeviateWith, `earnedByUser1 should be close to reward amount's first split#2 (Index: ${index})`);
                    expect(earnedByUser2AfterTransfer).to.be.closeTo((rewardAmount * BigInt(secondSplitPercentage)) / 100n, mayDeviateWith, `earnedByUser2 should be close to reward amount's second split (Index: ${index})`);

                    // Check that user1 has no sCSX and user2 has the correct amount of sCSX
                    const user1SCSXBalance = await staking.balanceOf(await _user1.getAddress());
                    const user2SCSXBalance = await staking.balanceOf(await _user2.getAddress());
                    if (_logs) console.log("user1 sCSX balance", user1SCSXBalance.toString());
                    if (_logs) console.log("user2 sCSX balance", user2SCSXBalance.toString());
                    expect(user1SCSXBalance).to.be.equal(zeroAmount18, `user1 should have no sCSX (Index: ${index})`);
                    expect(user2SCSXBalance).to.be.equal(stakeAmount, `user2 should have 100 sCSX (Index: ${index})`);

                    // Claim rewards for both users and check that they have the correct amount of USDC
                    await claimReward(user1, USDCToken.target, false);
                    await claimReward(user2, USDCToken.target, false);

                    // Check that user1 and user2 have the correct amount of earned after claim
                    const earnedByUser1AfterClaim = await staking.connect(_user1).earned(await _user1.getAddress(), USDCToken.target);
                    const earnedByUser2AfterClaim = await staking.connect(_user2).earned(await _user2.getAddress(), USDCToken.target);
                    if (_logs) console.log("earnedByUser1 after claim", earnedByUser1AfterClaim.toString());
                    if (_logs) console.log("earnedByUser2 after claim", earnedByUser2AfterClaim.toString());
                    expect(earnedByUser1AfterClaim).to.be.equal(zeroAmount6, `earnedByUser1 should be equal to 0 USDC (Index: ${index})`);
                    expect(earnedByUser2AfterClaim).to.be.equal(zeroAmount6, `earnedByUser2 should be equal to 0 USDC (Index: ${index})`);

                    // Check that user1 and user2 have the correct amount of USDC after claim
                    const user1USDCBalance = await USDCToken.balanceOf(await _user1.getAddress());
                    const user2USDCBalance = await USDCToken.balanceOf(await _user2.getAddress());
                    if (_logs) console.log("user1 USDC balance", user1USDCBalance.toString());
                    if (_logs) console.log("user2 USDC balance", user2USDCBalance.toString());
                    expect(user1USDCBalance).to.be.closeTo((rewardAmount * BigInt(firstSplitPercentage)) / 100n, mayDeviateWith, `earnedByUser1 should be close to reward amount's first split (Index: ${index})`);
                    expect(user2USDCBalance).to.be.closeTo((rewardAmount * BigInt(secondSplitPercentage)) / 100n, mayDeviateWith, `earnedByUser2 should be close to reward amount's second split (Index: ${index})`);

                    // "Clear state" for next test case
                    if(_logs) console.log("__________________________________________________________");
                    if(_logs) console.log('"Clearing state"');
                    await staking.connect(_user2).unStake(stakeAmount);
                    if(_logs) console.log(`Unstaking ${stakeAmount} sCSX tokens`);
                    await CSXToken.connect(_user2).transfer(await deployer.getAddress(), stakeAmount);
                    if(_logs) console.log("Transferring sCSX back to deployer");
                    await USDCToken.connect(_user1).transfer(await deployer.getAddress(), user1USDCBalance);
                    if(_logs) console.log("Transferring USDC back to deployer");
                    await USDCToken.connect(_user2).transfer(await deployer.getAddress(), user2USDCBalance);
                    if(_logs) console.log("Transferring USDC back to deployer");
                    await fastForwardTime(7 * DAY, _logs);
                    if(_logs) console.log("__________________________________________________________");
                };
        
                // Test cases with different time splits (percentage 50/50, 20/80 etc), with and without logs
                //await testWithTimeSplits(50, 50, user1, user2, IS_WITH_LOGS);
                //await testWithTimeSplits(15, 85, user1, user2, IS_WITH_LOGS);
                //await testWithTimeSplits(85, 15, user1, user2, IS_WITH_LOGS);
                //... and so on

                // Fuzz testing with random time splits, reward amounts, and stake amounts.
                // Maximum accepted deviation is 0.53% (530 basis points) of the reward amount.
                const ROUNDS = 8;
                for(const i of Array(ROUNDS).keys()) {
                    const firstSplitPercentage = Math.floor(Math.random() * 100);
                    const secondSplitPercentage = 100 - firstSplitPercentage;
                    // Random reward amount between 1000 and 100k
                    const _RANDOM_REWARD = Math.floor(Math.random() * (100_000 - 1000) + 1000);
                    rewardAmount = ethers.parseUnits(String(_RANDOM_REWARD), 6); // Assuming USDC has 6 decimals
                    // Random stake amount between 1 and 10 million
                    const _RANDOM_STAKE = Math.floor(Math.random() * (10_000_000 - 1) + 1);
                    stakeAmount = ethers.parseUnits(String(_RANDOM_STAKE), 18);
                    await testWithTimeSplits(firstSplitPercentage, secondSplitPercentage, user1, user2, IS_WITH_LOGS, i);
                }
            });
        });

        // Invariant tests based on shieldify's past findings
        describe("Some of Shieldify's Findings as Invariants", function () {
            it("#3 should not double the reward of a given user on each token transfer", async() => {
                const amount1 = ethers.parseEther("500"); // 1/8 of underlying supply
                const amount2 = ethers.parseEther("3500"); // 7/8 of underlying supply
                const distributeAmount = ethers.parseUnits("500", 6);
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount1);
                await CSXToken.connect(deployer).transfer(user2.getAddress(), amount2);
                await CSXToken.connect(user1).approve(staking.target, amount1);
                await CSXToken.connect(user2).approve(staking.target, amount2);
                await staking.connect(user1).stake(amount1);
                await staking.connect(user2).stake(amount2);
                await USDCToken.connect(deployer).approve(staking.target, distributeAmount);    
                await staking.connect(deployer).depositDividend(USDCToken.target, distributeAmount);
                await staking.connect(council).setRewardsDuration(7 * DAY, USDCToken.target);
                await staking.connect(keeperNode).distribute(true, true, true);
                await fastForwardTime(7 * DAY);
        
                // credit[USDC][user1] = 0 => rewardOf(user1) = 500
                const initialReward = await staking.rewardOf(user1.getAddress());
                
                await staking.connect(user1).transfer('0x0000000000000000000000000000000000000001', BigInt(0));
                // credit[USDC][user1] = 500 => rewardOf(user1) = 500
                await staking.connect(user1).transfer('0x0000000000000000000000000000000000000001', BigInt(0));
                // credit[USDC][user1] = 1000 => rewardOf(user1) = 1000
                await staking.connect(user1).transfer('0x0000000000000000000000000000000000000001', BigInt(0));
                // credit[USDC][user1] = 2000 => rewardOf(user1) = 2000
                await staking.connect(user1).transfer('0x0000000000000000000000000000000000000001', BigInt(0));
                // credit[USDC][user1] = 4000 => rewardOf(user1) = 4000
                const postTransferReward = await staking.rewardOf(user1.getAddress());
                if (IS_WITH_LOGS) console.log('> Initial reward: ', initialReward.usdcAmount);
                if (IS_WITH_LOGS) console.log('> Reward after 4 transfers: ', postTransferReward.usdcAmount);   
                expect(postTransferReward.usdcAmount).to.equal(initialReward.usdcAmount);
                
                const usdcBalanceBefore = await USDCToken.balanceOf(staking.getAddress());
                await staking.connect(user1).claim(true, false, false, false);
                const usdcBalanceAfter = await USDCToken.balanceOf(staking.getAddress());
                if (IS_WITH_LOGS) console.log('> USDC balalance before claim: ', usdcBalanceBefore);
                if (IS_WITH_LOGS) console.log('> USDC balalance after claim: ', usdcBalanceAfter);
                expect(usdcBalanceAfter).to.equal(usdcBalanceBefore-initialReward.usdcAmount);
                expect(usdcBalanceAfter).to.equal(usdcBalanceBefore-postTransferReward.usdcAmount);
            });
            it("#4 Unclaimed user staking rewards should not get lost on each call to StakedCSX::stake",async () => { 
                const stakeAmountNumber = 100_000;
                const rewardAmountNumber = 1000;
                const rewardAmountUnits = ethers.parseUnits("1000", 6);
                // Staking 100k CSX
                await userStake(user1, stakeAmountNumber); 
                // Transfering 1000 USDC and notifying rewards.
                await depositDividendSetRewardDurAndNotify(rewardAmountNumber, 6); 
                // Staking 100k CSX again (200k total)
                await userStake(user1, stakeAmountNumber);
                // Fast forward time by 7 days
                await fastForwardTime(7 * DAY);     
                // Staking 100k CSX again (300k total)
                await userStake(user1, stakeAmountNumber);        
                // Check unotifiedFunds in contract (rounding errored amount)
                const earnedAfterTime = await staking.connect(user1).earned(await user1.getAddress(), USDCToken.target);
                // Expecting full amount of rewards excl rounding error
                const deviationPercentage = 530; // 0.53% in basis points
                const basisPointDivisor = 100_000; // Basis points divisor for 6 decimal places
                const mayDeviateWith = (Number(rewardAmountUnits) * deviationPercentage) / basisPointDivisor; // 0.53% of reward amount
                expect(earnedAfterTime).to.be.closeTo(rewardAmountUnits, mayDeviateWith);
                // Get USDC reward for user1
                await staking.connect(user1).claim(true, false, false, false);
                // Expecting full earned amount in user1's USDC balance
                const userBalance = await USDCToken.balanceOf(await user1.getAddress());
                expect(earnedAfterTime).to.be.equal(userBalance, "earnedAfterTime should be equal to userBalance");
            });
        });
    });

    describe("Previous Tests >", function () {
        describe("Stake", function () {
            it("User1 stakes 300 CSX tokens", async()=> {
                const amount = ethers.parseEther("300");
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                expect(await staking.balanceOf(user1.getAddress())).to.equal(amount);
                expect(await staking.rewardRate(USDCToken.target)).to.equal(0);
            });
    
            it("User2 stakes 500 CSX tokens", async()=> {
                const amount = ethers.parseEther("500");
                await CSXToken.connect(deployer).transfer(user2.getAddress(), amount);
                await CSXToken.connect(user2).approve(staking.target, amount);
                await staking.connect(user2).stake(amount);
                expect(await staking.balanceOf(user2.getAddress())).to.equal(amount); 
                expect(await staking.rewardRate(USDCToken.target)).to.equal(0);  
            });
        });

        describe("UnStake", function () {
            it("User1 unstakes 300 CSX tokens", async()=> {
                const amount = ethers.parseEther("300");
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                await staking.connect(user1).unStake(amount);
                expect(await staking.balanceOf(user1.getAddress())).to.equal(0);
            });
    
            it("User2 unstakes 500 CSX tokens", async()=> {
                const amount = ethers.parseEther("500");
                await CSXToken.connect(deployer).transfer(user2.getAddress(), amount);
                await CSXToken.connect(user2).approve(staking.target, amount);
                await staking.connect(user2).stake(amount);
                await staking.connect(user2).unStake(amount);
                expect(await staking.balanceOf(user2.getAddress())).to.equal(0);
            });
        });

        describe("Distribute Rewards", function () {
            beforeEach(async()=> {
                [deployer, keeperNode, council, user1, user2, ...potentialStakers] = await ethers.getSigners();
            });
    
            it("Correctly calculate lastRewardRate", async()=> {
                const user1amount = ethers.parseEther("1");
            
                await CSXToken.connect(deployer).transfer(user1.getAddress(), user1amount);
                await CSXToken.connect(user1).approve(staking.target, user1amount);
                await staking.connect(user1).stake(user1amount);
                
                // Distribute 500 USDC in 6 decimals
                const distributeAmount = ethers.parseUnits("500", 6);
                
                await USDCToken.connect(deployer).approve(staking.target, distributeAmount);    
                        
                await staking.connect(deployer).depositDividend(USDCToken.target, distributeAmount);
    
                // Test to distribute with no token.
                await expect(
                    staking.connect(council).distribute(false, false, false)
                  ).to.be.revertedWithCustomError(staking, "InvalidToken");      
    
                const duration = 10 * DAY;

                await staking.connect(council).setRewardsDuration(duration, USDCToken.target);
                await staking.connect(council).distribute(true, true, true);
                
                // Check reward balance of staking contract
                const rewardBalance = await USDCToken.balanceOf(staking.target);    
                expect(distributeAmount).to.equal(rewardBalance);
            
                // Check last reward
                const lastRewardRate = await staking.rewardRate(USDCToken.target);
                expect(lastRewardRate).to.equal(distributeAmount / BigInt(duration));
                await fastForwardTime(duration + (1*DAY));
            });
    
            it("Should revert if period is not set", async()=> {
                const _DURATION = 10 * DAY;
                const amount = ethers.parseEther("500");
                const rewardAmount = ethers.parseUnits("500", 6);
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                await USDCToken.connect(deployer).transfer(staking.target, rewardAmount);
                await expect(staking.connect(council).notifyRewardAmount(rewardAmount, USDCToken.target)).to.be.revertedWithPanic('0x12');
            });
    
            it("Should revert if not council distributes", async()=> {
                const amount = ethers.parseEther("500");
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                await expect(staking.connect(user1).distribute(true, true, true)).to.be.revertedWithCustomError(staking, "Unauthorized");
            });
    
            it("Council should distribute rewards", async()=> {
                const amount = ethers.parseEther("500");
                const distributeAmount = ethers.parseUnits("500", 6);
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                await USDCToken.connect(deployer).approve(staking.target, distributeAmount);    
                await staking.connect(deployer).depositDividend(USDCToken.target, distributeAmount);
                await staking.connect(council).setRewardsDuration(7 * DAY, USDCToken.target);
                await expect(staking.connect(council).distribute(true, true, true)).to.emit(staking, "Distribute");
            });
    
            it("KeeperNode should distribute rewards", async()=> {
                const amount = ethers.parseEther("500");
                const distributeAmount = ethers.parseUnits("500", 6);
                await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
                await CSXToken.connect(user1).approve(staking.target, amount);
                await staking.connect(user1).stake(amount);
                await USDCToken.connect(deployer).approve(staking.target, distributeAmount);    
                await staking.connect(deployer).depositDividend(USDCToken.target, distributeAmount);
                await staking.connect(council).setRewardsDuration(7 * DAY, USDCToken.target);
                await expect(staking.connect(keeperNode).distribute(true, true, true)).to.emit(staking, "Distribute");
            });
    
            it("Fuzz Distribute USDC Rewards in Ranges", async () => {
                const MAX_SUPPLY = ethers.parseEther("100000000");
                const CONSOLE_LOGGING = false; // Set to true to see console logs
                let ITERATIONS = 1;  // Increase iterations for more thorough fuzzing
                let MAX_TOTAL_STAKERS = 0; // Increase account amount for more thorough fuzzing¨
    
                if(ITERATIONS === 0) return;
    
                let totalDividendDeposited = 0n;
    
                // Add more stakers here
                const randomAccounts = [];
                const initialFunding = ethers.parseEther("1"); // 1 ETH for example
            
                // Fetch the default accounts
                const [defaultAccount] = await ethers.getSigners();
    
                if(MAX_TOTAL_STAKERS > 0){
                  for (let i = 0; i < MAX_TOTAL_STAKERS; i++) {
                  const wallet = ethers.Wallet.createRandom();
                  const signer = wallet.connect(ethers.provider);
                  randomAccounts.push(signer);            
    
                  // percentage left iteration vs total iterations
                  const percentage = (i + 1) / MAX_TOTAL_STAKERS * 100;
    
                  // percentage to String then max two decimal places
                  const percentageString = percentage.toFixed(2);
    
                  // iterations left
                  const iterationsLeft = MAX_TOTAL_STAKERS - i;
            
                  if(CONSOLE_LOGGING){
                    console.log(`[Fuzz Distribute USDC Rewards in Ranges] Creating Accounts with ETH Queue: ${iterationsLeft}. Progress: ${percentageString}%.`);
                  }              
    
                  // Send 1 ETH to the generated account
                  await defaultAccount.sendTransaction({
                    to: signer.address,
                    value: initialFunding
                  });
                  }
      
                  potentialStakers = randomAccounts;    
                }            
            
                interface StakeRanges {
                    [key: string]: bigint[];
                }
                interface DepositRanges {
                    [key: string]: bigint[];
                }
                interface Summary {
                    [key: string]: number | bigint | any;
                }
                interface Log {
                    [key: string]: string | number | boolean | any[];
                }
    
                const summary: Summary = {
                    superlow: 0,
                    low: 0,
                    medium: 0,
                    high: 0,
                    lowestDeposited: BigInt(Number.MAX_SAFE_INTEGER),  
                    highestDeposited: 0n,
                    lowestDepositIteration: 0,
                    highestDepositIteration: 0,
                    lowestDepositDetails: null,
                    highestDepositDetails: null
                };    
                const depositRanges: DepositRanges = {
                    superlow: [10000000n, 50000000n], // $10 to $50 (10**6)
                    low: [50000000n, 100000000n], // $50 to $100 (10**6)
                    medium: [100000000n, 1000000000n], // $100 to $1000 (10**6)
                    high: [1000000000n, 10000000000n] // $1000 to $10000 (10**6)
                };
                const stakeRanges: StakeRanges = {
                    superlow: [1000000000000000000n, 1000000000000000000n], // 1 to 1 (10**18)
                    low: [1000000000000000001n, 10000000000000000000n], // 1 to 1 (10**18)
                    low_medium: [1000000000000000001n, 100000000000000000000n], // 10 to 100 (10**18)
                    low_high: [100000000000000000001n, 1000000000000000000000n], // 100 to 1000 (10**18)
                    medium: [1000000000000000000001n, 10000000000000000000000n], // 1000 to 10,000 (10**18)
                    medium_high: [10000000000000000000001n, 100000000000000000000000n], // 10,000 to 100,000 (10**18)
                    high: [100000000000000000000001n, 1000000000000000000000000n], // 100,000 to 1,000,000 (10**18)    
                    very_high: [10000000000000000000000000n, 50000000000000000000000000n], // 10,000,000 to 50,000,000 (10**18)
                };
    
                let totalClaimed = 0n;
                let log: Log[] = [];
                let timePassed: string = '';
    
                for (let i = 0; i < ITERATIONS; i++) {
                    const numStakers = Math.max(10, Math.floor(Math.random() * potentialStakers.length)) +100;
                    const stakersForThisIteration = potentialStakers.slice(0, numStakers);
    
                    let totalStakedInIteration = 0n;   
                    let maxTokensPerIteration = BigInt(100000000 * 1e18);               
                    let selectedStakeKey: string[] = [];
                    let selectedStateKeySimple: string[] = [];
                    let stakeRange! : bigint[];
                    let stakersWhoStaked: string[] = [];
    
                    let stakerIndex = 0;
                    for (const staker of stakersForThisIteration) {
                        // percentage left iteration vs total iterations
                        const percentage = (stakerIndex + 1) / stakersForThisIteration.length * 100;
                        stakerIndex++;
                        // percentage to String then max two decimal places
                        const percentageString = percentage.toFixed(2);
    
                        // iterations left
                        const iterationsLeft = stakersForThisIteration.length - stakerIndex;
                    
                        if(CONSOLE_LOGGING){
                            console.log(`[Fuzz Distribute USDC Rewards in Ranges] Transfer, Approve & Stake CSXTokens: ${iterationsLeft}. Progress: ${percentageString}%.`);
                        }                    
                        // Randomly select a range for stake
                        const _selectedStakeKey = Object.keys(stakeRanges)[Math.floor(Math.random() * Object.keys(stakeRanges).length)];
                        const _stakeRange = stakeRanges[_selectedStakeKey];
                        
                        let amount = BigInt(Math.floor(Math.random() * Number((_stakeRange[1] - _stakeRange[0])) + Number(_stakeRange[0])));
                        let amountInDecimalEther = (parseFloat(amount.toString()) / 1e18).toFixed(2); // Up to 18 decimal points
                        
                        amountInDecimalEther = parseFloat(amountInDecimalEther).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        selectedStakeKey.push(`${_selectedStakeKey} : ${amount.toString()} wei : ${amountInDecimalEther} CSX.`);
                        selectedStateKeySimple.push(`${_selectedStakeKey} : ${amount.toString()}`);
                        stakeRange = _stakeRange;
    
                        if (totalStakedInIteration + amount > maxTokensPerIteration) {                       
                            //5console.warn(`Max tokens for this iteration reached. Skipping staking for ${await staker.getAddress()}.`);
                            continue;
                        }
                        
                        //console.log(`Attempting to transfer and stake ${ethers.formatEther(amount.toString())} tokens from deploy with balance ${ethers.formatEther(await CSXToken.balanceOf(deployer.getAddress()))} for staker ${await staker.getAddress()}`);                
                        await CSXToken.connect(deployer).transfer(staker.getAddress(), amount);
                        //console.log(`Transferred ${amount.toString()} tokens`);
                    
                        await CSXToken.connect(staker).approve(staking.target, MAX_SUPPLY);
                        //console.log(`Approved ${approvalAmount.toString()} tokens`);
                    
                        await staking.connect(staker).stake(amount);
                        //console.log(`Staked ${amount.toString()} tokens`);
    
                        stakersWhoStaked.push(await staker.getAddress());
                    
                        totalStakedInIteration += amount;
                    }                
            
                    // Randomly select a range for deposit
                    const selectedDepositKey = Object.keys(depositRanges)[Math.floor(Math.random() * Object.keys(depositRanges).length)];
                    const depositRange = depositRanges[selectedDepositKey];
                    const depositAmount = BigInt(Math.floor(Math.random() * Number((depositRange[1] - depositRange[0])) + Number(depositRange[0])));
    
                    // Check if the deposit amount is lower or higher than the current lowest or highest
                    if (depositAmount < summary.lowestDeposited) {
                        summary.lowestDeposited = depositAmount;
                        summary.lowestDepositIteration = i + 1;
                        summary.lowestDepositDetails = {
                            totalStakers: stakersWhoStaked.length,
                            totalStaked: totalStakedInIteration.toString(),
                            totalStakedInCSX: (parseFloat(totalStakedInIteration.toString()) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),                     
                            depositAmount: depositAmount.toString(),
                            depositAmountInUSDC: (parseFloat(depositAmount.toString()) / 1e6).toFixed(2),
                            distributionAmount: selectedDepositKey,
                            stakersBagSize: selectedStakeKey,
                            stakeRange: stakeRange.toString(),                        
                            depositRange: depositRange.toString(),                           
                        };
                    }
                    if (depositAmount > summary.highestDeposited) {
                        summary.highestDeposited = depositAmount;
                        summary.highestDepositIteration = i + 1;
                        summary.highestDepositDetails = {
                            totalStakers: stakersWhoStaked.length,
                            totalStaked: totalStakedInIteration.toString(),
                            totalStakedInCSX: (parseFloat(totalStakedInIteration.toString()) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),                     
                            depositAmount: depositAmount.toString(),
                            depositAmountInUSDC: (parseFloat(depositAmount.toString()) / 1e6).toFixed(2),
                            distributionAmount: selectedDepositKey,
                            stakersBagSize: selectedStakeKey,
                            stakeRange: stakeRange.toString(),                        
                            depositRange: depositRange.toString(),   
                        };
                    }
    
                    totalDividendDeposited += depositAmount;
                    summary[selectedDepositKey]++;
            
                    //console.log(`---------- Iteration ${i+1} ----------`);
                    // console.log(`Total staked in iteration: ${totalStakedInIteration.toString()}`);
                    // console.log(`Deposit amount: ${depositAmount.toString()}`);
                    // console.log(`Stakers: ${stakersForThisIteration.length}`);
    
                    await USDCToken.connect(deployer).approve(staking.target, depositAmount);
                    await staking.connect(deployer).depositDividend(USDCToken.target, depositAmount);
                    await staking.connect(council).setRewardsDuration(7 * DAY, USDCToken.target);
                    await staking.connect(council).distribute(true, true, true);
                    await fastForwardTime(7 * DAY);
                    
                    for (const staker of stakersForThisIteration) {
                        const stakerAddress = await staker.getAddress();
    
                        // Skip unstaking if the staker didn't successfully stake.
                        if (!stakersWhoStaked.includes(stakerAddress)) {
                            continue;
                        }
                        
                        // percentage left iteration vs total iterations
                        const percentage = (i + 1) / ITERATIONS * 100;
    
                        // percentage to String then max two decimal places
                        const percentageString = percentage.toFixed(2);
                        
                        // iterations left
                        const iterationsLeft = (ITERATIONS - (i + 1));
    
                        // Calculate timeleft and store how long time has passed
                        const timeLeftSeconds = iterationsLeft * 0.5;
                        const timeLeftMinutes = Math.floor(timeLeftSeconds / 60);
                        const timeLeftSecondsLeft = Math.floor(timeLeftSeconds % 60);
                        const timeLeft = `${timeLeftMinutes} minutes and ${timeLeftSecondsLeft} seconds`;
                        timePassed = `${Math.floor((i + 1) * 0.5 / 60)} minutes and ${Math.floor((i + 1) * 0.5 % 60)} seconds`;
    
                        if(CONSOLE_LOGGING){
                            console.log(`[Fuzz Distribute USDC Rewards in Ranges] Scenarios Queue: ${iterationsLeft}. Progress: ${percentageString}%. Timeleft: ${timeLeft}.`);             
                        }                    
    
                        const stakedBalance = await staking.balanceOf(staker.getAddress());        
                        //console.log(`> Staked balance: ${stakedBalance.toString()}`);
                        const currentStakeRange = selectedStateKeySimple.find((stakeKey) => {
                            return stakeKey.split(" : ")[1] === stakedBalance.toString();
                        });
    
                        const claimAmount = await staking.rewardOf(staker.getAddress());
                        //console.log(`> Claim amount: ${claimAmount.toString()}`);   
                        totalClaimed += claimAmount.usdcAmount;
                        await staking.connect(staker).claim(true, false, false, false);
                        //console.log(`> Claimed reward`);
                        
                        const newClaimAmount = await staking.rewardOf(staker.getAddress());
                        //console.log(`> New claim amount: ${newClaimAmount.toString()}`);
                        expect(newClaimAmount.usdcAmount).to.equal(0n);
    
                        const rewardBalance = await USDCToken.balanceOf(staker.getAddress());
                        //console.log(`> Reward balance: ${rewardBalance.toString()}`);     
                        expect(rewardBalance).to.equal(claimAmount.usdcAmount);
    
                        const gotRewards = rewardBalance > 0n ? true : false;
    
                        const thelog: Log = {
                            currentRewardForAll: depositAmount.toString(),
                            stakerAddress: stakerAddress,
                            stakedBalance: stakedBalance.toString(),
                            stakedRange: currentStakeRange!.split(" : ")[0],
                            claimAmountBefore: claimAmount.toString(),
                            claimAmountAfter: newClaimAmount.toString(),
                            rewardBalance: rewardBalance.toString(),
                            gotRewards: gotRewards,
                        };
    
                        log.push(thelog);
    
                        await USDCToken.connect(staker).transfer(deployer.getAddress(), claimAmount.usdcAmount);
                        await staking.connect(staker).unStake(stakedBalance); 
                        await CSXToken.connect(staker).transfer(deployer.getAddress(), stakedBalance);
                    }
    
                    stakersWhoStaked = [];
    
                    //const stakingContractBalance = await USDCToken.balanceOf(staking.target);
                    // console.log(`Inital deposit reward amount per iteration before all claimed: ${depositAmount.toString()}`);
                    // console.log(`Accumulated Staking contract balance after all claimed: ${stakingContractBalance.toString()}`);
                    // console.log(`Total dividend deposited: ${totalDividendDeposited.toString()}`);       
                    // console.log(`---------- End iteration ${i+1} ----------`);      
                }
                if(CONSOLE_LOGGING){
                    console.log(`[Fuzz Distribute USDC Rewards in Ranges] Scenarios Queue Empty. Took ${timePassed}.`);
                    console.log("----------------- Summary ----------------");
                    console.log(`Total scenarios: ${ITERATIONS}`);
                    console.log(`Total dividend deposited: ${totalDividendDeposited.toString()} wei, in USDC: ${(Number(totalDividendDeposited) / 1e6).toFixed(2)}`);      
                    console.log(`Total claimed: ${totalClaimed.toString()} wei, in USDC: ${(Number(totalClaimed) / 1e6).toFixed(2)}`);
                    console.log(`Left over (calculated): ${totalDividendDeposited - totalClaimed} wei, in USDC: ${(Number(totalDividendDeposited - totalClaimed) / 1e6)}`);
                    console.log(`Left over (onchain): ${await USDCToken.balanceOf(staking.target)} wei, in USDC: ${(Number(await USDCToken.balanceOf(staking.target)) / 1e6)}`);
                    console.log("----------- Distribution Ranges ---------- ");
                    console.log(`Superlow range: ${summary.superlow} scenarios (Item sale of 1-10 USDC on 2.6% fee)`);
                    console.log(`Low range: ${summary.low} scenarios (Item sale of 10-100 USDC on 2.6% fee)`);
                    console.log(`Medium range: ${summary.medium} scenarios (Item sale of 100-1000 USDC on 2.6% fee)`);
                    console.log(`High range: ${summary.high} scenarios (Item sale of 1000-10000 USDC on 2.6% fee))`);
                    console.log("------------------------------------------");
                    const allGotRewards = log.filter((log) => log.gotRewards === true);
                    const notAllGotRewards = log.filter((log) => log.gotRewards === false);
                    console.log(`Total stakers got rewarded: ${allGotRewards.length} out of ${log.length} stakers.`);
                    console.log(`Total stakers not rewarded: ${notAllGotRewards.length} out of ${log.length} stakers.`);
                    // Majority of stakers got rewarded was from what range?
                    const superlowGotRewards = allGotRewards.filter((log) => log.stakedRange === "superlow" && log.gotRewards === true);
                    const lowGotRewards = allGotRewards.filter((log) => log.stakedRange === "low" && log.gotRewards === true);
                    const low_mediumGotRewards = allGotRewards.filter((log) => log.stakedRange === "low_medium" && log.gotRewards === true);
                    const low_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "low_high" && log.gotRewards === true);
                    const mediumGotRewards = allGotRewards.filter((log) => log.stakedRange === "medium" && log.gotRewards === true);
                    const medium_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "medium_high" && log.gotRewards === true);
                    const highGotRewards = allGotRewards.filter((log) => log.stakedRange === "high" && log.gotRewards === true);
                    const very_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "very_high" && log.gotRewards === true);
                    const mostCommonGotRewards = Math.max(superlowGotRewards.length, lowGotRewards.length, low_mediumGotRewards.length, low_highGotRewards.length, mediumGotRewards.length, medium_highGotRewards.length, highGotRewards.length, very_highGotRewards.length);
                    if (mostCommonGotRewards === superlowGotRewards.length) {
                        console.log(`Most common range that got rewarded: superlow (${superlowGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === lowGotRewards.length) {
                        console.log(`Most common range that got rewarded: low (${lowGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === low_mediumGotRewards.length) {
                        console.log(`Most common range that got rewarded: low_medium (${low_mediumGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === low_highGotRewards.length) {
                        console.log(`Most common range that got rewarded: low_high (${low_highGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === mediumGotRewards.length) {
                        console.log(`Most common range that got rewarded: medium (${mediumGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === medium_highGotRewards.length) {
                        console.log(`Most common range that got rewarded: medium_high (${medium_highGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === highGotRewards.length) {
                        console.log(`Most common range that got rewarded: high (${highGotRewards.length} stakers)`);
                    } else if (mostCommonGotRewards === very_highGotRewards.length) {
                        console.log(`Most common range that got rewarded: very_high (${very_highGotRewards.length} stakers)`);
                    }
                    const superlowGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "superlow" && log.gotRewards === false);
                    const lowGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low" && log.gotRewards === false);
                    const low_mediumGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low_medium" && log.gotRewards === false);
                    const low_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low_high" && log.gotRewards === false);
                    const mediumGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "medium" && log.gotRewards === false);
                    const medium_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "medium_high" && log.gotRewards === false);
                    const highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "high" && log.gotRewards === false);
                    const very_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "very_high" && log.gotRewards === false);
                    const mostCommonGotNotRewards = Math.max(superlowGotNotRewards.length, lowGotNotRewards.length, low_mediumGotNotRewards.length, low_highGotNotRewards.length, mediumGotNotRewards.length, medium_highGotNotRewards.length, highGotNotRewards.length, very_highGotNotRewards.length);
                    if (mostCommonGotNotRewards === superlowGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: superlow (${superlowGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === lowGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: low (${lowGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === low_mediumGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: low_medium (${low_mediumGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === low_highGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: low_high (${low_highGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === mediumGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: medium (${mediumGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === medium_highGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: medium_high (${medium_highGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === highGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: high (${highGotNotRewards.length} stakers)`);
                    } else if (mostCommonGotNotRewards === very_highGotNotRewards.length) {
                        console.log(`Most common range that got not rewarded: very_high (${very_highGotNotRewards.length} stakers)`);
                    }            
                    console.log("------------------------------------------");           
                    console.log(`Lowest distribution amount: ${summary.lowestDeposited.toString()} wei, in USDC: ${(Number(summary.lowestDeposited) / 1e6).toFixed(2)}`);
                    console.log(`Highest distribution amount: ${summary.highestDeposited.toString()} wei, in USDC: ${(Number(summary.highestDeposited) / 1e6).toFixed(2)}`);            
                    console.log("------------------------------------------");
                    console.log(`Lowest distribution amount occurred in scenario ${summary.lowestDepositIteration}: ${summary.lowestDeposited.toString()} wei, in USDC: ${(Number(summary.lowestDeposited) / 1e6).toFixed(2)}`);
                    const lowestDistributionLog = log.filter((log) => log.currentRewardForAll === summary.lowestDeposited.toString());
                    const lowestDistributionLogGotRewards = lowestDistributionLog.filter((log) => log.gotRewards === true);
                    console.log(`STAKERS WHO GOT REWARDED: ${lowestDistributionLogGotRewards.length} out of ${lowestDistributionLog.length} stakers.`);
                    //console.log(`Lowest Metadata: `, JSON.stringify(summary.lowestDepositDetails, null, 2));
                    //console.log(`Lowest distribution log: `, JSON.stringify(lowestDistributionLog, null, 2));
                    console.log("------------------------------------------");
                    console.log(`Highest distribution amount occurred in scenario ${summary.highestDepositIteration}: ${summary.highestDeposited.toString()} wei, in USDC: ${(Number(summary.highestDeposited) / 1e6).toFixed(2)}`);
                    const highestDistributionLog = log.filter((log) => log.currentRewardForAll === summary.highestDeposited.toString()); 
                    const highestDistributionLogGotRewards = highestDistributionLog.filter((log) => log.gotRewards === true);
                    console.log(`STAKERS WHO GOT REWARDED: ${highestDistributionLogGotRewards.length} out of ${highestDistributionLog.length} stakers.`);
                    //console.log(`Highest Metadata: `, JSON.stringify(summary.highestDepositDetails, null, 2));
                    //console.log(`Highest distribution log: `, JSON.stringify(highestDistributionLog, null, 2));  
                    console.log("------------------------------------------");
                    console.log("-------------  Summary End ---------------");
    
                }            
            });
        });
    });

    const userStake = async (_user: Signer, _amount: number, _logs?:boolean) => {
        if(_logs) console.log("__________________________________________________________");
        if(_logs) console.log(`Staking ${_amount} CSX tokens`);
        const stakeAmount = ethers.parseEther(String(_amount));
        if(_logs) console.log("Stake amount", _amount);
        await CSXToken.connect(deployer).transfer(await _user.getAddress(), stakeAmount);
        await CSXToken.connect(_user).approve(staking.target, stakeAmount);
        await staking.connect(_user).stake(stakeAmount);
        if(_logs) console.log("__________________________________________________________");
    }

    const depositDividendSetRewardDurAndNotify = async (_amount: number, _decimals: number, _duration?: number, _logs?: boolean) => {
        if(_logs) console.log("__________________________________________________________");
        const tokenLabel = _decimals == 6 ? "USDC" : "WETH";
        if(_logs) console.log(`Deposit & Notifying ${_amount} ${tokenLabel} tokens`);
        //const duration = 7 * DAY;
        let duration;
        if(_duration == undefined) {
            duration = 7 * DAY;
        } else {
            duration = _duration;
        }
        const rewardAmount = ethers.parseUnits(String(_amount), _decimals);
        if(_logs) console.log("Reward amount", rewardAmount.toString());        
        if (_decimals == 6) {
            await USDCToken.connect(deployer).approve(staking.target, rewardAmount);
        } else if (_decimals == 18) {
            await WETHToken.connect(deployer).deposit({value: rewardAmount});
            await WETHToken.connect(deployer).approve(staking.target, rewardAmount);
        }
        const tokenTarget = _decimals == 6 ? USDCToken.target : WETHToken.target;
        await staking.depositDividend(tokenTarget, rewardAmount);
        const nonDistributedRewardsPerTokenBefore = await staking.nonDistributedRewardsPerToken(tokenTarget);
        if(_logs) console.log("nonDistributedRewardsPerTokenBefore", nonDistributedRewardsPerTokenBefore.toString());
        
        await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        await staking.connect(council).notifyRewardAmount(rewardAmount, tokenTarget);
        if(_logs) console.log("__________________________________________________________");
    }

    const fastForwardTime = async (_duration: number, _logs?: boolean) => {
        if(_logs) console.log("__________________________________________________________");
        if(_logs) console.log(`Fast forwarding time by ${_duration} seconds`);
        await ethers.provider.send("evm_increaseTime", [_duration]);
        await ethers.provider.send("evm_mine", []);
        if(_logs) console.log("__________________________________________________________");
    }

    const claimReward = async (_user: Signer, _tokenTarget: string | any, _withWeth?: boolean, _logs?: boolean) => {
        if(_logs) console.log("__________________________________________________________");
        if(_logs) console.log("get reward");
        if (_withWeth == undefined) _withWeth = false;
        //await staking.connect(_user).getReward(_tokenTarget, _withWeth);
        if(_tokenTarget == USDCToken.target) {
            await staking.connect(_user).claim(true, false, false, false);
        } else
        if(_tokenTarget == USDTToken.target) {
            await staking.connect(_user).claim(false, true, false, false);
        } else
        if(_tokenTarget == WETHToken.target) {
            await staking.connect(_user).claim(false, false, true, _withWeth);
        } else {
            throw new Error("Invalid token target");
        }
        if(_logs) console.log("__________________________________________________________");
    }

    const depositDividendAndSetRewardsDurOnly = async (_amount: number, _decimals: number, _logs?:boolean) => {
        if(_logs) console.log("__________________________________________________________");
        const tokenLabel = _decimals == 6 ? "USDC" : "WETH";
        const tokenTarget = _decimals == 6 ? USDCToken.target : WETHToken.target;
        const duration = 7 * DAY;
        if(_logs) console.log(`Deposit ${_amount} ${tokenLabel} tokens`);
        //const duration = 7 * DAY;
        const rewardAmount = ethers.parseUnits(String(_amount), _decimals);
        if(_logs) console.log("Reward amount", rewardAmount.toString());        
        if (_decimals == 6) {
            await USDCToken.connect(deployer).approve(staking.target, rewardAmount);
            await staking.depositDividend(tokenTarget, rewardAmount);
            await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        } else if (_decimals == 18) {
            await WETHToken.connect(deployer).deposit({value: rewardAmount});
            await WETHToken.connect(deployer).approve(staking.target, rewardAmount);
            await staking.depositDividend(tokenTarget, rewardAmount);
            await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        }
        if(_logs) console.log("__________________________________________________________");
    }

    const contractInfo = async (_token: string | any, _user?: Signer) => {
        const duration = await staking.duration(_token);
        const finishAt = await staking.finishAt(_token);
        const updatedAt = await staking.updatedAt(_token);
        const rewardRate = await staking.rewardRate(_token);
        const rewardPerTokenStored = await staking.rewardPerTokenStored(_token);
        const nonDistributedRewardsPerToken = await staking.nonDistributedRewardsPerToken(_token);
        const sCSXBalance = await staking.balanceOf(_token);
        const usdcBalance = await USDCToken.balanceOf(staking.target);
        const usdtBalance = await USDTToken.balanceOf(staking.target);
        const wethBalance = await WETHToken.balanceOf(staking.target);

        if(_user == undefined) {
            return {
                duration: duration.toString(),
                finishAt: finishAt.toString(),
                updatedAt: updatedAt.toString(),
                rewardRate: rewardRate.toString(),
                rewardPerTokenStored: rewardPerTokenStored.toString(),
                nonDistributedRewardsPerToken: nonDistributedRewardsPerToken.toString(),
                sCSXBalance: sCSXBalance.toString(),
                usdcBalance: usdcBalance.toString(),
                usdtBalance: usdtBalance.toString(),
                wethBalance: wethBalance.toString(),
            }
        }
        const userRewardPerTokenPaid = await staking.userRewardPerTokenPaid(await _user.getAddress(), _token);
        const rewards = await staking.rewards(await _user.getAddress(), _token);
        const earned = await staking.earned(await _user.getAddress(), _token);
        const userSCSXBalance = await staking.balanceOf(await _user.getAddress());
        const userUSDCBalance = await USDCToken.balanceOf(await _user.getAddress());
        const userUSDTBalance = await USDTToken.balanceOf(await _user.getAddress());
        const userWETHBalance = await WETHToken.balanceOf(await _user.getAddress());
        return {
            duration: duration.toString(),
            finishAt: finishAt.toString(),
            updatedAt: updatedAt.toString(),
            rewardRate: rewardRate.toString(),
            rewardPerTokenStored: rewardPerTokenStored.toString(),
            nonDistributedRewardsPerToken: nonDistributedRewardsPerToken.toString(),
            sCSXBalance: sCSXBalance.toString(),
            usdcBalance: usdcBalance.toString(),
            usdtBalance: usdtBalance.toString(),
            wethBalance: wethBalance.toString(),
            userRewardPerTokenPaid: userRewardPerTokenPaid.toString(),
            rewards: rewards.toString(),
            earned: earned.toString(),
            userSCSXBalance: userSCSXBalance.toString(),
            userUSDCBalance: userUSDCBalance.toString(),
            userUSDTBalance: userUSDTBalance.toString(),
            userWETHBalance: userWETHBalance.toString(),
        }
    }

    // ERC20.transfer instead of using depositDividend function
    const transferRewardsAndSetRewardsDurOnly = async (_amount: number, _decimals: number, _duration?: number, _logs?: boolean) => {
        if(_logs) console.log("__________________________________________________________");
        const tokenLabel = _decimals == 6 ? "USDC" : "WETH";
        const tokenTarget = _decimals == 6 ? USDCToken.target : WETHToken.target;
        const duration = _duration == undefined ? 7 * DAY : _duration;
        if(_logs) console.log(`Transfering ${_amount} ${tokenLabel} tokens`);
        const rewardAmount = ethers.parseUnits(String(_amount), _decimals);
        if(_logs) console.log("Reward amount", rewardAmount.toString());        
        if (_decimals == 6) {
            await USDCToken.connect(deployer).transfer(staking.target, rewardAmount);
            await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        } else if (_decimals == 18) {
            await WETHToken.connect(deployer).deposit({value: rewardAmount});
            await WETHToken.connect(deployer).transfer(staking.target, rewardAmount);
            await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        }
        if(_logs) console.log("__________________________________________________________");
    }

    // ERC20.transfer instead of using depositDividend function
    const transferRewardsSetRewardDurAndNotify = async (_amount: number, _decimals: number, _duration?: number, _logs?: boolean) => {
        if(_logs) console.log("__________________________________________________________");
        const tokenLabel = _decimals == 6 ? "USDC" : "WETH";
        if(_logs) console.log(`Transfer & Notifying ${_amount} ${tokenLabel} tokens`);
        const duration = 7 * DAY;
        const rewardAmount = ethers.parseUnits(String(_amount), _decimals);
        if(_logs) console.log("Reward amount", rewardAmount.toString());        
        if (_decimals == 6) {
            await USDCToken.connect(deployer).transfer(staking.target, rewardAmount);
        } else if (_decimals == 18) {
            await WETHToken.connect(deployer).deposit({value: rewardAmount});
            await WETHToken.connect(deployer).transfer(staking.target, rewardAmount);
        }
        const tokenTarget = _decimals == 6 ? USDCToken.target : WETHToken.target;
        await staking.connect(council).setRewardsDuration(duration, tokenTarget);
        await staking.connect(council).notifyRewardAmount(rewardAmount, tokenTarget);
        if(_logs) console.log("__________________________________________________________");
    }
});
