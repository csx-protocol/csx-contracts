// SPDX-License-Identifier: MIT
// StakedCSXContract v1

pragma solidity ^0.8.19;

import {IERC20, IStakedCSX, IERC20Burnable} from "./Interfaces.sol";

struct Vesting {
    uint256 amount;
    uint256 startTime;
}

contract VestedStaking {
    Vesting public vesting;

    uint256 public constant VESTING_PERIOD = 24 * 30 days; // 24 months

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
        vesterAddress = _vesterAddress;
        sCsxToken = IStakedCSX(_sCsxTokenAddress);
        vCsxToken = IERC20Burnable(_vCsxTokenAddress);
        csxToken = IERC20(_csxTokenAddress);
        usdcToken = IERC20(_usdcTokenAddress);
        usdtToken = IERC20(_usdtTokenAddress);
        wethToken = IERC20(_wethTokenAddress);
    }

    modifier onlyVester() {
        require(msg.sender == vesterAddress, "Only owner.");
        _;
    }

    // TEST FUNCTION REMOVE LATER
    event log_named_uint(string name, uint256 value);
    function getVestedAmount() external view returns (uint256) {
        return vesting.amount;
    }

    /// @notice Deposit CSX tokens into the staking contract.
    /// @param amount Amount of CSX tokens to deposit.
    /// @dev This function is called by the vester contract.
    /// @dev Only callable by the vester contract.
    function deposit(uint256 amount) external {
        require(msg.sender == address(vCsxToken), "Only vCSX contract.");
        require(
            csxToken.transferFrom(msg.sender, address(this), amount),
            "deposit failed."
        );
        csxToken.approve(address(sCsxToken), amount);
        sCsxToken.stake(amount);
        vesting = Vesting(vesting.amount + amount, block.timestamp); // vesting time-lock (re)-starts when deposit is made

        // emit event?
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
            .getClaimableAmount(address(this));

        sCsxToken.claim(claimUsdc, claimUsdt, claimWeth, convertWethToEth);

        if (claimUsdc && usdcAmount != 0) {
            usdcToken.transfer(msg.sender, usdcAmount);
        }
        if (claimUsdt && usdtAmount != 0) {
            usdtToken.transfer(msg.sender, usdtAmount);
        }
        if (claimWeth && !convertWethToEth && wethAmount != 0) {
            wethToken.transfer(msg.sender, wethAmount);
        }
        if (claimWeth && convertWethToEth && wethAmount != 0) {
            (bool success, ) = msg.sender.call{value: wethAmount}("");
            require(success, "Transfer failed.");
        }
    }

    /// @notice Withdraws tokens from the contract.
    /// @param amount Amount of tokens to withdraw.
    /// @dev Only callable by the vester.
    /// @dev Tokens are locked for 24 months.
    /// @dev Vested Tokens are burned.
    function withdraw(uint256 amount) external onlyVester {
        require(amount <= vesting.amount, "Not enough tokens.");
        require(
            block.timestamp >= vesting.startTime + VESTING_PERIOD,
            "Tokens are still locked."
        );
        vesting.amount -= amount;
        vCsxToken.burnFrom(msg.sender, amount);
        sCsxToken.unStake(amount);
        csxToken.transfer(msg.sender, amount);

        //ONLY FOR TEST
        emit log_named_uint("withdraw", this.getVestedAmount());
    }
}
