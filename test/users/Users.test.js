const Users = artifacts.require("Users");
const Keepers = artifacts.require("Keepers");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("Users", (accounts) => {
  let users;
  const council = accounts[0];
  const keeperAddress = accounts[1];

  beforeEach(async () => {
    const keepers = await Keepers.new(council, keeperAddress);
    users = await Users.new(keepers.address);
  });

  describe("Managing Users", () => {
    it("should allow warning a user", async () => {
        const user = accounts[2];
        await users.warnUser(user, { from: keeperAddress });
        const userData = await users.getUserData(user);        
        assert.equal(parseInt(userData.warnings), 1, "Incorrect number of warnings");
    });

    it("should allow banning a user", async () => {
      const user = accounts[3];
      await users.banUser(user, { from: keeperAddress });
      const isBanned = await users.isBanned(user);
      expect(isBanned).to.be.true;
    });

    it("should allow unbanning a user", async () => {
        const user = accounts[3];
        await users.banUser(user, { from: keeperAddress });
        const isBanned1st = await users.isBanned(user);
        expect(isBanned1st).to.be.true;
        await users.unbanUser(user, { from: keeperAddress });
        const isBanned2nd = await users.isBanned(user);
        expect(isBanned2nd).to.be.false;
      });
  });

  describe("User Reputation", () => {
    it("should not be allowed to make rep without trade", async () => {
      const tradeAddress = `0x${"0".repeat(40)}`;
      const user = accounts[4];

      await expectRevert(
        users.repAfterTrade(tradeAddress, true, { from: user }),
        "0 tradeAddrs"
      );
    });
  });
});
