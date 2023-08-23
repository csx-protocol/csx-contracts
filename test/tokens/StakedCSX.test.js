const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");

const CSXToken = artifacts.require("CSXToken");
const StakedCSX = artifacts.require("StakedCSX");
const USDCToken = artifacts.require("USDCToken");
const USDTToken = artifacts.require("USDTToken");
const WETH9Mock = artifacts.require("WETH9Mock");

contract("StakedCSX", (accounts) => {
    let stakedCSX, usdc, usdt, weth;
    const [deployer, user1, user2, ...potentialStakers] = accounts;
    const stakeAmount = new BN("1000");

    beforeEach(async () => {
        csx = await CSXToken.new();
        weth = await WETH9Mock.new();
        usdc = await USDCToken.new();
        usdt = await USDTToken.new();
    
        stakedCSX = await StakedCSX.new(csx.address, weth.address, usdc.address, usdt.address);
    });
    

    it("should allow user to stake CSX and receive sCSX", async () => {
        await csx.transfer(user1, stakeAmount);
        await csx.approve(stakedCSX.address, stakeAmount, { from: user1 });
        await stakedCSX.stake(stakeAmount, { from: user1 });

        const balance = await stakedCSX.balanceOf(user1);
        expect(balance).to.be.bignumber.equal(stakeAmount);

        await stakedCSX.approve(stakedCSX.address, stakeAmount, { from: user1 });
        await stakedCSX.unStake(stakeAmount, { from: user1 });
    });

    it("should not allow user to stake more CSX than they have", async () => {
        const bigAmount = stakeAmount.mul(new BN("2"));
        await csx.transfer(user1, stakeAmount);
        await csx.approve(stakedCSX.address, bigAmount, { from: user1 });

        try {
            await stakedCSX.stake(bigAmount, { from: user1 });
            assert.fail("The transaction should have reverted");
        } catch (err) {
            expect(err.reason).to.equal("ERC20: transfer amount exceeds balance");
        }
    });

    it("fuzz test for staking and dividend distribution", async () => {
        const iterations = 1;
        const PRECISION = new BN('10').pow(new BN('33'));
        const CSX_DECIMALS = new BN('10').pow(new BN('18'));
        const USDC_DECIMALS = new BN('10').pow(new BN('6'));
    
        for (let i = 0; i < iterations; i++) {
            // Random number of stakers between 1 and potentialStakers.length
            const numStakers = Math.floor(Math.random() * potentialStakers.length) + 1;
    
            // Create a list of stakers for this iteration
            const stakersForThisIteration = potentialStakers.slice(0, numStakers);
    
            let totalStaked = new BN('0');
    
            for (const staker of stakersForThisIteration) {
                const stakeAmount = new BN(Math.floor(Math.random() * 5000) + 1).mul(CSX_DECIMALS);
    
                await csx.transfer(staker, stakeAmount);
                await csx.approve(stakedCSX.address, stakeAmount, { from: staker });
                await stakedCSX.stake(stakeAmount, { from: staker });
    
                totalStaked = totalStaked.add(stakeAmount);
            }

             const minDeposit = new BN(1000).mul(USDC_DECIMALS);
             const randomDeposit = new BN(Math.floor(Math.random() * 19900)).mul(USDC_DECIMALS);
             const depositAmount = minDeposit.add(randomDeposit);
             await usdc.transfer(deployer, depositAmount);
             await usdc.approve(stakedCSX.address, depositAmount);
             await stakedCSX.depositDividend(usdc.address, depositAmount);
     
             const dividendPerTokenForThisIteration = (depositAmount.mul(PRECISION)).div(totalStaked);
     
             for (const staker of stakersForThisIteration) {
                 const stakerBalance = await stakedCSX.balanceOf(staker);
                 const expectedDividendOLD = (dividendPerTokenForThisIteration.mul(stakerBalance)).div(PRECISION);
                 const expectedDividend = depositAmount.mul(stakerBalance).mul(PRECISION).div(totalStaked).div(PRECISION);
                 const expectedDividend2 = (dividendPerTokenForThisIteration.mul(stakerBalance)).div(PRECISION);

                 const { usdcAmount: claimAmount } = await stakedCSX.getClaimableAmount(staker);
     
                 try {
                    const depositAmountInUSDC = depositAmount.div(USDC_DECIMALS);
                     //console.log(`Fuzz Iteration ${i} testing with deposited amount ${depositAmountInUSDC.toString()} and staked amount ${stakerBalance.toString()}, and expected dividend ${expectedDividend.toString()} with total staked ${totalStaked.toString()} and total stakers ${numStakers}`);
                     //console.log(`claimAmount: ${claimAmount.toString()} and expectedDividend: ${expectedDividend.toString()}`);
                     //expect(claimAmount).to.be.bignumber.equal(expectedDividend);
                     expect(claimAmount).to.be.bignumber.closeTo(expectedDividend, USDC_DECIMALS);

                     
                 } catch (err) {
                     console.log("Failed iteration: ", i);
                     console.log("Staker balance (in CSX decimals): ", stakerBalance.toString());
                     console.log("Deposit amount (in USDC decimals): ", depositAmount.toString());
                     console.log(`Expected dividend: ${expectedDividend.toString()} and claim amount: ${claimAmount.toString()}`);
                     throw err;
                 }
             }
    
            // Claim the dividends and unstake
            for (const staker of stakersForThisIteration) {
                await stakedCSX.claim(true, false, false, false, { from: staker });
                const stakerBalance = await stakedCSX.balanceOf(staker);
                await stakedCSX.unStake(stakerBalance, { from: staker });
            }

        }
    });
});

