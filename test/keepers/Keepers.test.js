const { expectRevert } = require("@openzeppelin/test-helpers");
const Keepers = artifacts.require("Keepers");

contract("Keepers", function(accounts) {
  let keepersInstance;

  const [
    council, 
    keeperNodeAddress, 
    keeper1, 
    keeper2, 
    newCouncil, 
    newKeeperNode
  ] = accounts;

  beforeEach(async function() {
    keepersInstance = await Keepers.new(council, keeperNodeAddress);
  });

  it("should initialize with correct council and keeperNodeAddress", async function() {
    assert.equal(await keepersInstance.council(), council, "Council is incorrect");
    assert.equal(await keepersInstance.isKeeperNode(keeperNodeAddress), true, "keeperNodeAddress is incorrect");
  });

  it("should add and remove keeper", async function() {
    await keepersInstance.addKeeper(keeper1, { from: council });
    assert.equal(await keepersInstance.indexOf(keeper1), 1, "Keeper was not added");

    await keepersInstance.removeKeeper(keeper1, { from: council });
    assert.equal(await keepersInstance.indexOf(keeper1), 0, "Keeper was not removed");
  });

  it("should not add existing keeper", async function() {
    await keepersInstance.addKeeper(keeper1, { from: council });
    await expectRevert(
      keepersInstance.addKeeper(keeper1, { from: council }),
      "Keeper already exists"
    );
  });

  it("should not remove non-existing keeper", async function() {
    await expectRevert(
      keepersInstance.removeKeeper(keeper2, { from: council }),
      "Not a Keeper"
    );
  });

  it("should change council", async function() {
    await keepersInstance.changeCouncil(newCouncil, { from: council });
    assert.equal(await keepersInstance.council(), newCouncil, "Council was not changed");
  });

  it("should change keeper node address", async function() {
    await keepersInstance.changeKeeperNode(newKeeperNode, { from: council });
    assert.equal(await keepersInstance.isKeeperNode(newKeeperNode), true, "Keeper node address was not changed");
  });

  it("should not allow non-council to perform restricted actions", async function() {
    await expectRevert(
      keepersInstance.addKeeper(keeper1, { from: keeper1 }),
      "sender must be council"
    );
    await expectRevert(
      keepersInstance.changeKeeperNode(newKeeperNode, { from: keeper1 }),
      "sender must be council"
    );
  });
});
