import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("CSXToken", async function () {
  let csxToken: any;
  let deployer: Signer;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    const CSXToken = await ethers.getContractFactory("CSXToken");
    csxToken = await CSXToken.deploy();
    await csxToken.waitForDeployment();
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

  describe("Token Supply", function () {
    it("should have a max supply of 100,000,000 CSX", async function () {
      const maxSupply = await csxToken.maxSupply();
      expect(maxSupply.toString()).to.equal(ethers.parseEther("100000000").toString());
    });

    it("should allocate the max supply to the deployer", async function () {
      const balanceOfDeployer = await csxToken.balanceOf(await deployer.getAddress());
      expect(balanceOfDeployer.toString()).to.equal(ethers.parseEther("100000000").toString());
    });
  });
});
