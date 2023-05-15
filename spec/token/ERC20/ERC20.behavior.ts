import { IERC20Base } from "@csx/typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { describeFilter } from "@solidstate/library";
import { expect } from "chai";
import { BigNumber, ContractTransaction } from "ethers";
import { ethers } from "hardhat";

export interface ERC20BehaviorArgs {
  supply: BigNumber;
  mint: (address: string, amount: BigNumber) => Promise<ContractTransaction>;
  burn: (address: string, amount: BigNumber) => Promise<ContractTransaction>;
}
