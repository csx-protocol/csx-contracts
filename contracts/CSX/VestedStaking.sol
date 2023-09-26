// SPDX-License-Identifier: MIT
// StakedCSXContract v1

pragma solidity ^0.8.19;

import {IERC20, IStakedCSX, IERC20Burnable} from "./Interfaces.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct Vesting {
    uint256 amount;
    uint256 startTime;
}

error NotEnoughTokens();
error TokensAreStillLocked();
error OnlyVesterAllowed();
error OnlyVCSXContract();
error DepositFailed();
error TransferFailed();
error InvalidSender();

contract VestedStaking {
    using SafeERC20 for IERC20;
    
    Vesting public vesting;

    //uint256 public constant VESTING_PERIOD = 24 * 30 days; // 24 months
    // For testing purposes, 5 minutes
    uint256 public constant VESTING_PERIOD = 5 minutes;
    
    address public vesterAddress;
    IStakedCSX public sCsxToken;
    IERC20Burnable public vCsxToken;
    IERC20 public csxToken;
    IERC20 public usdcToken;
    IERC20 public usdtToken;
    IERC20 public wethToken;

    constructor(
        address _vesterAddress,
        address _sCsxTokenAddress,
        address _vCsxTokenAddress,
        address _csxTokenAddress,
        address _usdcTokenAddress,
        address _usdtTokenAddress,
        address _wethTokenAddress
    ) {
        if(_vesterAddress == address(0)) revert InvalidSender();
        vesterAddress = _vesterAddress;
        sCsxToken = IStakedCSX(_sCsxTokenAddress);
        vCsxToken = IERC20Burnable(_vCsxTokenAddress);
        csxToken = IERC20(_csxTokenAddress);
        usdcToken = IERC20(_usdcTokenAddress);
        usdtToken = IERC20(_usdtTokenAddress);
        wethToken = IERC20(_wethTokenAddress);
    }

    modifier onlyVester() {
        if (msg.sender != vesterAddress) {
            revert OnlyVesterAllowed();
        }
        _;
    }

    /// @notice Deposit CSX tokens into the staking contract.
    /// @param amount Amount of CSX tokens to deposit.
    /// @dev This function is called by the vester contract.
    /// @dev Only callable by the vester contract.
    function deposit(uint256 amount) external {
        if (msg.sender != address(vCsxToken)) {
            revert OnlyVCSXContract();
        }        
        vesting = Vesting(vesting.amount + amount, block.timestamp); // vesting time-lock (re)-starts when deposit is made
        csxToken.safeTransferFrom(msg.sender, address(this), amount);
        csxToken.approve(address(sCsxToken), amount);
        sCsxToken.stake(amount);
    }

    // @notice get Claimable Amount and Vesting Start Time
    /// @return usdcAmount
    /// @return usdtAmount
    /// @return wethAmount
    /// @return vestTimeStart
    function getClaimableAmountAndVestTimeStart() external view returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount, uint256 vestTimeStart) {
        (usdcAmount, usdtAmount, wethAmount) = sCsxToken.rewardOf(address(this));

        vestTimeStart = vesting.startTime;
    }

    /// @notice Claim rewards from the staking contract.
    /// @param claimUsdc Whether to claim USDC rewards.
    /// @param claimUsdt Whether to claim USDT rewards.
    /// @param claimWeth Whether to claim WETH rewards.
    /// @param convertWethToEth Whether to convert WETH rewards to ETH.
    /// @dev Only callable by the vester.
    function claimRewards(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external onlyVester {
        (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) = sCsxToken
            .rewardOf(address(this));

        sCsxToken.claim(claimUsdc, claimUsdt, claimWeth, convertWethToEth);

        if (claimUsdc && usdcAmount != 0) {
            usdcToken.safeTransfer(msg.sender, usdcAmount);
        }
        if (claimUsdt && usdtAmount != 0) {
            usdtToken.safeTransfer(msg.sender, usdtAmount);
        }
        if (claimWeth && !convertWethToEth && wethAmount != 0) {
            wethToken.safeTransfer(msg.sender, wethAmount);
        }
        if (claimWeth && convertWethToEth && wethAmount != 0) {
            (bool success, ) = msg.sender.call{value: wethAmount}("");
            if (!success) {
                revert TransferFailed();
            }
        }
    }

    receive() external payable {
        if (address(wethToken) != msg.sender) {
            revert InvalidSender();
        }
    }

    /// @notice Withdraws tokens from the contract.
    /// @param amount Amount of tokens to withdraw.
    /// @dev Only callable by the vester.
    /// @dev Tokens are locked for 24 months.
    /// @dev Vested Tokens are burned.
    function withdraw(uint256 amount) external onlyVester {
        if (amount > vesting.amount) {
            revert NotEnoughTokens();
        }       
        if (block.timestamp < vesting.startTime + VESTING_PERIOD) {
            revert TokensAreStillLocked();
        }
        vesting.amount -= amount;
        vCsxToken.burnFrom(msg.sender, amount);
        sCsxToken.unStake(amount);
        csxToken.safeTransfer(msg.sender, amount);
    }
}
