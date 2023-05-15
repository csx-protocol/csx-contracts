import { IERC20 } from "@csx/typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { describeFilter } from "@solidstate/library";
import { expect } from "chai";
import { BigNumber, ContractTransaction } from "ethers";
import { ethers } from "hardhat";

const { BN } = require("@openzeppelin/test-helpers");

export interface ERC20BehaviorArgs {
  supply: BigNumber;
  sender: () => Promise<SignerWithAddress>;
  receiver: () => Promise<SignerWithAddress>;
  holder: () => Promise<SignerWithAddress>;
  spender: () => Promise<SignerWithAddress>;
  burn: (address: string, amount: BigNumber) => Promise<ContractTransaction>;
  burnFrom: (
    address: string,
    amount: BigNumber,
  ) => Promise<ContractTransaction>;
}

export function describeBehaviorOfERC20(
  deploy: () => Promise<IERC20>,
  { supply, sender, receiver, holder, spender, burn }: ERC20BehaviorArgs,
  skips?: string[],
) {
  const describe = describeFilter(skips);

  describe("::ERC20", function () {
    // note: holder gets supply (1e18) amount of tokens so use spender/receiver for easier testing
    let holder: SignerWithAddress;
    let spender: SignerWithAddress;
    let receiver: SignerWithAddress;
    let sender: SignerWithAddress;
    let instance: IERC20;

    before(async function () {
      [holder, spender, receiver, sender] = await ethers.getSigners();
    });

    beforeEach(async function () {
      instance = await deploy();
    });

    describe("#totalSupply()", function () {
      it("returns the total supply of tokens", async function () {
        expect(await instance.callStatic["totalSupply()"]()).to.equal(supply);
      });
    });
  });
}
