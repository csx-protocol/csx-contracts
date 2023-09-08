import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("NetValueCalculator", function () {
  let netValueCalculator: any;

  async function deployNetValueCalculatorFixture() {
    const [deployer] = await ethers.getSigners();
    const NetValueCalculator = await ethers.getContractFactory(
      "NetValueCalculator",
      deployer
    );
    netValueCalculator = await NetValueCalculator.deploy();
    return { netValueCalculator };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployNetValueCalculatorFixture);
    netValueCalculator = fixture.netValueCalculator;
  });

  describe("calculateNetValue()", function () {
    it("should correctly calculate net values when the buyer is affiliated", async function () {
      const fullItemPrice = 1000;
      const isBuyerAffiliated = true;
      const baseFeePercent = 2;
      const discountRatio = 10;

      const result = await netValueCalculator.calculateNetValue(
        fullItemPrice,
        isBuyerAffiliated,
        baseFeePercent,
        discountRatio
      );

      const buyerNetPrice = Number(result[0]);
      const sellerNetProceeds = Number(result[1]);
      const affiliatorNetReward = Number(result[2]);
      const tokenHoldersNetReward = Number(result[3]);

      expect(buyerNetPrice).to.equal(998);
      expect(sellerNetProceeds).to.equal(980);
      expect(affiliatorNetReward).to.equal(8);
      expect(tokenHoldersNetReward).to.equal(10);
    });

    it("should correctly calculate net values when the buyer is not affiliated", async function () {
      const fullItemPrice = 1000;
      const isBuyerAffiliated = false;
      const baseFeePercent = 2;
      const discountRatio = 10;

      const result = await netValueCalculator.calculateNetValue(
        fullItemPrice,
        isBuyerAffiliated,
        baseFeePercent,
        discountRatio
      );

      const buyerNetPrice = Number(result[0]);
      const sellerNetProceeds = Number(result[1]);
      const affiliatorNetReward = Number(result[2]);
      const tokenHoldersNetReward = Number(result[3]);

      expect(buyerNetPrice).to.equal(1000);
      expect(sellerNetProceeds).to.equal(980);
      expect(affiliatorNetReward).to.equal(0);
      expect(tokenHoldersNetReward).to.equal(20);
    });
  });
});
