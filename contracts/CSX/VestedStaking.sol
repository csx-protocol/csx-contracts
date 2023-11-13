// SPDX-License-Identifier: MIT
// StakedCSXContract v1

pragma solidity 0.8.18;

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
    
    address public immutable VESTER_ADDRESS;
    IStakedCSX public immutable ISTAKED_CSX;
    IERC20Burnable public immutable IVESTED_CSX;
    IERC20 public immutable ICSX_TOKEN;
    IERC20 public immutable IUSDC_TOKEN;
    IERC20 public immutable IUSDT_TOKEN;
    IERC20 public immutable IERC20_WETH_TOKEN;
    IKeepers public immutable IKEEPERS_CONTRACT;

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

    /**
     * @notice Constructor
     * @param _vesterAddress Vester address
     * @param _sCsxTokenAddress Staked CSX token address
     * @param _vCsxTokenAddress Vested CSX token address
     * @param _csxTokenAddress CSX token address
     * @param _usdcTokenAddress USDC token address
     * @param _usdtTokenAddress USDT token address
     * @param _wethTokenAddress WETH token address
     * @param _keepersAddress Keepers contract address
     */
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
        VESTER_ADDRESS = _vesterAddress;
        ISTAKED_CSX = IStakedCSX(_sCsxTokenAddress);
        IVESTED_CSX = IERC20Burnable(_vCsxTokenAddress);
        ICSX_TOKEN = IERC20(_csxTokenAddress);
        IUSDC_TOKEN = IERC20(_usdcTokenAddress);
        IUSDT_TOKEN = IERC20(_usdtTokenAddress);
        IERC20_WETH_TOKEN = IERC20(_wethTokenAddress);
        IKEEPERS_CONTRACT = IKeepers(_keepersAddress);
    }

    modifier onlyVester() {
        if (msg.sender != VESTER_ADDRESS) {
            revert OnlyVesterAllowed();
        }
        _;
    }

    /**
     * @notice Deposit CSX tokens into the staking contract.
     * @dev This function is called by the vester contract.
     * @param amount Amount of CSX tokens to deposit.
     */
    function deposit(uint256 amount) external {
        if (msg.sender != address(IVESTED_CSX)) {
            revert OnlyVCSXContract();
        }        
        vesting = Vesting(vesting.amount + amount, block.timestamp); // vesting time-lock (re)-starts when deposit is made
        ICSX_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        ICSX_TOKEN.safeApprove(address(ISTAKED_CSX), amount);
        ISTAKED_CSX.stake(amount);
        emit Deposit(msg.sender, amount, vesting.amount, block.timestamp);
    }

    /**
     * @notice Get the claimable amount and vesting start time.
     * @return usdcAmount 
     * @return usdtAmount 
     * @return wethAmount 
     * @return vestTimeStart 
     */
    function getClaimableAmountAndVestTimeStart() external view returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount, uint256 vestTimeStart) {
        (usdcAmount, usdtAmount, wethAmount) = ISTAKED_CSX.rewardOf(address(this));

        vestTimeStart = vesting.startTime;
    }

    /**
     * @notice Claim rewards from the staking contract.
     * @dev Only callable by the vester.
     * @param claimUsdc Whether to claim USDC rewards.
     * @param claimUsdt Whether to claim USDT rewards.
     * @param claimWeth Whether to claim WETH rewards.
     * @param convertWethToEth Whether to convert WETH rewards to ETH.
     */
    function claimRewards(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external onlyVester {
        (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) = ISTAKED_CSX
            .rewardOf(address(this));

        ISTAKED_CSX.claim(claimUsdc, claimUsdt, claimWeth, convertWethToEth);

        if (claimUsdc) {
            if (usdcAmount != 0) {
                IUSDC_TOKEN.safeTransfer(msg.sender, usdcAmount);
            }
        }
        if (claimUsdt) {
            if (usdtAmount != 0) {
                IUSDT_TOKEN.safeTransfer(msg.sender, usdtAmount);
            }
        }
        if (claimWeth) {
            if (!convertWethToEth) {
                if (wethAmount != 0){
                    IERC20_WETH_TOKEN.safeTransfer(msg.sender, wethAmount);
                }
            }
        }
        if (claimWeth) {
            if (convertWethToEth) {
                if (wethAmount != 0) {
                    (bool success, ) = msg.sender.call{value: wethAmount}("");
                    if (!success) {
                        revert TransferFailed();
                    }
                }
            }
        }
        emit Claim(msg.sender, usdcAmount, usdtAmount, wethAmount, convertWethToEth);
    }

    receive() external payable {
        if (address(IERC20_WETH_TOKEN) != msg.sender) {
            revert InvalidSender();
        }
    }

    /**
     * @notice Withdraws tokens from the contract.
     * @dev Only callable by the vester.
     * @dev Tokens are locked for 24 months.
     * @dev Vested Tokens are burned.
     * @param amount Amount of tokens to withdraw.
     */
    function withdraw(uint256 amount) external onlyVester {
        if (amount > vesting.amount || amount == 0) {
            revert NotEnoughTokens();
        }       
        if (block.timestamp < vesting.startTime + VESTING_PERIOD) {
            revert TokensAreStillLocked();
        }
        vesting.amount -= amount;
        IVESTED_CSX.burnFrom(msg.sender, amount);
        ISTAKED_CSX.unStake(amount);
        ICSX_TOKEN.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount, vesting.amount);
    }

    /**
     * @notice Withdraws tokens from the contract.
     * @dev Can only be called by the council to mitigate against malicious vesters.
     * @param amount Amount of tokens to withdraw.
     */
    function cliff(uint256 amount) external {
        if(!IKEEPERS_CONTRACT.isCouncil(msg.sender)) {
            revert InvalidSender();
        }
        if (amount > vesting.amount || amount == 0) {
            revert NotEnoughTokens();
        }    
        vesting.amount -= amount;
        cliffedAmount += amount;
        ISTAKED_CSX.unStake(amount);
        ICSX_TOKEN.safeTransfer(msg.sender, amount);
        emit Cliff(msg.sender, amount, vesting.amount);
    }
}
