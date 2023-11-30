import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { listingParamsStorage } from "../../scripts/deploy/utils/list-demo";
import { TradeFactoryBaseStorage } from "../../typechain-types";
import { TradeUrlStruct } from "../../typechain-types/contracts/TradeFactory/storage/TradeFactoryBaseStorage";

describe("TradeFactoryBaseStorage", async function () {
  let deployer: Signer, council: Signer, factory: Signer, keeperNodeAddress: Signer, user: Signer;
  let keepers: any, users: any, instance: TradeFactoryBaseStorage, newKeepers:any, newUsers:any;

  beforeEach(async function () {
    [deployer, council, factory, keeperNodeAddress, user, newKeepers, newUsers] = await ethers.getSigners();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();

    const Users = await ethers.getContractFactory("Users");
    users = await Users.deploy(keepers.target);
    await users.waitForDeployment();

    const TradeFactoryBaseStorage = await ethers.getContractFactory("TradeFactoryBaseStorage");
    instance = await TradeFactoryBaseStorage.deploy(keepers.target, users.target);
    await instance.waitForDeployment();
  });

  describe("Initialization", async function () {
    it("should properly initialize the contract", async function () {
      await instance.connect(council).init(await factory.getAddress());
      const keepersContract = await instance.keepersContract();
      const usersContract = await instance.usersContract();

      expect(keepersContract).to.equal(keepers.target);
      expect(usersContract).to.equal(users.target);
      expect(await instance.totalContracts()).to.equal(0);
      expect(await instance.hasInit()).to.be.true;
    });

    it("should not allow re-initialization", async function () {
      await instance.connect(council).init(await factory.getAddress());
      await expect(instance.connect(council).init(await factory.getAddress())).to.be.revertedWithCustomError(
        instance, "AlreadyInitialized"
      );
    });

    it("should not allow non-council to initialize", async function () {
      await expect(instance.connect(user).init(await factory.getAddress())).to.be.revertedWithCustomError(
        instance, "NotCouncil"
      );
    });

    it("should not allow initialization with zero address", async function () {
      await expect(instance.connect(council).init(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        instance, "ZeroAddress"
      );
    });
  });

  describe("Contract Management", async function () {
    it("should allow council to change contracts", async function () {
      await instance.connect(council).init(await factory.getAddress());
      await instance.connect(council).changeContracts(await newKeepers.getAddress(), await newUsers.getAddress());
      expect(await instance.keepersContract()).to.equal(await newKeepers.getAddress());
      expect(await instance.usersContract()).to.equal(await newUsers.getAddress());
    });
    it("should not allow non-council to change contracts", async function () {
      await instance.connect(council).init(await factory.getAddress());
      await expect(instance.connect(user).changeContracts(await factory.getAddress(), keepers.target)).to.be.revertedWithCustomError(
        instance, "NotCouncil"
      );
    });
  });

  describe("Trade Factory Operations", async function () {
    it("should initialize the factory", async function () {
      await instance.connect(council).init(await factory.getAddress());
      expect(await instance.factoryAddress()).to.equal(await factory.getAddress());
      expect(await instance.keepersContract()).to.equal(keepers.target);
      expect(await instance.hasInit()).to.be.true;
      expect(await instance.totalContracts()).to.equal(0);
    });
    it("should not allow non-factory to create a new trade contract", async function () {
      await instance.connect(council).init(await factory.getAddress());
      await expect(instance.connect(user).newTradeContract(
        listingParamsStorage._itemMarketName,
        listingParamsStorage._tradeUrl as TradeUrlStruct,
        listingParamsStorage._assetId,
        listingParamsStorage._inspectLink,
        listingParamsStorage._itemImageUrl,
        listingParamsStorage._weiPrice,
        listingParamsStorage._skinInfo
      )).to.be.revertedWithCustomError(
        instance, "NotFactory"
      );
    });
  });
});
