const Keepers = artifacts.require("Keepers");
const Users = artifacts.require("Users");
const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");

contract("TradeFactoryBaseStorage", (accounts) => {
  const [deployer, council, factory, keeperNodeAddress, user] = accounts;
    let keepers, users, instance;

  before(async () => {
    // Here you should initialize the Keepers and Users contracts as well
    keepers = await Keepers.new(council, keeperNodeAddress, { from: deployer });
    users = await Users.new(keepers.address, { from: deployer });

    instance = await TradeFactoryBaseStorage.new(keepers.address, users.address, { from: council });
    await instance.init(factory, { from: council });
  });

  describe("Initialization", () => {
    it("should properly initialize the contract", async () => {
      const keepers = await instance.keepersContract();
      const users = await instance.usersContract();

      assert.equal(keepers, keepers);
      assert.equal(users, users);
      assert.equal(await instance.totalContracts(), 0);
      assert.equal(await instance.hasInit({ from: council }), true);
    });
  });

  describe("Trade Factory Operations", () => {
    it("should initialize the factory", async () => {
      assert.equal(await instance.factoryAddress(), factory);
      assert.equal(await instance.hasInit(), true);
    });
  });
});
