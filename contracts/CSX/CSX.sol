//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SkinsMarketCoin is ERC20 {
    // ONE HUNDERED MILLION SMC
    uint256 public constant maxSupply = 100000000 ether;
    IERC20 public stakedCSX;

    constructor(address stakedCSXAddress) ERC20("CSX Token", "CSX") {
        _mint(msg.sender, maxSupply);
        stakedCSX = IERC20(stakedCSXAddress);
    }    
}