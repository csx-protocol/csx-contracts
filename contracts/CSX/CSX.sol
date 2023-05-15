// SPDX-License-Identifier: MIT
// CSX Token Contract v1
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract CSXToken is ERC20Burnable {
    // ONE HUNDERED MILLION CSX TOKENS WITH 18 DECIMALS
    // uint256 public constant maxSupply = 100000000;

    // constructor() ERC20("CSX Token", "CSX") {
    //     _mint(msg.sender, maxSupply);
    // }

    constructor(string memory _name, string memory _symbol, uint256 initialSupply) ERC20(_name, _symbol) {
        _mint(msg.sender, initialSupply);
    }
}