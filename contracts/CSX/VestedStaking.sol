// SPDX-License-Identifier: MIT
// StakedCSXContract v1

pragma solidity ^0.8.18;

import {IERC20, IStakedCSX, IERC20Burnable} from "./Interfaces.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";

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
    uint256 public cliffedAmount;

    uint256 public constant VESTING_PERIOD = 24 * 30 days; // 24 months
    
    address public immutable vesterAddress;
    IStakedCSX public immutable sCsxToken;
    IERC20Burnable public immutable vCsxToken;
    IERC20 public immutable csxToken;
    IERC20 public immutable usdcToken;
    IERC20 public immutable usdtToken;
    IERC20 public immutable wethToken;
    IKeepers public immutable keepers;

    event Deposit(
        address indexed sender,
        uint256 amount,
        uint256 newVestingAmount,
        uint256 timestamp
    );

    event Claim(
        address indexed claimer,
        uint256 usdcAmount,
        uint256 usdtAmount,
        uint256 wethAmount,
        bool convertedToEth
    );

    event Withdraw(
        address indexed withdrawer,
        uint256 amount,
        uint256 newVestingAmount
    );

    event Cliff(
        address indexed council,
        uint256 amount,
        uint256 newVestingAmount
    );

    constructor(
        address _vesterAddress,
        address _sCsxTokenAddress,
        address _vCsxTokenAddress,
        address _csxTokenAddress,
        address _usdcTokenAddress,
        address _usdtTokenAddress,
        address _wethTokenAddress,
        address _keepersAddress
    ) {
        if(_vesterAddress == address(0)) revert InvalidSender();
        vesterAddress = _vesterAddress;
        sCsxToken = IStakedCSX(_sCsxTokenAddress);
        vCsxToken = IERC20Burnable(_vCsxTokenAddress);
        csxToken = IERC20(_csxTokenAddress);
        usdcToken = IERC20(_usdcTokenAddress);
        usdtToken = IERC20(_usdtTokenAddress);
        wethToken = IERC20(_wethTokenAddress);
        keepers = IKeepers(_keepersAddress);
    }

    modifier onlyVester() {
        if (msg.sender != vesterAddress) {
            revert OnlyVesterAllowed();
        }
        _;
    }

    modifier onlyCouncil {
        if(!keepers.isCouncil(msg.sender)) {
            revert InvalidSender();
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
        csxToken.safeApprove(address(sCsxToken), amount);
        sCsxToken.stake(amount);
        emit Deposit(msg.sender, amount, vesting.amount, block.timestamp);
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
        emit Claim(msg.sender, usdcAmount, usdtAmount, wethAmount, convertWethToEth);
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
        if (amount > vesting.amount || amount == 0) {
            revert NotEnoughTokens();
        }       
        if (block.timestamp < vesting.startTime + VESTING_PERIOD) {
            revert TokensAreStillLocked();
        }
        vesting.amount -= amount;
        vCsxToken.burnFrom(msg.sender, amount);
        sCsxToken.unStake(amount);
        csxToken.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount, vesting.amount);
    }

    /// @notice Executes a forced withdrawal of tokens from the contract.
    /// @dev Can only be called by the council to mitigate against malicious vesters.
    /// @param amount Specifies the amount of tokens to be withdrawn.
    function cliff(uint256 amount) external onlyCouncil {
        if (amount > vesting.amount || amount == 0) {
            revert NotEnoughTokens();
        }    
        vesting.amount -= amount;
        cliffedAmount += amount;
        sCsxToken.unStake(amount);
        csxToken.safeTransfer(msg.sender, amount);
        emit Cliff(msg.sender, amount, vesting.amount);
    }
}
