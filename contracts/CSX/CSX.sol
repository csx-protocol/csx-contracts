//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract CSXToken is ERC20Burnable {
    // ONE HUNDERED MILLION CSX TOKENS
    uint256 public constant maxSupply = 100000000 * 10**18;
    IERC20 public stakedCSX;

    constructor(address stakedCSXAddress) ERC20("CSX Token", "CSX") {
        _mint(msg.sender, maxSupply);
        stakedCSX = IERC20(stakedCSXAddress);
    }    
}