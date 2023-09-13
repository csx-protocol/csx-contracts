import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("VestedCSX", async function() {
  let vestedCSX: any;
  let escrowedCSX: any;
  let csx: any;
  let stakedCSX: any;
  let usdc: any;
  let usdt: any;
  let weth: any;

  let user1: Signer;
  let user2: Signer;
  let deployer: Signer;

  beforeEach(async function() {
    [deployer, user1, user2] = await ethers.getSigners();
   
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
   
    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    stakedCSX = await StakedCSX.deploy(csx.target, weth.target, usdc.target, usdt.target);
    await stakedCSX.waitForDeployment();
    
    const VestedCSXContract = await ethers.getContractFactory("VestedCSX");
    vestedCSX = await VestedCSXContract.deploy(
      escrowedCSX.target,
      stakedCSX.target,
      weth.target,
      usdc.target,
      csx.target,
      usdt.target
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

    await vestedCSX.connect(user1).vest(amount);

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
});
