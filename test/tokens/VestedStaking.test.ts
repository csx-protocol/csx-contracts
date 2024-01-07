import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Signer } from "ethers";
// import { time } from "@openzeppelin/test-helpers";

describe("VestedStaking", function () {
    let vestedStaking: any,
        keepers: any,
        stakedCSX: any,
        vestedCSX: any,
        csx: any,
        usdc: any,
        usdt: any,
        weth: any,
        escrowedCSX: any;

    let deployer: Signer,
        vesterAddress: Signer,
        council: Signer,
        keeperNodeAddress: Signer;

    const amount = ethers.parseEther("1000"); // 1000 ether

    beforeEach(async function () {
        [deployer, council, keeperNodeAddress, vesterAddress] = await ethers.getSigners();

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
        keepers = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
        await keepers.waitForDeployment();

        const StakedCSX = await ethers.getContractFactory("StakedCSX");
        stakedCSX = await StakedCSX.deploy(csx.target, weth.target, usdc.target, usdt.target, keepers.target);
        await stakedCSX.waitForDeployment();

        const EscrowedCSX = await ethers.getContractFactory("EscrowedCSX");
        escrowedCSX = await EscrowedCSX.deploy(csx.target);
        await escrowedCSX.waitForDeployment();

        const VestedCSX = await ethers.getContractFactory("VestedCSX");
        vestedCSX = await VestedCSX.deploy(
            escrowedCSX.target,
            stakedCSX.target,
            weth.target,
            usdc.target,
            csx.target,
            usdt.target,
            keepers.target
        );
        await vestedCSX.waitForDeployment();

        await escrowedCSX.init(vestedCSX.target);

        await csx.connect(deployer).transfer(await vesterAddress.getAddress(), amount);
        await csx.connect(vesterAddress).approve(escrowedCSX.target, amount);
        await escrowedCSX.connect(vesterAddress).mintEscrow(amount);
        await escrowedCSX.connect(vesterAddress).approve(vestedCSX.target, amount);
        await vestedCSX.connect(vesterAddress).vest(amount);

        const vestedStakingAddress = await vestedCSX.getVestedStakingContractAddress(await vesterAddress.getAddress());
        const VestedStaking = await ethers.getContractFactory("VestedStaking");
        vestedStaking = VestedStaking.attach(vestedStakingAddress);
    });

    it(
        'should not revert reward claiming when the vester has a X USDT balance and the contract has a > X USDT balance', 
        async () => {
            const vesterUsdtBalance = ethers.parseUnits('2', 6); // Vester has a total of 2 USDT
            await usdt.connect(deployer).transfer(vesterAddress, vesterUsdtBalance);

            const depositAmount = ethers.parseUnits('1000', 6);
            await usdt.connect(deployer).approve(stakedCSX.getAddress(), depositAmount);
        
            await stakedCSX.connect(deployer).depositDividend(await usdt.getAddress(), depositAmount);
            await stakedCSX.connect(council).distribute(false, false, true);

            // Transfer 0.000001 USDT more than the vester balance in order to attempt claimRewards revert
            await usdt.connect(deployer).transfer(vestedStaking.getAddress(), vesterUsdtBalance + BigInt(1));

            // await expect(vestedStaking.connect(vesterAddress).claimRewards(false, true, false, false))
            // .to.be.revertedWithPanic('0x11'); // Arithmetic under/overflow panic code

            // Fixed, Should not revert:
            await vestedStaking.connect(vesterAddress).claimRewards(false, true, false, false);        
    });

    it("should deposit CSX tokens into the staking contract", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const vesting = await vestedStaking.vesting();
        expect(vesting.amount.toString()).to.equal(amount.toString());
        expect(vesting.startTime.toString()).to.equal(blockBefore?.timestamp.toString());
    });

    it("should claim rewards from the staking contract", async function () {
        const depositAmount = ethers.parseUnits("1000", 6);

        await usdt.connect(deployer).approve(stakedCSX.getAddress(), depositAmount);
        
        await stakedCSX.connect(deployer).depositDividend(await usdt.getAddress(), depositAmount);
        await stakedCSX.connect(council).distribute(true, true, true);
        
        const claimableAndTime = await vestedStaking.getClaimableAmountAndVestTimeStart();
        const claimableAmount = claimableAndTime[1];
        expect(claimableAmount.toString()).to.equal(depositAmount.toString());

        await vestedStaking.connect(vesterAddress).claimRewards(true, true, true, true);
        const usdtBalance = await usdt.balanceOf(await vesterAddress.getAddress());
        expect(usdtBalance.toString()).to.equal(depositAmount.toString());
    });

    it("should not allow withdrawal before vesting period ends", async function () {
        await vestedCSX.connect(vesterAddress).approve(vestedStaking.target, amount);        
        await expect(vestedStaking.connect(vesterAddress).withdraw(amount)).to.be.revertedWithCustomError(vestedStaking, "TokensAreStillLocked");
    });

    it("should allow withdrawal after vesting period ends", async function () {
        const extendTime = 24 * 30 * 24 * 60 * 60; // 24 months
        await network.provider.send("evm_increaseTime", [extendTime]);
        await network.provider.send("evm_mine");

        await vestedCSX.connect(vesterAddress).approve(vestedStaking.target, amount);
        await vestedStaking.connect(vesterAddress).withdraw(amount);

        const vCSXBalance = await vestedCSX.balanceOf(await vesterAddress.getAddress());
        expect(vCSXBalance.toString()).to.equal("0");

        const csxBalance = await csx.balanceOf(await vesterAddress.getAddress());
        expect(csxBalance.toString()).to.equal(amount.toString());
    });
});
