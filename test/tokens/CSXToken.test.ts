import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("CSXToken", async function () {
  let csxToken: any;
  let keepers: any;
  let deployer: Signer, council: Signer, keeperNode: Signer;

  beforeEach(async function () {
    [deployer, council, keeperNode] = await ethers.getSigners();

    const CSXToken = await ethers.getContractFactory("CSXToken");
    csxToken = await CSXToken.deploy();
    await csxToken.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNode.getAddress());
    await keepers.waitForDeployment();    

    await csxToken.init(await keepers.getAddress());
  });

  describe("Token Attributes", function () {
    it("should have the correct name", async function () {
      const name = await csxToken.name();
      expect(name).to.equal("CSX Token");
    });

    it("should have the correct symbol", async function () {
      const symbol = await csxToken.symbol();
      expect(symbol).to.equal("CSX");
    });
  });

  describe("Token Minting", function () {
    it("should not allow minting by deployer", async function () {
      await expect(csxToken.mint(deployer.getAddress(), 100)).to.be.revertedWithCustomError(csxToken, "Unauthorized");
    });

    it("should allow minting by council", async function () {
      await expect(csxToken.connect(council).mint(deployer.getAddress(), ethers.parseUnits("100", 18))).to.emit(csxToken, "Transfer");
      expect(await csxToken.balanceOf(deployer.getAddress())).to.equal(ethers.parseUnits("100", 18).toString());
    });

    it("should not allow minting by non-council", async function () {
      await expect(csxToken.connect(keeperNode).mint(deployer.getAddress(), ethers.parseUnits("100", 18))).to.be.revertedWithCustomError(csxToken, "Unauthorized");
    });
  });

  describe("Token Supply", function () {
    it("should not allow minting more than 100,000,000 CSX", async function () {
      const maxSupplyPlusOneCSX = ethers.parseEther("100000001").toString();
      await expect(csxToken.connect(council).mint(deployer.getAddress(), maxSupplyPlusOneCSX)).to.be.revertedWithCustomError(csxToken, "MaxSupplyExceeded");
    });
    it("should allow minting up to 100,000,000 CSX", async function () {
      const maxSupply = ethers.parseEther("100000000").toString();
      await expect(csxToken.connect(council).mint(deployer.getAddress(), maxSupply)).to.emit(csxToken, "Transfer");
    });
  });

  describe("Token Burning", function () {
    it("should allow burning", async function () {
      await expect(csxToken.connect(council).mint(deployer.getAddress(), ethers.parseUnits("100", 18))).to.emit(csxToken, "Transfer");
      await expect(csxToken.connect(deployer).burn(ethers.parseUnits("100", 18))).to.emit(csxToken, "Transfer");
      expect(await csxToken.balanceOf(deployer.getAddress())).to.equal(ethers.parseUnits("0", 18).toString());
    });
    it("should not allow minting to max supply then burn and mint again", async function () {
      await expect(csxToken.connect(council).mint(deployer.getAddress(), ethers.parseUnits("100000000", 18))).to.emit(csxToken, "Transfer");
      await expect(csxToken.connect(deployer).burn(ethers.parseUnits("100", 18))).to.emit(csxToken, "Transfer");
      await expect(csxToken.connect(council).mint(deployer.getAddress(), ethers.parseUnits("100", 18))).to.be.revertedWithCustomError(csxToken, "MaxSupplyExceeded");
    });
  });
});
