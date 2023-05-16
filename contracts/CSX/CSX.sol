// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { IErrors } from "../interfaces/IErrors.sol";
contract CSXToken is ERC20Burnable {
    constructor(
        string memory _name,
        string memory _symbol, 
        uint256 initialSupply
    ) ERC20(_name, _symbol) {
        if (initialSupply == 0) revert IErrors.ZeroAmount();
        _mint(msg.sender, initialSupply);
    }
}