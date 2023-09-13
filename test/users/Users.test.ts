import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Users", function () {
    let users: any;
    let council: Signer;
    let keeperAddress: Signer;

    beforeEach(async function () {
        [council, keeperAddress] = await ethers.getSigners();

        const Keepers = await ethers.getContractFactory("Keepers");
        const keepers = await Keepers.deploy(await council.getAddress(), await keeperAddress.getAddress());
        await keepers.waitForDeployment();

        const Users = await ethers.getContractFactory("Users");
        users = await Users.deploy(keepers.target);
        await users.waitForDeployment();
    });

    describe("Managing Users", function () {
        it("should allow warning a user", async function () {
            const user = (await ethers.getSigners())[2];
            await users.connect(keeperAddress).warnUser(await user.getAddress());
            const userData = await users.getUserData(await user.getAddress());
            expect(Number(userData.warnings)).to.equal(1);
        });

        it("should allow banning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeperAddress).banUser(await user.getAddress());
            const isBanned = await users.isBanned(await user.getAddress());
            expect(isBanned).to.be.true;
        });

        it("should allow unbanning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeperAddress).banUser(await user.getAddress());
            const isBanned1st = await users.isBanned(await user.getAddress());
            expect(isBanned1st).to.be.true;
            await users.connect(keeperAddress).unbanUser(await user.getAddress());
            const isBanned2nd = await users.isBanned(await user.getAddress());
            expect(isBanned2nd).to.be.false;
        });
    });

    describe("User Reputation", function () {
        it("should not be allowed to make rep without trade", async function () {
            const tradeAddress = `0x${"0".repeat(40)}`;
            const user = (await ethers.getSigners())[4];
            await expect(users.connect(user).repAfterTrade(tradeAddress, true)).to.be.revertedWithCustomError(users, "ZeroTradeAddress");
        });
    });
});
