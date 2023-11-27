import { USDCToken, USDTToken, WETH9Mock } from "../../typechain-types/contracts/CSX/mock";
import { CSXToken } from "../../typechain-types/contracts/CSX";
import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { Keepers, StakedCSX } from "../../typechain-types";

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
    const MAX_SUPPLY = ethers.parseEther("100000000");

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
        staking = (await Staking.deploy(
        await CSXToken.getAddress(),
        await WETHToken.getAddress(),
        await USDCToken.getAddress(),
        await USDTToken.getAddress(),
        await keepers.getAddress(),
        )) as StakedCSX;
        await staking.waitForDeployment();

        // console.log("Staking Token deployed to:", stakingToken.target);
        // console.log("Reward Token deployed to:", rewardToken.target);
        // console.log("Staking contract deployed to:", staking.target);
    });

    describe("Stake", function () {
        it("User1 stakes 300 CSX tokens", async()=> {
            const amount = ethers.parseEther("300");
            await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
            await CSXToken.connect(user1).approve(staking.target, amount);
            await staking.connect(user1).stake(amount);
            expect(await staking.balanceOf(user1.getAddress())).to.equal(amount);
            expect(await staking.rewardRate(USDCToken.target, user1.getAddress())).to.equal(0);
        });

        it("User2 stakes 500 CSX tokens", async()=> {
            const amount = ethers.parseEther("500");
            await CSXToken.connect(deployer).transfer(user2.getAddress(), amount);
            await CSXToken.connect(user2).approve(staking.target, amount);
            await staking.connect(user2).stake(amount);
            expect(await staking.balanceOf(user2.getAddress())).to.equal(amount); 
            expect(await staking.rewardRate(USDCToken.target, user2.getAddress())).to.equal(0);  
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
            const user1amount = ethers.parseEther("500");
        
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

            await staking.connect(council).distribute(true, true, true);
            
            // Check reward balance of staking contract
            const rewardBalance = await USDCToken.balanceOf(staking.target);    
            expect(distributeAmount).to.equal(rewardBalance);
        
            // Check last reward
            const lastRewardRate = await staking.lastRewardRate(USDCToken.target);
            const precision = 10n ** 33n;
            expect(Number(lastRewardRate.toString())).to.equal(Number((distributeAmount * precision / user1amount).toString()));
        });

        it("Should revert if not enough reward tokens", async()=> {
            const amount = ethers.parseEther("500");
            await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
            await CSXToken.connect(user1).approve(staking.target, amount);
            await staking.connect(user1).stake(amount);
            await expect(staking.connect(council).distribute(true, true, true)).to.be.revertedWithCustomError(staking, "NoTokensMinted");
        });

        it("Should revert if not council distributes", async()=> {
            const amount = ethers.parseEther("500");
            await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
            await CSXToken.connect(user1).approve(staking.target, amount);
            await staking.connect(user1).stake(amount);
            await expect(staking.connect(user1).distribute(true, true, true)).to.be.revertedWithCustomError(staking, "InvalidUser");
        });

        it("Council should distribute rewards", async()=> {
            const amount = ethers.parseEther("500");
            const distributeAmount = ethers.parseUnits("500", 6);
            await CSXToken.connect(deployer).transfer(user1.getAddress(), amount);
            await CSXToken.connect(user1).approve(staking.target, amount);
            await staking.connect(user1).stake(amount);
            await USDCToken.connect(deployer).approve(staking.target, distributeAmount);    
            await staking.connect(deployer).depositDividend(USDCToken.target, distributeAmount);
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
            await expect(staking.connect(keeperNode).distribute(true, true, true)).to.emit(staking, "Distribute");
        });

        it("Fuzz Distribute USDC Rewards in Ranges", async () => {
            const CONSOLE_LOGGING = false; // Set to true to see console logs
            let ITERATIONS = 5;  // Increase iterations for more thorough fuzzing
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
                await staking.connect(council).distribute(true, true, true);
                
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