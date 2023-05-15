import { describeBehaviorOfERC20 } from "@csx/spec";
import { CSXToken, CSXToken__factory } from "@csx/typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

describe.only("CSXToken", function () {
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let holder: SignerWithAddress;
  let spender: SignerWithAddress;
  let instance: CSXToken;

  const DECIMAL = BigNumber.from(10).pow(18);
  let supply = BigNumber.from(100000000).mul(DECIMAL);

  before(async function () {
    [sender, receiver, holder, spender] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const [deployer] = await ethers.getSigners();
    instance = await new CSXToken__factory(deployer).deploy(
      "CSX Token",
      "CSX",
      supply,
    );
  });

  describeBehaviorOfERC20(async () => instance, {
    supply: supply,
  });
});
