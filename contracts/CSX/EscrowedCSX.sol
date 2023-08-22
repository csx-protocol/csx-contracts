// SPDX-License-Identifier: MIT
// CSX Escrow Contract v1

pragma solidity 0.8.19;

import {ERC20Burnable, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import {ReentrancyGuard} from "./Interfaces.sol";

contract EscrowedCSX is ERC20Burnable, ReentrancyGuard {
    address deployer = msg.sender;
    bool public isInitialized = false;
    IERC20 public csxToken;
    IERC20 public vestedCSX;

    event Minted(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    constructor(address _csxToken) ERC20("Escrowed CSX", "eCSX") {
        csxToken = IERC20(_csxToken);
    }

    function init(address _vCSXToken) external {
        require(!isInitialized, "Already initialized");
        require(msg.sender == deployer, "Only deployer can initialize");
        isInitialized = true;
        vestedCSX = IERC20(_vCSXToken);
    }

    function mintEscrow(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(csxToken.transferFrom(msg.sender, address(vestedCSX), _amount), 'Transfer failed.');
        _mint(msg.sender, _amount);
        // vestings[msg.sender] = Vesting(_amount, block.timestamp);
        // handle vesting in vCSX contract
        emit Minted(msg.sender, _amount);
    }
}
