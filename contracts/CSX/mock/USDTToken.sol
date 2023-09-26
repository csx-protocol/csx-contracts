// SPDX-License-Identifier: MIT
// MOCK USDT Contract

pragma solidity ^0.8.21;

import {ERC20} from "../Interfaces.sol";

contract USDTToken is ERC20 {
    // ONE HUNDERED MILLION MOCK TOKENS WITH 6 DECIMALS
    uint256 public constant maxSupply = 100000000 * 10 ** 6;

    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, maxSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
