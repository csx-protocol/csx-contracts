import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("TradeFactoryBaseStorage", async function () {
  let deployer: Signer, council: Signer, factory: Signer, keeperNodeAddress: Signer, user: Signer;
  let keepers: any, users: any, instance: any;

  beforeEach(async function () {
    [deployer, council, factory, keeperNodeAddress, user] = await ethers.getSigners();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
    await keepers.waitForDeployment();

    const Users = await ethers.getContractFactory("Users");
    users = await Users.deploy(keepers.target);
    await users.waitForDeployment();

    const TradeFactoryBaseStorage = await ethers.getContractFactory("TradeFactoryBaseStorage");
    instance = await TradeFactoryBaseStorage.deploy(keepers.target, users.target);
    await instance.waitForDeployment();

    await instance.connect(council).init(await factory.getAddress());
  });

  describe("Initialization", async function () {
    it("should properly initialize the contract", async function () {
      const keepersContract = await instance.keepersContract();
      const usersContract = await instance.usersContract();

      expect(keepersContract).to.equal(keepers.target);
      expect(usersContract).to.equal(users.target);
      expect(await instance.totalContracts()).to.equal(0);
      expect(await instance.hasInit()).to.be.true;
    });
  });

  describe("Trade Factory Operations", async function () {
    it("should initialize the factory", async function () {
      expect(await instance.factoryAddress()).to.equal(await factory.getAddress());
      expect(await instance.hasInit()).to.be.true;
    });
  });
});
