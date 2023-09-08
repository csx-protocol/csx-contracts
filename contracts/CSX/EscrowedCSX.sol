// SPDX-License-Identifier: MIT
// CSX Escrow Contract v1

pragma solidity 0.8.19;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

import {ReentrancyGuard} from "./Interfaces.sol";

error AlreadyInitialized();
error OnlyDeployerCanInitialize();
error AmountMustBeGreaterThanZero();
error TransferFailed();

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
        if(isInitialized) revert AlreadyInitialized();
        if(msg.sender != deployer) revert OnlyDeployerCanInitialize();

        isInitialized = true;
        vestedCSX = IERC20(_vCSXToken);
    }

    function mintEscrow(uint256 _amount) external nonReentrant {
        if(_amount == 0) revert AmountMustBeGreaterThanZero();
        if(!csxToken.transferFrom(msg.sender, address(this), _amount)) revert TransferFailed();
        _mint(msg.sender, _amount);
        emit Minted(msg.sender, _amount);
    }
}
