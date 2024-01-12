import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { VestedCSX, VestedStaking } from "../../typechain-types";
import { InitParamsStruct } from "../../typechain-types/contracts/CSX/StakedCSX";

describe("VestedCSX", async function() {
  let vestedCSX: VestedCSX;
  let vestedStaking: VestedStaking
  let escrowedCSX: any;
  let csx: any;
  let keepers: any;
  let stakedCSX: any;
  let usdc: any;
  let usdt: any;
  let weth: any;

  let user1: Signer;
  let user2: Signer;
  let deployer: Signer;
  let council: Signer;
  let keeperNodeAddress: Signer;

  beforeEach(async function() {
    [deployer, council, keeperNodeAddress, user1, user2] = await ethers.getSigners();

   
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
  
    const EscrowedCSX = await ethers.getContractFactory("EscrowedCSX");
    escrowedCSX = await EscrowedCSX.deploy(csx.target);
    await escrowedCSX.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();
   
    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    const stakedInitParams = {
      KEEPERS_INTERFACE: keepers.target,
      TOKEN_CSX: csx.target,
      TOKEN_WETH: weth.target,
      TOKEN_USDC: usdc.target,
      TOKEN_USDT: usdt.target,
    } as InitParamsStruct;
    stakedCSX = await StakedCSX.deploy(stakedInitParams);
    await stakedCSX.waitForDeployment();
    
    const VestedCSXContract = await ethers.getContractFactory("VestedCSX");
    vestedCSX = await VestedCSXContract.deploy(
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
  });

  it("should vest amount and create VestedStaking contract", async function() {
    const amount = ethers.parseEther("1000");
    const userAddress = await user1.getAddress();
    
    await csx.transfer(userAddress, amount);
    await csx.connect(user1).approve(escrowedCSX.target, amount);
    await escrowedCSX.connect(user1).mintEscrow(amount);
    await escrowedCSX.connect(user1).approve(vestedCSX.target, amount);

    const eCSXBalanceBefore = await escrowedCSX.balanceOf(userAddress);
    expect(eCSXBalanceBefore.toString()).to.equal(amount.toString());

    const vCSXBalanceBefore = await vestedCSX.balanceOf(userAddress);
    expect(vCSXBalanceBefore.toString()).to.equal("0");

    await vestedCSX.connect(user1).vest(amount);

    const eCSXBalanceAfter = await escrowedCSX.balanceOf(userAddress);
    expect(eCSXBalanceAfter.toString()).to.equal("0");

    const vCSXBalance = await vestedCSX.balanceOf(userAddress);
    expect(vCSXBalance.toString()).to.equal(amount.toString());

    const vestedStakingAddress = await vestedCSX.getVestedStakingContractAddress(userAddress);
    // create a zero address
    const zeroAddress = `0x${"0".repeat(40)}`;
    expect(vestedStakingAddress).to.not.equal(zeroAddress);

    const vestedStakingBalance = await stakedCSX.balanceOf(vestedStakingAddress);
    expect(vestedStakingBalance.toString()).to.equal(amount.toString());

    const stakedCSXBalance = await csx.balanceOf(stakedCSX.target);
    expect(stakedCSXBalance.toString()).to.equal(amount.toString());
  });

  it("should not allow vesting of zero amount", async function() {
    const amount = 0;
    const userAddress = await user1.getAddress();

    await csx.transfer(userAddress, amount);
    await csx.connect(user1).approve(escrowedCSX.target, amount);

    await expect(
      escrowedCSX.connect(user1).mintEscrow(amount)
    ).to.be.revertedWithCustomError(escrowedCSX, "AmountMustBeGreaterThanZero");

    await escrowedCSX.connect(user1).approve(vestedCSX.target, amount);
    
    await expect(
      vestedCSX.connect(user1).vest(amount)
    ).to.be.revertedWithCustomError(vestedCSX, "AmountMustBeGreaterThanZero");
  });

  it("should revert transfer of vested tokens", async function() {
    const amount = ethers.parseEther("1000");
    const userAddress = await user1.getAddress();
    const receiverAddress = await user2.getAddress();

    await csx.transfer(userAddress, amount);
    await csx.connect(user1).approve(escrowedCSX.target, amount);
    await escrowedCSX.connect(user1).mintEscrow(amount);
    await escrowedCSX.connect(user1).approve(vestedCSX.target, amount);
    await vestedCSX.connect(user1).vest(amount);

    await expect(
      vestedCSX.connect(user1).transfer(receiverAddress, amount)
    ).to.be.revertedWithCustomError(vestedCSX, "TokenTransfersDisabled");
  });

  it("should allow council to cliff the vesting", async function() {
    // Used against malicious vesters.
    const fullAmount = ethers.parseEther("1000");
    const halfAmount = ethers.parseEther("500");
    const halfOfHalfAmount = ethers.parseEther("250");
    const userAddress = await user1.getAddress();
    const receiverAddress = await user2.getAddress();

    await csx.transfer(userAddress, fullAmount);
    await csx.connect(user1).approve(escrowedCSX.target, fullAmount);
    await escrowedCSX.connect(user1).mintEscrow(fullAmount);
    await escrowedCSX.connect(user1).approve(vestedCSX.target, fullAmount);
    await vestedCSX.connect(user1).vest(fullAmount);

    const vestedStakingAddress = await vestedCSX.getVestedStakingContractAddress(userAddress);
    const VestedStaking = await ethers.getContractFactory("VestedStaking");
    vestedStaking = VestedStaking.attach(vestedStakingAddress) as VestedStaking;

    await keepers.connect(council).changeVesterUnderCouncilControl(userAddress, true);
    await expect(vestedStaking.connect(council).cliff(fullAmount)).to.be.revertedWithCustomError(vestedStaking, "TokensAreStillLocked");

    // increase 2 days for cliff grace period from council tagging
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine");

    await expect(vestedStaking.connect(user1).cliff(fullAmount)).to.be.revertedWithCustomError(vestedStaking, "InvalidSender");

    const beforeCliffedAmount = await vestedStaking.cliffedAmount();
    expect(beforeCliffedAmount.toString()).to.equal("0");   
    await vestedStaking.connect(council).cliff(halfAmount);

    const cliffedAmount = await vestedStaking.cliffedAmount();

    expect(cliffedAmount.toString()).to.equal(halfAmount.toString());

    // user test to withdraw after vesting period and cliffed
    await ethers.provider.send("evm_increaseTime", [86400 * 30 * 24]);
    await ethers.provider.send("evm_mine");

    await vestedCSX.connect(user1).approve(vestedStaking.target, fullAmount);
    
    const vCSXBalance = await vestedCSX.balanceOf(await user1.getAddress());
    expect(vCSXBalance.toString()).to.equal(fullAmount);   
    
    await expect(
      vestedStaking.connect(user1).withdraw(fullAmount)
    ).to.be.revertedWithCustomError(vestedStaking, "NotEnoughTokens");

    await vestedStaking.connect(user1).withdraw(halfOfHalfAmount);

    await expect(
      vestedStaking.connect(council).cliff(halfAmount)
    ).to.be.revertedWithCustomError(vestedStaking, "NotEnoughTokens");
    
    await vestedStaking.connect(council).cliff(halfOfHalfAmount);

    await expect(
      vestedStaking.connect(user1).withdraw(halfOfHalfAmount)
    ).to.be.revertedWithCustomError(vestedStaking, "NotEnoughTokens");

    const vCSXBalanceAfterWithdraw = await vestedCSX.balanceOf(await user1.getAddress());
    expect(vCSXBalanceAfterWithdraw.toString()).to.equal(fullAmount-halfOfHalfAmount);

    // transfer vested tokens to another user regardless should not be allowed
    await expect(
      vestedCSX.connect(user1).transfer(receiverAddress, halfOfHalfAmount)
    ).to.be.revertedWithCustomError(vestedCSX, "TokenTransfersDisabled");
  });
});
