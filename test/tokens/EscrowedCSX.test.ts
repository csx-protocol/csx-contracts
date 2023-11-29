import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { Keepers } from "../../typechain-types";

describe("EscrowedCSX", async function () {
  let deployer: Signer,
      user1: Signer;
  let csxToken: any,
      escrowedCSX: any,
      vestedCSX: any,
      keepers: Keepers;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();
  
    const CSXToken = await ethers.getContractFactory("CSXToken");
    csxToken = await CSXToken.deploy();
    await csxToken.waitForDeployment();

    const EscrowedCSX = await ethers.getContractFactory("EscrowedCSX");
    escrowedCSX = await EscrowedCSX.deploy(csxToken.target);
    await escrowedCSX.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await deployer.getAddress(), await deployer.getAddress());
    await keepers.waitForDeployment();
  });

  describe("Initialization", function () {
    it("should not allow non-deployers to initialize", async function () {
      const VestedCSX = await ethers.getContractFactory("VestedCSX");
      vestedCSX = await VestedCSX.deploy(
        escrowedCSX.target,
        await user1.getAddress(),
        await user1.getAddress(),
        await user1.getAddress(),
        csxToken.target,
        await user1.getAddress(),
        keepers.target
      );
      await vestedCSX.waitForDeployment();

      await expect(escrowedCSX.connect(user1).init(vestedCSX.target))
        .to.be.revertedWithCustomError(escrowedCSX, "OnlyDeployerCanInitialize");
    });

    it("should allow the deployer to initialize with the VestedCSX token", async function () {
      const VestedCSX = await ethers.getContractFactory("VestedCSX");
      vestedCSX = await VestedCSX.deploy(
        escrowedCSX.target,
        await user1.getAddress(),
        await user1.getAddress(),
        await user1.getAddress(),
        csxToken.target,
        await user1.getAddress(),
        keepers.target
      );
      await vestedCSX.waitForDeployment();

      await escrowedCSX.init(vestedCSX.target);

      const vestedCSXAddress = await escrowedCSX.vestedCSX();
      expect(vestedCSXAddress).to.equal(vestedCSX.target);
    });
  });

  describe("Minting escrowed tokens", function () {
    beforeEach(async function () {
      const VestedCSX = await ethers.getContractFactory("VestedCSX");
      vestedCSX = await VestedCSX.deploy(
        escrowedCSX.target,
        await user1.getAddress(),
        await user1.getAddress(),
        await user1.getAddress(),
        csxToken.target,
        await user1.getAddress(),
        keepers.target
      );
      await vestedCSX.waitForDeployment();

      await escrowedCSX.init(vestedCSX.target);
    });

    it("should allow users to mint escrowed tokens", async function () {
      const mintAmount = ethers.parseEther("100");

      await csxToken.transfer(await user1.getAddress(), mintAmount);
      await csxToken.connect(user1).approve(escrowedCSX.target, mintAmount);
      await escrowedCSX.connect(user1).mintEscrow(mintAmount);

      const balance = await escrowedCSX.balanceOf(await user1.getAddress());
      expect(balance).to.equal(mintAmount);

      const csxBalance = await csxToken.balanceOf(await user1.getAddress());
      expect(csxBalance).to.equal(0);
      
      const csxBalanceVestedCSX = await csxToken.balanceOf(vestedCSX.target);
      expect(csxBalanceVestedCSX).to.equal(mintAmount);
    });
  });
});
