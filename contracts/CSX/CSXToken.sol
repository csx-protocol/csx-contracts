// SPDX-License-Identifier: MIT
// CSX Token Contract v1
pragma solidity 0.8.18;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract CSXToken is ERC20Burnable {
    // ONE HUNDERED MILLION CSX TOKENS WITH 18 DECIMALS
    uint256 public constant maxSupply = 100000000 * 10 ** 18;

    /**
     * @notice Constructs the CSX ERC-20 contract.
     * @dev Sets the values for {name} and {symbol}.
     * @dev Mints maxSupply tokens to the deployer.
     * @dev See {ERC20-constructor}.
     * @dev See {ERC20Burnable-constructor}.
     */
    constructor() ERC20("CSX Token", "CSX") {
        _mint(msg.sender, maxSupply);
    }
}
