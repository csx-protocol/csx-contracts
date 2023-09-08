import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Keepers", async function () {
  let keepersInstance: any;
  let council: Signer, keeperNodeAddress: Signer, keeper1: Signer, keeper2: Signer, newCouncil: Signer, newKeeperNode: Signer;

  beforeEach(async function () {
    [council, keeperNodeAddress, keeper1, keeper2, newCouncil, newKeeperNode] = await ethers.getSigners();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepersInstance = await Keepers.deploy(await council.getAddress(), await keeperNodeAddress.getAddress());
    await keepersInstance.waitForDeployment();
  });

  it("should initialize with correct council and keeperNodeAddress", async function () {
    expect(await keepersInstance.council()).to.equal(await council.getAddress());
    expect(await keepersInstance.isKeeperNode(await keeperNodeAddress.getAddress())).to.be.true;
  });

  it("should add and remove keeper", async function () {
    await keepersInstance.connect(council).addKeeper(await keeper1.getAddress());
    expect(await keepersInstance.indexOf(await keeper1.getAddress())).to.equal(1);

    await keepersInstance.connect(council).removeKeeper(await keeper1.getAddress());
    expect(await keepersInstance.indexOf(await keeper1.getAddress())).to.equal(0);
  });

  it("should not add existing keeper", async function () {
    await keepersInstance.connect(council).addKeeper(await keeper1.getAddress());
    await expect(keepersInstance.connect(council).addKeeper(await keeper1.getAddress())).to.be.revertedWithCustomError(keepersInstance,"KeeperAlreadyExists");
    
  });

  it("should not remove non-existing keeper", async function () {
    await expect(keepersInstance.connect(council).removeKeeper(await keeper2.getAddress())).to.be.revertedWithCustomError(keepersInstance,"NotAKeeper");
  });

  it("should change council", async function () {
    await keepersInstance.connect(council).changeCouncil(await newCouncil.getAddress());
    expect(await keepersInstance.council()).to.equal(await newCouncil.getAddress());
  });

  it("should change keeper node address", async function () {
    await keepersInstance.connect(council).changeKeeperNode(await newKeeperNode.getAddress());
    expect(await keepersInstance.isKeeperNode(await newKeeperNode.getAddress())).to.be.true;
  });

  it("should not allow non-council to perform restricted actions", async function () {
    await expect(keepersInstance.connect(keeper1).addKeeper(await keeper1.getAddress())).to.be.revertedWithCustomError(keepersInstance, "NotCouncil");
    await expect(keepersInstance.connect(keeper1).changeKeeperNode(await newKeeperNode.getAddress())).to.be.revertedWithCustomError(keepersInstance, "NotCouncil");
  });
});
