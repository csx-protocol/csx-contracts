import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { Users } from "../../typechain-types";

describe("Users", function () {
    let users: Users;
    let council: Signer;
    let keeper: Signer;
    let factory: Signer;
    let user1: Signer;
    let tradeAddress: Signer;

    beforeEach(async function () {
        [council, keeper, factory, user1, tradeAddress] = await ethers.getSigners();

        const Keepers = await ethers.getContractFactory("Keepers");
        const keepers = await Keepers.deploy(await council.getAddress(), await keeper.getAddress());
        await keepers.waitForDeployment();

        const Users = await ethers.getContractFactory("Users");
        users = await Users.deploy(keepers.target);
        await users.waitForDeployment();

        await users.setFactoryAddress(factory);
    });

    describe("Managing Users", function () {
        it("should allow warning a user", async function () {
            const user = (await ethers.getSigners())[2];
            await users.connect(keeper).warnUser(await user.getAddress());
            const userData = await users.getUserData(await user.getAddress());
            expect(Number(userData.warnings)).to.equal(1);
        });

        it("should allow banning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeper).banUser(await user.getAddress());
            const isBanned = await users.isBanned(await user.getAddress());
            expect(isBanned).to.be.true;
        });

        it("should allow unbanning a user", async function () {
            const user = (await ethers.getSigners())[3];
            await users.connect(keeper).banUser(await user.getAddress());
            const isBanned1st = await users.isBanned(await user.getAddress());
            expect(isBanned1st).to.be.true;
            await users.connect(keeper).unbanUser(await user.getAddress());
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

    describe("Asset ID Operations", async function () {
        const assetId = "uniqueAssetId";
        const assetId2 = "GG1";

        await users.connect(factory).setAssetIdUsed(assetId, await user1.getAddress(), await tradeAddress.getAddress());

        it("should check that an asset is not already listed", async function () {
            const hasListed = await users.hasAlreadyListedItem(assetId2, await user1.getAddress());
            expect(hasListed).to.be.false;
        });

        it("should check that an asset is already listed", async function () {
            const hasListed = await users.hasAlreadyListedItem(assetId, await user1.getAddress());
            expect(hasListed).to.be.true;
        });

        it("Should not be able to setAssetIdUsed if not factory", async function () {
            await expect(users.connect(user1).setAssetIdUsed(assetId, await user1.getAddress(), await tradeAddress.getAddress())).to.be.revertedWithCustomError(users, "NotFactory");
        });
    });
});
