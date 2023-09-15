import { USDCToken, USDTToken, WETH9Mock } from "../../typechain-types/contracts/CSX/mock";
import { CSXToken } from "../../typechain-types/contracts/CSX";
import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { StakingRewards } from "../../typechain-types";

describe("Staking", function () {
    let CSXToken: CSXToken;
    let USDCToken: USDCToken;
    let USDTToken: USDTToken;
    let WETHToken: WETH9Mock;
    let staking: StakingRewards;
    let deployer: Signer;
    let user1: Signer;
    let user2: Signer;
    let potentialStakers: Signer[];
    const MAX_SUPPLY = ethers.parseEther("100000000");
    const DAY = 86400;
    beforeEach(async function () {
        [deployer, user1, user2, ...potentialStakers] = await ethers.getSigners();
    
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
    
        // const Staking = await ethers.getContractFactory("StakedCSX");
        // staking = (await Staking.deploy(
        // CSXToken.getAddress(),
        // WETHToken.getAddress(),
        // USDCToken.getAddress(),
        // USDTToken.getAddress(),
        // )) as StakedCSX;
        // await staking.waitForDeployment();

        const Staking = await ethers.getContractFactory("StakingRewards");
        staking = (await Staking.deploy(CSXToken.getAddress(), USDCToken.getAddress(),)) as StakingRewards;
        await staking.waitForDeployment();  


        // console.log("Staking Token deployed to:", CSXToken.target);
        // console.log("Reward Token deployed to:", rewardToken.target);
        // console.log("Staking contract deployed to:", staking.target);
    });

    describe("Stake", function () {
        it("should allow users to stake tokens", async function () {
            const stakeAmount = ethers.parseEther("10");
            await CSXToken.connect(deployer).transfer(await user1.getAddress(), stakeAmount);
            await CSXToken.connect(user1).approve(staking.target, stakeAmount);
            await staking.connect(user1).stake(stakeAmount);
    
            expect(await staking.balanceOf(await user1.getAddress())).to.equal(stakeAmount);
        });

        it("should allow users to withdraw staked tokens", async function () {
            const stakeAmount = ethers.parseEther("10");
            await CSXToken.connect(deployer).transfer(await user1.getAddress(), stakeAmount);
            await CSXToken.connect(user1).approve(staking.target, stakeAmount);
            await staking.connect(user1).stake(stakeAmount);
            await staking.connect(user1).withdraw(stakeAmount / 2n);
    
            expect(await staking.balanceOf(await user1.getAddress())).to.equal(stakeAmount / 2n);
        });
    });

    describe("Distribute rewards", function () {
        beforeEach(async()=> {
            [deployer, user1, user2, ...potentialStakers] = await ethers.getSigners();
        });

        it('rewardRate should increase if new rewards come before DURATION ends', async () => {
            await staking.connect(deployer).setRewardsDuration(7 * DAY);

			const totalToDistribute = ethers.parseUnits('5000', 6);

			await USDCToken.connect(deployer).transfer(staking.target, totalToDistribute);
			await staking.connect(deployer).notifyRewardAmount(totalToDistribute);

			const rewardRateInitial = await staking.rewardRate();

			await USDCToken.connect(deployer).transfer(staking.target, totalToDistribute);
			await staking.connect(deployer).notifyRewardAmount(totalToDistribute);

			const rewardRateLater = await staking.rewardRate();        

            expect(rewardRateInitial).to.be.gt(0);
            expect(rewardRateLater).to.be.gt(rewardRateInitial);
		});

        it("should distribute rewards correctly", async function () {
            const stakeAmount = ethers.parseEther("10");
            const duration = 7 * DAY; // Example duration of one week
            const rewardAmount = ethers.parseUnits("1000", 6); // 1000 USDC 

            await CSXToken.connect(deployer).transfer(await user1.getAddress(), stakeAmount);
            await CSXToken.connect(user1).approve(staking.target, stakeAmount);
            await staking.connect(user1).stake(stakeAmount);

            // Send reward tokens to staking contract
            await USDCToken.connect(deployer).transfer(await staking.getAddress(), rewardAmount);
            await staking.connect(deployer).setRewardsDuration(duration);
            await staking.connect(deployer).notifyRewardAmount(rewardAmount);
            
            console.log("Rewards duration set to: ", duration);
            console.log(`Staking Contract reward-balance before: ${ethers.formatUnits(await USDCToken.balanceOf(await staking.getAddress()), 6)}`);
            
            // Forward time to simulate staking for a duration
            await ethers.provider.send("evm_increaseTime", [duration*2]);
            await ethers.provider.send("evm_mine", []);
            console.log(`> Fast forward time past the duration time.`);
            console.log(`> Mined block with new timestamp.`);   
    
            await staking.connect(user1).getReward();
            console.log(`Claimed reward of 1/1 users.`);
            
            console.log(`user1 reward-balance: ${ethers.formatUnits(await USDCToken.balanceOf(await user1.getAddress()), 6)}`);
            console.log(`Staking Contract reward-balance after: ${ethers.formatUnits(await USDCToken.balanceOf(await staking.getAddress()), 6)}`);
            
            expect(await USDCToken.balanceOf(await user1.getAddress())).to.be.closeTo(rewardAmount, 265600n);
        });

        // it("Fuzz Distribute USDC Rewards", async()=> {
        //     let ITERATIONS = 0;
        //     if(ITERATIONS === 0) return;
        //     let totalDividendDeposited = 0n;
        //     let onlyOnce = false;
        //     for (let i = 0; i < ITERATIONS; i++) {
        //         const numStakers = Math.floor(Math.random() * potentialStakers.length) + 10;
        //         const stakersForThisIteration = potentialStakers.slice(0, numStakers);

        //         let totalStaked = 0n;

        //         for (const staker of stakersForThisIteration) {
        //             const minStake = 100000000000000000n;  

        //             let amount = BigInt(Math.floor(Math.random() * 100000000000000000) + 1) + minStake;
                    
        //             if(!onlyOnce) {
        //                 amount = 10000000000000000000000000n;
        //                 onlyOnce = true;
        //             }

        //             await CSXToken.connect(deployer).transfer(staker.getAddress(), amount);
        //             await CSXToken.connect(staker).approve(staking.target, MAX_SUPPLY);
        //             await staking.connect(staker).stake(amount);
        //             totalStaked += amount;
        //         }

        //         // const minDeposit = 1000000n;
        //         // const randomDeposit = BigInt(Math.floor(Math.random() * 100));
        //         //const depositAmount = randomDeposit + minDeposit;
        //         const depositAmount = 10000n;
        //         totalDividendDeposited += depositAmount;
        //         console.log(`---------- Iteration ${i+1} ----------`);
        //         console.log(`Total staked: ${totalStaked.toString()}`);
        //         console.log(`Deposit amount: ${depositAmount.toString()}`);
        //         console.log(`Stakers: ${stakersForThisIteration.length}`);

        //         await USDCToken.connect(deployer).approve(staking.target, depositAmount);
        //         await staking.connect(deployer).depositDividend(USDCToken.target, depositAmount);
                
        //         for (const staker of stakersForThisIteration) {
        //             console.log(`Checking staker ${await staker.getAddress()}`);
        //             console.log(`Percentage of total staked: ${(BigInt(await staking.balanceOf(staker.getAddress())) / totalStaked * 100n).toString()}%`);
                    
        //             const stakedBalance = await staking.balanceOf(staker.getAddress());
        //             const claimAmount = await staking.rewardOf(staker.getAddress());
        //             console.log(`> Staked balance: ${stakedBalance.toString()}`);
        //             console.log(`> Claim amount: ${claimAmount.toString()}`);                    
                                      
        //             await staking.connect(staker).claim(true, false, false, false);
        //             console.log(`> Claimed reward`);
                    
        //             const newClaimAmount = await staking.rewardOf(staker.getAddress());
        //             console.log(`> New claim amount: ${newClaimAmount.toString()}`);
        //             expect(newClaimAmount.usdcAmount).to.equal(0n);

        //             const rewardBalance = await USDCToken.balanceOf(staker.getAddress());
        //             console.log(`> Reward balance: ${rewardBalance.toString()}`);     
        //             expect(rewardBalance).to.equal(claimAmount.usdcAmount);

        //             await USDCToken.connect(staker).transfer(deployer.getAddress(), claimAmount.usdcAmount);
        //             await staking.connect(staker).unStake(stakedBalance); 
        //         }

        //         const stakingContractBalance = await USDCToken.balanceOf(staking.target);
        //         console.log(`Inital deposit reward amount per iteration before all claimed: ${depositAmount.toString()}`);
        //         console.log(`Accumulated Staking contract balance after all claimed: ${stakingContractBalance.toString()}`);
        //         console.log(`Total dividend deposited: ${totalDividendDeposited.toString()} wei, in USD: ${totalDividendDeposited / 1000000n}`);
        //         const roundingErrors = await staking.roundingErrors(USDCToken.target);             
        //         console.log(`---------- End iteration ${i+1} ----------`);                
        //         //await rewardToken.connect(staking.runner).transfer(deployer.getAddress(), stakingContractBalance);
        //     }
        // });

        // it("Fuzz Distribute USDC Rewards in Ranges", async () => {
        //     let ITERATIONS = 28;  // Increase iterations for more thorough fuzzing
        //     let MAX_TOTAL_STAKERS = 0; // 0 for only default accounts or set to a number for more accounts (slower)

        //     if(ITERATIONS === 0) return;

        //     let totalDividendDeposited = 0n;

        //     // Add more stakers here
        //     const randomAccounts = [];
        //     const initialFunding = ethers.parseEther("1"); // 1 ETH for example
        
        //     // Fetch the default accounts
        //     const [defaultAccount] = await ethers.getSigners();

        //     if(MAX_TOTAL_STAKERS != 0){                
        //         for (let i = 0; i < MAX_TOTAL_STAKERS; i++) {
        //             const wallet = ethers.Wallet.createRandom();
        //             const signer = wallet.connect(ethers.provider);
        //             randomAccounts.push(signer);            
      
        //             // percentage left iteration vs total iterations
        //             const percentage = (i + 1) / MAX_TOTAL_STAKERS * 100;
      
        //             // percentage to String then max two decimal places
        //             const percentageString = percentage.toFixed(2);
      
        //             // iterations left
        //             const iterationsLeft = MAX_TOTAL_STAKERS - i;
              
        //             console.log(`[Fuzz Distribute USDC Rewards in Ranges] Creating Accounts with ETH Queue: ${iterationsLeft}. Progress: ${percentageString}%.`);
      
        //             // Send 1 ETH to the generated account
        //             await defaultAccount.sendTransaction({
        //               to: signer.address,
        //               value: initialFunding
        //             });
        //           }  
        //         potentialStakers = randomAccounts;  
        //     }
        
        //     interface StakeRanges {
        //         [key: string]: bigint[];
        //     }
        //     interface DepositRanges {
        //         [key: string]: bigint[];
        //     }
        //     interface DurationRanges {
        //         [key: string]: number[];
        //     }
        //     interface Summary {
        //         [key: string]: number | bigint | any;
        //     }
        //     interface Log {
        //         [key: string]: string | number | boolean | any[];
        //     }

        //     const summary: Summary = {
        //         // superlow: 0,
        //         // low: 0,
        //         // medium: 0,
        //         // high: 0,
        //         depositRange: {
        //             superlow: 0,
        //             low: 0,
        //             medium: 0,
        //             high: 0,
        //         },
        //         durationRange: {
        //             superlow: 0,
        //             low: 0,
        //             medium: 0,
        //             high: 0,                    
        //         },
        //         stakeRange: {
        //             superlow: 0,
        //             low: 0,
        //             low_medium: 0,
        //             low_high: 0,
        //             medium: 0,
        //             medium_high: 0,
        //             high: 0,
        //             very_high: 0,
        //         },
        //         lowestDeposited: BigInt(Number.MAX_SAFE_INTEGER),  
        //         highestDeposited: 0n,
        //         lowestDepositIteration: 0,
        //         highestDepositIteration: 0,
        //         lowestDepositDetails: null,
        //         highestDepositDetails: null
        //     };
            
        //     const depositRanges: DepositRanges = {
        //         superlow: [25341n, 253411n], // Corresponding to total cost range 1-10 (10**6)
        //         low: [253411n, 2534113n], // Corresponding to total cost range 10-100 (10**6)
        //         medium: [2534113n, 25341130n], // Corresponding to total cost range 100-1000 (10**6)
        //         high: [25341130n, 253411306n] // Corresponding to total cost range 1000-10000 (10**6)
        //     };

        //     const stakeRanges: StakeRanges = {
        //         superlow: [100000000000000000n, 1000000000000000000n], // 0,1 to 1 (10**18)
        //         low: [1000000000000000001n, 10000000000000000000n], // 1 to 1 (10**18)
        //         low_medium: [1000000000000000001n, 100000000000000000000n], // 10 to 100 (10**18)
        //         low_high: [100000000000000000001n, 1000000000000000000000n], // 100 to 1000 (10**18)
        //         medium: [1000000000000000000001n, 10000000000000000000000n], // 1000 to 10,000 (10**18)
        //         medium_high: [10000000000000000000001n, 100000000000000000000000n], // 10,000 to 100,000 (10**18)
        //         high: [100000000000000000000001n, 1000000000000000000000000n], // 100,000 to 1,000,000 (10**18)    
        //         very_high: [10000000000000000000000000n, 50000000000000000000000000n], // 10,000,000 to 50,000,000 (10**18)
        //     };

        //     const durationRanges: DurationRanges = {
        //         superlow: [1, 1], // 1 day
        //         low: [1, 1], // 1 day
        //         medium: [1, 1], // 1 day
        //         high: [7, 7], // 7 days
        //     };

        //     let totalClaimed = 0n;
        //     let log: Log[] = [];
        //     let timePassed: string = '';
        //     let duration = 7 * 24 * 60 * 60;
        //     await staking.connect(deployer).setRewardsDuration(duration);

        //     for (let i = 0; i < ITERATIONS; i++) {
        //         const numStakers = Math.max(10, Math.floor(Math.random() * potentialStakers.length));
        //         const stakersForThisIteration = potentialStakers.slice(0, numStakers);

        //         let totalStakedInIteration = 0n;   
        //         let maxTokensPerIteration = BigInt(100000000 * 1e18);               
        //         let selectedStakeKey: string[] = [];
        //         let selectedStateKeySimple: string[] = [];
        //         let stakeRange! : bigint[];
        //         let stakersWhoStaked: string[] = [];

        //         let stakerIndex = 0;
        //         for (const staker of stakersForThisIteration) {
        //             // percentage left iteration vs total iterations
        //             const percentage = (stakerIndex + 1) / stakersForThisIteration.length * 100;
        //             stakerIndex++;
        //             // percentage to String then max two decimal places
        //             const percentageString = percentage.toFixed(2);

        //             // iterations left
        //             const iterationsLeft = stakersForThisIteration.length - stakerIndex;
                
        //             console.log(`[Fuzz Distribute USDC Rewards in Ranges] Transfer, Approve & Stake CSXTokens: ${iterationsLeft}. Progress: ${percentageString}%.`);
        //             // Randomly select a range for stake
        //             const _selectedStakeKey = Object.keys(stakeRanges)[Math.floor(Math.random() * Object.keys(stakeRanges).length)];
        //             summary.stakeRange[_selectedStakeKey]++;
        //             const _stakeRange = stakeRanges[_selectedStakeKey];
        //             let amount = BigInt(Math.floor(Math.random() * Number((_stakeRange[1] - _stakeRange[0])) + Number(_stakeRange[0])));
        //             let amountInDecimalEther = (parseFloat(amount.toString()) / 1e18).toFixed(2); // Up to 18 decimal points
                    
        //             amountInDecimalEther = parseFloat(amountInDecimalEther).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        //             selectedStakeKey.push(`${_selectedStakeKey} : ${amount.toString()} wei : ${amountInDecimalEther} CSX.`);
        //             selectedStateKeySimple.push(`${_selectedStakeKey} : ${amount.toString()}`);
        //             stakeRange = _stakeRange;

        //             if (totalStakedInIteration + amount > maxTokensPerIteration) {                       
        //                 //5console.warn(`Max tokens for this iteration reached. Skipping staking for ${await staker.getAddress()}.`);
        //                 continue;
        //             }
                    
        //             //console.log(`Attempting to transfer and stake ${ethers.formatEther(amount.toString())} tokens from deploy with balance ${ethers.formatEther(await CSXToken.balanceOf(deployer.getAddress()))} for staker ${await staker.getAddress()}`);                
        //             await CSXToken.connect(deployer).transfer(staker.getAddress(), amount);
        //             //console.log(`Transferred ${amount.toString()} tokens`);
                
        //             await CSXToken.connect(staker).approve(staking.target, MAX_SUPPLY);
        //             //console.log(`Approved ${approvalAmount.toString()} tokens`);
                
        //             await staking.connect(staker).stake(amount);
        //             //console.log(`Staked ${amount.toString()} tokens`);

        //             stakersWhoStaked.push(await staker.getAddress());
                
        //             totalStakedInIteration += amount;
        //         }                
        
        //         // Randomly select a range for deposit
        //         const selectedDepositKey = Object.keys(depositRanges)[Math.floor(Math.random() * Object.keys(depositRanges).length)];
        //         const depositRange = depositRanges[selectedDepositKey];
        //         const depositAmount = BigInt(Math.floor(Math.random() * Number((depositRange[1] - depositRange[0])) + Number(depositRange[0])));

        //         // Check if the deposit amount is lower or higher than the current lowest or highest
        //         if (depositAmount < summary.lowestDeposited) {
        //             summary.lowestDeposited = depositAmount;
        //             summary.lowestDepositIteration = i + 1;
        //             summary.lowestDepositDetails = {
        //                 totalStakers: stakersWhoStaked.length,
        //                 totalStaked: totalStakedInIteration.toString(),
        //                 totalStakedInCSX: (parseFloat(totalStakedInIteration.toString()) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),                     
        //                 depositAmount: depositAmount.toString(),
        //                 depositAmountInUSDC: (parseFloat(depositAmount.toString()) / 1e6).toFixed(2),
        //                 distributionAmount: selectedDepositKey,
        //                 stakersBagSize: selectedStakeKey,
        //                 stakeRange: stakeRange.toString(),                        
        //                 depositRange: depositRange.toString(),                           
        //             };
        //         }
        //         if (depositAmount > summary.highestDeposited) {
        //             summary.highestDeposited = depositAmount;
        //             summary.highestDepositIteration = i + 1;
        //             summary.highestDepositDetails = {
        //                 totalStakers: stakersWhoStaked.length,
        //                 totalStaked: totalStakedInIteration.toString(),
        //                 totalStakedInCSX: (parseFloat(totalStakedInIteration.toString()) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),                     
        //                 depositAmount: depositAmount.toString(),
        //                 depositAmountInUSDC: (parseFloat(depositAmount.toString()) / 1e6).toFixed(2),
        //                 distributionAmount: selectedDepositKey,
        //                 stakersBagSize: selectedStakeKey,
        //                 stakeRange: stakeRange.toString(),                        
        //                 depositRange: depositRange.toString(),   
        //             };
        //         }

        //         totalDividendDeposited += depositAmount;
        //         summary.depositRange[selectedDepositKey]++;
        //         summary.durationRange[selectedDepositKey]++;
                
        
        //         //console.log(`---------- Iteration ${i+1} ----------`);
        //         // console.log(`Total staked in iteration: ${totalStakedInIteration.toString()}`);
        //         // console.log(`Deposit amount: ${depositAmount.toString()}`);
        //         // console.log(`Stakers: ${stakersForThisIteration.length}`);

        //         await USDCToken.connect(deployer).approve(staking.target, depositAmount);
        //         //await staking.connect(deployer).depositDividend(USDCToken.target, depositAmount);
        //         // Send reward tokens to staking contract
        //         // Example duration of one week
        //         console.log(`staking contract balance before: ${await USDCToken.balanceOf(await staking.getAddress())}`);
        //         await USDCToken.connect(deployer).transfer(await staking.getAddress(), depositAmount);
        //         console.log(`staking contract balance after: ${await USDCToken.balanceOf(await staking.getAddress())}`);
        //         console.log(`Deposit amount: ${depositAmount.toString()}`);            
                
        //         if (depositAmount >= depositRanges['superlow'][0] && depositAmount <= depositRanges['superlow'][1]) {
        //             duration = durationRanges['superlow'][1];
        //         } else if (depositAmount >= depositRanges['low'][0] && depositAmount <= depositRanges['low'][1]) {
        //             duration = durationRanges['low'][1];
        //         } else if (depositAmount >= depositRanges['medium'][0] && depositAmount <= depositRanges['medium'][1]) {
        //             duration = durationRanges['medium'][1] * 24 * 60 * 60;
        //         } else if (depositAmount >= depositRanges['high'][0] && depositAmount <= depositRanges['high'][1]) {
        //             duration = durationRanges['high'][1] * 24 * 60 * 60;
        //         } else {
        //             console.log(`incorrect deposit amount ${depositAmount.toString()}`);
        //             // Handle cases that don't fit into any of the ranges
        //             // This could be for values smaller than 'superlow' or larger than 'high'
        //             // You can set a default duration or handle it differently.
        //             //duration = 7 * 24 * 60 * 60; // Example duration of one week
        //         }

        //         //await staking.connect(deployer).setRewardsDuration(duration);

        //         console.log(`current depositRange ${selectedDepositKey}`);
        //         console.log(`current durationRange ${durationRanges[selectedDepositKey][1]}`);
        //         console.log(`duration ${duration.toString()}`);
                
                
        //         console.log(`rewardRate (on-chain)`, await staking.rewardRate());
        //         console.log(`rewardRate (calculated) ${depositAmount / BigInt(duration)}`);
                
        //         console.log(`rewardPerToken (on-chain)`, await staking.rewardPerToken());
                
                
        //         // superlow: [25341n, 253411n], // Corresponding to total cost range 1-10 (10**6)
        //         // low: [253411n, 2534113n], // Corresponding to total cost range 10-100 (10**6)
        //         // medium: [2534113n, 25341130n], // Corresponding to total cost range 100-1000 (10**6)
        //         // high: [25341130n, 253411306n] // Corresponding to total cost range 1000-10000 (10**6)
                
                
                
                
        //         await staking.connect(deployer).notifyRewardAmount(depositAmount);
                
                

        //         for (const staker of stakersForThisIteration) {
        //             const stakerAddress = await staker.getAddress();

        //             // Skip unstaking if the staker didn't successfully stake.
        //             if (!stakersWhoStaked.includes(stakerAddress)) {
        //                 continue;
        //             }
                    
        //             // percentage left iteration vs total iterations
        //             const percentage = (i + 1) / ITERATIONS * 100;

        //             // percentage to String then max two decimal places
        //             const percentageString = percentage.toFixed(2);
                    
        //             // iterations left
        //             const iterationsLeft = (ITERATIONS - (i + 1));

        //             // Calculate timeleft and store how long time has passed
        //             const timeLeftSeconds = iterationsLeft * 0.5;
        //             const timeLeftMinutes = Math.floor(timeLeftSeconds / 60);
        //             const timeLeftSecondsLeft = Math.floor(timeLeftSeconds % 60);
        //             const timeLeft = `${timeLeftMinutes} minutes and ${timeLeftSecondsLeft} seconds`;
        //             timePassed = `${Math.floor((i + 1) * 0.5 / 60)} minutes and ${Math.floor((i + 1) * 0.5 % 60)} seconds`;

        //             console.log(`[Fuzz Distribute USDC Rewards in Ranges] Scenarios Queue: ${iterationsLeft}. Progress: ${percentageString}%. Timeleft: ${timeLeft}.`);             

        //             const stakedBalance = await staking.balanceOf(staker.getAddress());        
        //             console.log(`> Staked balance: ${stakedBalance.toString()}`);
        //             const currentStakeRange = selectedStateKeySimple.find((stakeKey) => {
        //                 return stakeKey.split(" : ")[1] === stakedBalance.toString();
        //             });

        //             // Fast forward time to simulate staking for a duration
        //             await ethers.provider.send("evm_increaseTime", [duration*2]);
        //             await ethers.provider.send("evm_mine", []);
        //             //console.log(`> Fast forward time past the duration time.`);

        //             const claimAmount = await staking.earned(staker.getAddress());
        //             //console.log(`> Claim amount: ${claimAmount.toString()}`);   
        //             totalClaimed += claimAmount;
        //             await staking.connect(staker).getReward();
        //             //console.log(`> Claimed reward`);
                    
        //             const newClaimAmount = await staking.earned(staker.getAddress());
        //             //console.log(`> New claim amount: ${newClaimAmount.toString()}`);
        //             expect(newClaimAmount).to.equal(0n);

        //             const rewardBalance = await USDCToken.balanceOf(staker.getAddress());
        //             //console.log(`> Reward balance: ${rewardBalance.toString()}`);     
        //             expect(rewardBalance).to.equal(claimAmount);

        //             const gotRewards = rewardBalance > 0n ? true : false;

        //             const thelog: Log = {
        //                 currentRewardForAll: depositAmount.toString(),
        //                 stakerAddress: stakerAddress,
        //                 stakedBalance: stakedBalance.toString(),
        //                 stakedRange: currentStakeRange!.split(" : ")[0],
        //                 claimAmountBefore: claimAmount.toString(),
        //                 claimAmountAfter: newClaimAmount.toString(),
        //                 rewardBalance: rewardBalance.toString(),
        //                 gotRewards: gotRewards,
        //             };

        //             log.push(thelog);

        //             await USDCToken.connect(staker).transfer(deployer.getAddress(), claimAmount);
        //             await staking.connect(staker).withdraw(stakedBalance); 
        //             await CSXToken.connect(staker).transfer(deployer.getAddress(), stakedBalance);
        //         }

        //         stakersWhoStaked = [];

        //         //const stakingContractBalance = await USDCToken.balanceOf(staking.target);
        //         // console.log(`Inital deposit reward amount per iteration before all claimed: ${depositAmount.toString()}`);
        //         // console.log(`Accumulated Staking contract balance after all claimed: ${stakingContractBalance.toString()}`);
        //         // console.log(`Total dividend deposited: ${totalDividendDeposited.toString()}`);       
        //         // console.log(`---------- End iteration ${i+1} ----------`);      
        //     }
        //     console.log(`[Fuzz Distribute USDC Rewards in Ranges] Scenarios Queue Empty. Took ${timePassed}.`);
        //     console.log("----------------- Summary ----------------");
        //     console.log(`Total scenarios: ${ITERATIONS}`);
        //     console.log(`Total dividend deposited: ${totalDividendDeposited.toString()} wei, in USDC: ${(Number(totalDividendDeposited) / 1e6).toFixed(2)}`);      
        //     console.log(`Total claimed: ${totalClaimed.toString()} wei, in USDC: ${(Number(totalClaimed) / 1e6).toFixed(2)}`);
        //     console.log(`Left over (calculated): ${totalDividendDeposited - totalClaimed} wei, in USDC: ${(Number(totalDividendDeposited - totalClaimed) / 1e6)}`);
        //     console.log(`Left over (onchain): ${await USDCToken.balanceOf(staking.target)} wei, in USDC: ${(Number(await USDCToken.balanceOf(staking.target)) / 1e6)}`);
        //     console.log("----------- Distribution Ranges ---------- ");
        //     console.log(`Superlow range seen in ${summary.depositRange.superlow} scenarios (Item sale of 1-10 USDC on 2.6% fee)`);
        //     console.log(`Low range seen in ${summary.depositRange.low} scenarios (Item sale of 10-100 USDC on 2.6% fee)`);
        //     console.log(`Medium range seen in ${summary.depositRange.medium} scenarios (Item sale of 100-1000 USDC on 2.6% fee)`);
        //     console.log(`High range seen in ${summary.depositRange.high} scenarios (Item sale of 1000-10000 USDC on 2.6% fee))`);
        //     console.log(`-------------- Stake Ranges -------------- `);
        //     console.log(`Superlow range seen in ${summary.stakeRange.superlow} scenarios (Stake of 0,1 to 1 CSX)`);
        //     console.log(`Low range seen in ${summary.stakeRange.low} scenarios (Stake of 1 to 10 CSX)`);
        //     console.log(`Low-Medium range seen in ${summary.stakeRange.low_medium} scenarios (Stake of 10 to 100 CSX)`);
        //     console.log(`Low-High range seen in ${summary.stakeRange.low_high} scenarios (Stake of 100 to 1000 CSX)`);
        //     console.log(`Medium range seen in ${summary.stakeRange.medium} scenarios (Stake of 1000 to 10,000 CSX)`);
        //     console.log(`Medium-High range seen in ${summary.stakeRange.medium_high} scenarios (Stake of 10,000 to 100,000 CSX)`);
        //     console.log(`High range seen in ${summary.stakeRange.high} scenarios (Stake of 100,000 to 1,000,000 CSX)`);
        //     console.log(`Very High range seen in ${summary.stakeRange.very_high} scenarios (Stake of 10,000,000 to 50,000,000 CSX)`);
        //     console.log(`-------------- Duration Ranges -------------- `);
        //     console.log(`Superlow range seen in ${summary.durationRange.superlow} scenarios (Duration of 1 second)`);
        //     console.log(`Low range seen in ${summary.durationRange.low} scenarios (Duration of 1 second)`);    
        //     console.log(`Medium range seen in ${summary.durationRange.medium} scenarios (Duration of 1 day)`);
        //     console.log(`High range seen in ${summary.durationRange.high} scenarios (Duration of 7 days)`);
        //     console.log("------------------------------------------");
        //     const allGotRewards = log.filter((log) => log.gotRewards === true);
        //     const notAllGotRewards = log.filter((log) => log.gotRewards === false);
        //     console.log(`Total stakers got rewarded: ${allGotRewards.length} out of ${log.length} stakers.`);
        //     console.log(`Total stakers not rewarded: ${notAllGotRewards.length} out of ${log.length} stakers.`);
        //     // Majority of stakers got rewarded was from what range?
        //     const superlowGotRewards = allGotRewards.filter((log) => log.stakedRange === "superlow" && log.gotRewards === true);
        //     const lowGotRewards = allGotRewards.filter((log) => log.stakedRange === "low" && log.gotRewards === true);
        //     const low_mediumGotRewards = allGotRewards.filter((log) => log.stakedRange === "low_medium" && log.gotRewards === true);
        //     const low_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "low_high" && log.gotRewards === true);
        //     const mediumGotRewards = allGotRewards.filter((log) => log.stakedRange === "medium" && log.gotRewards === true);
        //     const medium_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "medium_high" && log.gotRewards === true);
        //     const highGotRewards = allGotRewards.filter((log) => log.stakedRange === "high" && log.gotRewards === true);
        //     const very_highGotRewards = allGotRewards.filter((log) => log.stakedRange === "very_high" && log.gotRewards === true);
        //     const mostCommonGotRewards = Math.max(superlowGotRewards.length, lowGotRewards.length, low_mediumGotRewards.length, low_highGotRewards.length, mediumGotRewards.length, medium_highGotRewards.length, highGotRewards.length, very_highGotRewards.length);
        //     if (mostCommonGotRewards === superlowGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: superlow (${superlowGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === lowGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: low (${lowGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === low_mediumGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: low_medium (${low_mediumGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === low_highGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: low_high (${low_highGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === mediumGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: medium (${mediumGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === medium_highGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: medium_high (${medium_highGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === highGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: high (${highGotRewards.length} stakers)`);
        //     } else if (mostCommonGotRewards === very_highGotRewards.length) {
        //         console.log(`Most common stake-amount range that got rewarded: very_high (${very_highGotRewards.length} stakers)`);
        //     }
        //     const superlowGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "superlow" && log.gotRewards === false);
        //     const lowGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low" && log.gotRewards === false);
        //     const low_mediumGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low_medium" && log.gotRewards === false);
        //     const low_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "low_high" && log.gotRewards === false);
        //     const mediumGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "medium" && log.gotRewards === false);
        //     const medium_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "medium_high" && log.gotRewards === false);
        //     const highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "high" && log.gotRewards === false);
        //     const very_highGotNotRewards = notAllGotRewards.filter((log) => log.stakedRange === "very_high" && log.gotRewards === false);
        //     const mostCommonGotNotRewards = Math.max(superlowGotNotRewards.length, lowGotNotRewards.length, low_mediumGotNotRewards.length, low_highGotNotRewards.length, mediumGotNotRewards.length, medium_highGotNotRewards.length, highGotNotRewards.length, very_highGotNotRewards.length);
        //     if (mostCommonGotNotRewards === superlowGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: superlow (${superlowGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === lowGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: low (${lowGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === low_mediumGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: low_medium (${low_mediumGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === low_highGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: low_high (${low_highGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === mediumGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: medium (${mediumGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === medium_highGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: medium_high (${medium_highGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === highGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: high (${highGotNotRewards.length} stakers)`);
        //     } else if (mostCommonGotNotRewards === very_highGotNotRewards.length) {
        //         console.log(`Most common stake-amount range that got not rewarded: very_high (${very_highGotNotRewards.length} stakers)`);
        //     }            
        //     console.log("------------------------------------------");           
        //     console.log(`Lowest distribution amount: ${summary.lowestDeposited.toString()} wei, in USDC: ${(Number(summary.lowestDeposited) / 1e6).toFixed(2)}`);
        //     console.log(`Highest distribution amount: ${summary.highestDeposited.toString()} wei, in USDC: ${(Number(summary.highestDeposited) / 1e6).toFixed(2)}`);            
        //     console.log("------------------------------------------");
        //     console.log(`Lowest distribution amount occurred in scenario ${summary.lowestDepositIteration}: ${summary.lowestDeposited.toString()} wei, in USDC: ${(Number(summary.lowestDeposited) / 1e6).toFixed(2)}`);
        //     const lowestDistributionLog = log.filter((log) => log.currentRewardForAll === summary.lowestDeposited.toString());
        //     const lowestDistributionLogGotRewards = lowestDistributionLog.filter((log) => log.gotRewards === true);
        //     console.log(`STAKERS WHO GOT REWARDED: ${lowestDistributionLogGotRewards.length} out of ${lowestDistributionLog.length} stakers.`);
        //     //console.log(`Lowest Metadata: `, JSON.stringify(summary.lowestDepositDetails, null, 2));
        //     //console.log(`Lowest distribution log: `, JSON.stringify(lowestDistributionLog, null, 2));
        //     console.log("------------------------------------------");
        //     console.log(`Highest distribution amount occurred in scenario ${summary.highestDepositIteration}: ${summary.highestDeposited.toString()} wei, in USDC: ${(Number(summary.highestDeposited) / 1e6).toFixed(2)}`);
        //     const highestDistributionLog = log.filter((log) => log.currentRewardForAll === summary.highestDeposited.toString()); 
        //     const highestDistributionLogGotRewards = highestDistributionLog.filter((log) => log.gotRewards === true);
        //     console.log(`STAKERS WHO GOT REWARDED: ${highestDistributionLogGotRewards.length} out of ${highestDistributionLog.length} stakers.`);
        //     //console.log(`Highest Metadata: `, JSON.stringify(summary.highestDepositDetails, null, 2));
        //     //console.log(`Highest distribution log: `, JSON.stringify(highestDistributionLog, null, 2));  
        //     console.log("------------------------------------------");
        //     console.log("-------------  Summary End ---------------");
        // });        

        // it("Distribute WETH Rewards", async()=> {

        //     const user1amount = ethers.parseEther("500");
        //     await CSXToken.connect(deployer).transfer(user1.getAddress(), user1amount);
        //     await CSXToken.connect(user1).approve(staking.target, user1amount);
        //     await staking.connect(user1).stake(user1amount);

        //     const distributeAmount = ethers.parseUnits("500", 6);
        //     await WETHToken.connect(deployer).deposit({value: ethers.parseEther("50")});
        //     await WETHToken.connect(deployer).approve(staking.target, MAX_SUPPLY);           
            
        //     await staking.connect(deployer).depositDividend(WETHToken.target, distributeAmount);

        //     // Check reward balance of staking contract
        //     const rewardBalance = await WETHToken.balanceOf(staking.target);    
        //     expect(distributeAmount).to.equal(rewardBalance);

        //     // Check last reward
        //     const lastRewardRate = await staking.lastRewardRate(WETHToken.target);
        //     //console.log(lastRewardRate.toString());      
        //     // 10**33 is the precision of the reward rate
        //     const precision = 10n**33n;
        //     expect(Number(lastRewardRate.toString())).to.equal(Number((distributeAmount * precision / user1amount).toString()));
        // });

        it("Fuzz Distribute WETH Rewards", async()=> {
            let ITERATIONS = 0;
            if(ITERATIONS === 0) return;
            const convertWethToEth = true;
            let totalDividendDeposited = 0n;
            
            for (let i = 0; i < ITERATIONS; i++) {
                const numStakers = Math.floor(Math.random() * potentialStakers.length) + 1;
                const stakersForThisIteration = potentialStakers.slice(0, 1);

                let totalStaked = 0n;

                for (const staker of stakersForThisIteration) {
                    const amount = BigInt(Math.floor(Math.random() * 1000000000000) + 1);
                    await CSXToken.connect(deployer).transfer(staker.getAddress(), amount);
                    await CSXToken.connect(staker).approve(staking.target, MAX_SUPPLY);
                    await staking.connect(staker).stake(amount);
                    totalStaked += amount;
                }

                //const minDeposit = 100000n;
                // min deposit is 1 eth
                const minDeposit = ethers.parseEther("1");
                const randomDeposit = BigInt(Math.floor(Math.random() * 1000000000000));
                const depositAmount = randomDeposit + minDeposit;
                console.log(`RandomDeposit`, randomDeposit.toString());
                console.log(`MinDeposit`, minDeposit.toString());                
                
                totalDividendDeposited += depositAmount;
                console.log(`---------- Iteration ${i+1} ----------`);
                console.log(`Total staked: ${totalStaked.toString()}`);
                console.log(`Deposit amount: ${depositAmount.toString()}`);
                console.log(`Stakers: ${stakersForThisIteration.length}`);

                await WETHToken.connect(deployer).deposit({value: depositAmount});                
                await WETHToken.connect(deployer).approve(staking.target, depositAmount);
                await staking.connect(deployer).depositDividend(WETHToken.target, depositAmount);
                
                for (const staker of stakersForThisIteration) {
                    console.log(`Checking staker ${await staker.getAddress()}`);
                    console.log(`Percentage of total staked: ${(BigInt(await staking.balanceOf(staker.getAddress())) / totalStaked * 100n).toString()}%`);
                    
                    const stakedBalance = await staking.balanceOf(staker.getAddress());
                    const claimAmount = await staking.rewardOf(staker.getAddress());
                    console.log(`> Staked balance: ${stakedBalance.toString()}`);
                    console.log(`> Claim amount: ${claimAmount.toString()}`);                    
                    
                    const ethBalanceBefore = await ethers.provider.getBalance(staker.getAddress());
                    
                    // claimUsdc, claimUsdt, claimWeth, convertWethToEth
                    await staking.connect(staker).claim(false, false, true, convertWethToEth);
                    console.log(`> Claimed reward`);
                    
                    const newClaimAmount = await staking.rewardOf(staker.getAddress());
                    console.log(`> New claim amount: ${newClaimAmount.toString()}`);
                    expect(newClaimAmount.wethAmount).to.equal(0n);

                    let rewardBalance;
                    if (convertWethToEth) {
                        const ethBalanceNow = await ethers.provider.getBalance(staker.getAddress());
                        console.log(`> Eth balance before: ${ethBalanceBefore.toString()}`);
                        console.log(`> Eth balance now: ${ethBalanceNow.toString()}`);                        
                        rewardBalance = ethBalanceNow - ethBalanceBefore;
                        // expect closeTo with delta of based on small percentage of the reward since eth is self-consuming.
                        expect(rewardBalance).to.closeTo(claimAmount.wethAmount, 100000000000000000n);
                        await staker.sendTransaction({to: deployer.getAddress(), value: rewardBalance});
                    } else {
                        rewardBalance = await WETHToken.balanceOf(staker.getAddress());
                        expect(rewardBalance).to.equal(claimAmount.wethAmount);
                        await WETHToken.connect(staker).transfer(deployer.getAddress(), claimAmount.wethAmount);
                    }

                    console.log(`> Reward balance: ${rewardBalance.toString()}`);
                    await staking.connect(staker).unStake(stakedBalance); 
                }

                const stakingContractBalance = await WETHToken.balanceOf(staking.target);
                console.log(`Inital deposit reward amount before all claimed: ${depositAmount.toString()}`);
                console.log(`Accumulated Staking contract balance after all claimed: ${stakingContractBalance.toString()}`);
                console.log(`Total dividend deposited: ${totalDividendDeposited.toString()}`);           
                console.log(`---------- End iteration ${i+1} ----------`);
                //await rewardToken.connect(staking.runner).transfer(deployer.getAddress(), stakingContractBalance);
            }
        });
    });
});