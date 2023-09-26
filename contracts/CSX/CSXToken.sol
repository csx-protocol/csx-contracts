// SPDX-License-Identifier: MIT
// CSX Token Contract v1
pragma solidity ^0.8.21;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract CSXToken is ERC20Burnable {
    // ONE HUNDERED MILLION CSX TOKENS WITH 18 DECIMALS
    uint256 public constant maxSupply = 100000000 * 10 ** 18;

    constructor() ERC20("CSX Token", "CSX") {
        _mint(msg.sender, maxSupply);
    }
}
