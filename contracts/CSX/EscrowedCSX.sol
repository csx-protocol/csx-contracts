// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import { ERC20Burnable, ERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "contracts/interfaces/IERC20.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { IEscrowedCSX } from "contracts/interfaces/IEscrowedCSX.sol";

contract EscrowedCSX is IEscrowedCSX, ERC20Burnable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bool public isInitialized = false;
    IERC20 public csxToken;
    IERC20 public vestingToken;

    constructor( 
        string memory _name,
        string memory _symbol,
        address _csxToken
    ) ERC20(_name, _symbol) {
        if (_csxToken == address(0)) revert IErrors.ZeroAddress();
        csxToken = IERC20(_csxToken);
        _transferOwnership(msg.sender);
    }

    function init(address vCSXToken) external  onlyOwner() {
        if (isInitialized) revert IErrors.AlreadyInitialized();
        if (vCSXToken == address(0)) revert IErrors.ZeroAddress();
        isInitialized = true;
        vestingToken = IERC20(vCSXToken);

        emit Initialized();
    }

    function mintEscrow(uint256 amount) external {
        if (amount == 0) revert IErrors.ZeroAmount();
        if (csxToken.allowance(msg.sender, address(this)) < amount) revert IErrors.InsufficientAllowance();
        //csxToken.transferFrom(msg.sender, address(this), amount);
        //csxToken.safeTransferFrom(msg.sender, address(vestingToken), amount);
        //_mint(msg.sender, amount);
    }
}
