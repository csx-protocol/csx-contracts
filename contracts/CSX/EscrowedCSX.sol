// SPDX-License-Identifier: MIT
// CSX Escrow Contract v1

pragma solidity 0.8.18;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

import {ReentrancyGuard, SafeERC20} from "./Interfaces.sol";

error AlreadyInitialized();
error OnlyDeployerCanInitialize();
error AmountMustBeGreaterThanZero();
error TransferFailed();

contract EscrowedCSX is ERC20Burnable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable DEPLOYER;
    bool private _isInitialized;
    IERC20 public immutable CSX_TOKEN;
    IERC20 public vestedCSX;

    event Minted(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    constructor(address _csxToken) ERC20("Escrowed CSX", "eCSX") {
        CSX_TOKEN = IERC20(_csxToken);
        DEPLOYER = msg.sender;
    }

    /**
     * @notice Initializes the contract
     * @dev Sets the VestedCSX contract address
     * @param _vCSXToken address of the VestedCSX contract
     */
    function init(address _vCSXToken) external {
        if(_isInitialized) revert AlreadyInitialized();
        if(msg.sender != DEPLOYER) revert OnlyDeployerCanInitialize();

        _isInitialized = true;
        vestedCSX = IERC20(_vCSXToken);
    }

    /**
     * @notice Mints the user's escrowed CSX tokens
     * @dev Mints Escrowed CSX & Sends the user's CSX to the VestedCSX contract
     * @param _amount The amount of tokens to be minted
     */
    function mintEscrow(uint256 _amount) external nonReentrant {
        if(_amount == 0) revert AmountMustBeGreaterThanZero();
        _mint(msg.sender, _amount);
        emit Minted(msg.sender, _amount);
        CSX_TOKEN.safeTransferFrom(msg.sender, address(vestedCSX), _amount);
    }
}
