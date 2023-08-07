// SPDX-License-Identifier: MIT
// csx Staking Contract v2

pragma solidity 0.8.19;

import { ERC20Capped, ERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "contracts/interfaces/IERC20.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { IWETH} from "./Interfaces.sol";
import { IStakedCSX } from "contracts/interfaces/IStakedCSX.sol";

contract StakedCSX is IStakedCSX, ERC20Capped, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public csx;
    IWETH public WETH;
    IERC20 public USDC;
    IERC20 public USDT;

    //uint256 public constant MAX_SUPPLY = 100000000 ether;

    /// @notice _PRECISION is a constant used for calculations in the contract.
    /// It is set to 10**33 to ensure accuracy in calculations.
    /// This allows for up to 100 million tokens with:
    /// - A maximum dividend per token of 10^26 ether (for 18 decimals, lowest fraction is gwei)
    /// - A maximum dividend per token of 10^32 tokens (for 6 decimals, lowest fraction is Mwei / Lovelace / Picoether)
    uint256 private constant _PRECISION = 10 ** 33; // used for higher _PRECISION calculations

    /// @notice Token (usdc,weth, usdt) share of each token in gwei.
    // USDC, WETH, USDT => totalDividendPerToken
    mapping(address => uint256) private _dividendPerToken;

    /// @notice Token (usdc,weth, usdt) user's share of each token in gwei.
    // USDC, WETH, USDT => user => _xDividendPerToken
    mapping(address => mapping(address => uint256)) private _xDividendPerToken;

    /// @notice Amount that should have been withdrawn
    // USDC, WETH, USDT => user => _credit
    mapping(address => mapping(address => uint256)) private _credit;

    /// @notice State variable representing amount claimed by account in WETH, USDC, USDT
    // USDC, WETH, USDT => user => _totalClaimed
    mapping(address => mapping(address => uint256)) private _totalClaimed;

    // @notice blocknumber state for each stakes
    // account => blocknumber
    mapping(address => uint256) private _stakesBlockNumber;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _cap,
        address _csxAddress,
        address _weth,
        address _usdc,
        address _usdt
    ) ERC20Capped(_cap) ERC20(_name, _symbol) {
        csx = IERC20(_csxAddress);
        WETH = IWETH(_weth);
        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);
    }

    //=================================== EXTERNAL ==============================================
    receive() external payable {
        require(address(WETH) == msg.sender, "Invalid sender");
    }

    function getDividendPerToken(address token) external view override returns (uint256) {
        return _dividendPerToken[token];
    }
    /// @notice Function to getClaimableAmount
    /// @param account address of the user
    /// @return usdcAmount
    /// @return usdtAmount
    /// @return wethAmount
    function getClaimableAmount(
        address account
    ) external view override returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) {
        uint256 recipientBalance = balanceOf(account);
        usdcAmount = (((_dividendPerToken[address(USDC)] -
            _xDividendPerToken[address(USDC)][account]) * recipientBalance) /
            _PRECISION);
        usdtAmount = (((_dividendPerToken[address(USDT)] -
            _xDividendPerToken[address(USDT)][account]) * recipientBalance) /
            _PRECISION);
        wethAmount = (((_dividendPerToken[address(WETH)] -
            _xDividendPerToken[address(WETH)][account]) * recipientBalance) /
            _PRECISION);
    }

    /**
     * @notice deposit `amount` of `token` to the contract
     * @param token address of the token to deposit
     * @param amount amount of tokens to deposit
     * @dev emits a FundsReceived event
        *
            * Requirements:
            * - address `token` can't be the zero address
            * - `amount` must be greater than 0
            * - `amount` must be less than or equal to the balance of `msg.sender` for `token`
            * - `amount` must be less than or equal to the allowance of `msg.sender` for `token`
            * - `address token` must be a supported token WETH, USDC, USDT
            * - totalSupply must be greater than 0
    */
    function depositDividend(address token, uint256 amount) external override returns (bool) {
        if (token == address(0)) revert IErrors.ZeroAddress();
        if (amount == 0) revert IErrors.ZeroAmount();
        if (amount > IERC20(token).balanceOf(msg.sender)) revert IErrors.InsufficientBalance();
        if (amount > IERC20(token).allowance(msg.sender, address(this))) revert IErrors.InsufficientAllowance();

        if (
            token != address(WETH) && 
            token != address(USDC) && 
            token != address(USDT)
        ) revert TokenNotSupported(token);
        
        if (totalSupply() == 0) revert ZeroTokensMinted();
      
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _dividendPerToken[token] = _dividendPerToken[token] + (amount * _PRECISION) / totalSupply();

        emit FundsReceived(amount, _dividendPerToken[token], token);

        return true;
    }

    /**
     * @notice stake `amount` of csx tokens
     * @param amount amount of csx tokens to stake
     * @dev emits a Staked event
     *
        * Requirements:
        * - staker can't call this function twice in the same block
        * - `amount` must be greater than 0
        * - staker must have a balance of at least `amount` for csx tokens
        * - staker must have an allowance for csx tokens of at least `amount` to this contract
     */
    function stake(uint256 amount) external override nonReentrant {
        if (amount == 0) revert IErrors.ZeroAmount();
        if (amount > csx.balanceOf(msg.sender)) revert IErrors.InsufficientBalance();
        if (amount > csx.allowance(msg.sender, address(this))) revert IErrors.InsufficientAllowance();

        uint256 currentBlockNumber = block.number;

        csx.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);

        _stakesBlockNumber[msg.sender] = currentBlockNumber;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice unstake `amount` of csx tokens
     * @param amount amount of csx tokens to unstake
     * @dev emits a Unstaked event
     *
        * Requirements:
        * - staker can't call this function twice in the same block
        * - `amount` must be greater than 0
        * - staker must have a balance of at least `amount` for scsx tokens
        * - staker can't unstake after stake withing the same block
     */
    function unstake(uint256 amount) external override nonReentrant {
        if (amount == 0) revert IErrors.ZeroAmount();
        if (amount > balanceOf(msg.sender)) revert IErrors.InsufficientBalance();

        uint256 currentBlockNumber = block.number;
        if (_stakesBlockNumber[msg.sender] == currentBlockNumber) revert UnstakeSameBlock(currentBlockNumber);

        _claimToCredit(msg.sender);

        _burn(msg.sender, amount);
        
        csx.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function claim(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external nonReentrant override {
        if (claimWeth) {
            _claim(address(WETH), convertWethToEth);
        }
        if (claimUsdc) {
            _claim(address(USDC), false);
        }
        if (claimUsdt) {
            _claim(address(USDT), false);
        }
    }

    //=================================== INTERNAL ==============================================
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        // Don't go to _claimToCredit if it's just minted or burned
        if (from == address(0) || to == address(0)) return;
        // receiver first withdraw funds to _credit
        _claimToCredit(to);
        _claimToCredit(from);
    }

    //=================================== PRIVATE ==============================================

    function _claimToCredit(address to_) private {
        uint256 recipientBalance = balanceOf(to_);
        if (recipientBalance != 0) {
            uint256 usdcAmount = (((_dividendPerToken[address(USDC)] -
                _xDividendPerToken[address(USDC)][to_]) * recipientBalance) /
                _PRECISION);
            uint256 usdtAmount = (((_dividendPerToken[address(USDT)] -
                _xDividendPerToken[address(USDT)][to_]) * recipientBalance) /
                _PRECISION);
            uint256 wethAmount = (((_dividendPerToken[address(WETH)] -
                _xDividendPerToken[address(WETH)][to_]) * recipientBalance) /
                _PRECISION);

            if (usdcAmount != 0) {
                _credit[address(USDC)][to_] =
                    _credit[address(USDC)][to_] +
                    usdcAmount;
            }

            if (usdtAmount != 0) {
                _credit[address(USDT)][to_] =
                    _credit[address(USDT)][to_] +
                    usdtAmount;
            }

            if (wethAmount != 0) {
                _credit[address(WETH)][to_] =
                    _credit[address(WETH)][to_] +
                    wethAmount;
            }
        }
        _xDividendPerToken[address(USDC)][to_] = _dividendPerToken[address(USDC)];
        _xDividendPerToken[address(USDT)][to_] = _dividendPerToken[address(USDT)];
        _xDividendPerToken[address(WETH)][to_] = _dividendPerToken[address(WETH)];
    }

    function _claim(address token, bool convertWethToEth) private {
        uint256 amount;
        uint256 csxBalance = balanceOf(msg.sender);
        uint256 creditBalance = _credit[token][msg.sender];

        if (csxBalance != 0) {
            uint256 userDividendPerToken = _xDividendPerToken[token][msg.sender];

            _xDividendPerToken[token][msg.sender] = _dividendPerToken[token];

            amount = (((_dividendPerToken[token] - userDividendPerToken) *
                csxBalance) / _PRECISION);
        }

        if (creditBalance != 0) {
            _credit[token][msg.sender] = 0;
            amount += creditBalance;
        }

        if (amount != 0) {
            if (token == address(WETH) && convertWethToEth) {
                // Convert WETH to ETH and send to user
                WETH.withdraw(amount);
                // Check if the transfer is successful
                (bool success, ) = payable(msg.sender).call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                require(
                    IERC20(token).transfer(msg.sender, amount),
                    "Token transfer failed"
                );
            }
            _totalClaimed[token][msg.sender] += amount;
            emit FundsClaimed(amount, _dividendPerToken[token], token);
        }
    }
}
