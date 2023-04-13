// SPDX-License-Identifier: MIT
// CSX Staking Contract v2

pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

contract stakedCSX is Ownable, ReentrancyGuard, ERC20 {
    IERC20 public CSX;
    IWETH public WETH;
    IERC20 public USDC;
    IERC20 public USDT;

    uint256 public constant MAX_SUPPLY = 100000000 ether;

    /// @notice PRECISION is a constant used for calculations in the contract.
    /// It is set to 10**33 to ensure accuracy in calculations.
    /// This allows for up to 100 million tokens with:
    /// - A maximum dividend per token of 10^26 ether (for 18 decimals, lowest fraction is gwei)
    /// - A maximum dividend per token of 10^32 tokens (for 6 decimals, lowest fraction is Mwei / Lovelace / Picoether)
    uint256 private constant PRECISION = 10 ** 33; // used for higher precision calculations

    /// @notice Token (usdc,weth, usdt) share of each token in gwei.
    // USDC, WETH, USDT => totalDividendPerToken
    mapping(address => uint256) dividendPerToken;

    /// @notice Token (usdc,weth, usdt) user's share of each token in gwei.
    // USDC, WETH, USDT => user => xDividendPerToken
    mapping(address => mapping(address => uint256)) xDividendPerToken;

    /// @notice Amount that should have been withdrawn
    // USDC, WETH, USDT => user => credit
    mapping(address => mapping(address => uint256)) credit;

    /// @notice State variable representing amount claimed by account in WETH, USDC, USDT
    // USDC, WETH, USDT => user => totalClaimed
    mapping(address => mapping(address => uint256)) totalClaimed;

    event FundsReceived(
        uint256 amount,
        uint256 dividendPerToken,
        address token
    );

    event FundsClaimed(uint256 amount, uint256 dividendPerToken, address token);

    modifier mintable(uint256 amount) {
        require(
            amount + totalSupply() <= MAX_SUPPLY,
            "amount surpasses max supply"
        );
        _;
    }

    modifier onlyAddress(address _address) {
        require(msg.sender == _address, "Incorrect party.");
        _;
    }

    constructor(
        address _csxAddress,
        address _weth,
        address _usdc,
        address _usdt
    ) ERC20("Staked CSX", "sCSX") {
        CSX = IERC20(_csxAddress);
        WETH = IWETH(_weth);
        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);
    }

    /// @notice Function to reward stakers.
    function depositDividend(address token, uint256 amount) external {
        require(totalSupply() != 0, "No tokens minted");
        require(
            token == address(WETH) ||
                token == address(USDC) ||
                token == address(USDT),
            "Invalid token"
        );
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        dividendPerToken[token] += (amount * PRECISION) / totalSupply();

        emit FundsReceived(amount, dividendPerToken[token], token);
    }

    function stake(uint256 amount) external mintable(amount) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            CSX.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        _mint(msg.sender, amount);
    }

    function unStake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        require(CSX.transfer(msg.sender, amount), "Token transfer failed");
    }

    function claim(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external nonReentrant {
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
        if (from == address(0) || to == address(0)) return;
        // receiver first withdraw funds to credit
        _claimToCredit(to);
        _claimToCredit(from);
    }

    //=================================== PRIVATE ==============================================

    function _claimToCredit(address to_) private {
        uint256 recipientBalance = balanceOf(to_);
        if (recipientBalance != 0) {
            uint256 usdcAmount = (((dividendPerToken[address(USDC)] -
                xDividendPerToken[address(USDC)][to_]) * recipientBalance) /
                PRECISION);
            uint256 usdtAmount = (((dividendPerToken[address(USDT)] -
                xDividendPerToken[address(USDT)][to_]) * recipientBalance) /
                PRECISION);
            uint256 wethAmount = (((dividendPerToken[address(WETH)] -
                xDividendPerToken[address(WETH)][to_]) * recipientBalance) /
                PRECISION);

            if (usdcAmount != 0) {
                credit[address(USDC)][to_] =
                    credit[address(USDC)][to_] +
                    usdcAmount;
            }

            if (usdtAmount != 0) {
                credit[address(USDT)][to_] =
                    credit[address(USDT)][to_] +
                    usdtAmount;
            }

            if (wethAmount != 0) {
                credit[address(WETH)][to_] =
                    credit[address(WETH)][to_] +
                    wethAmount;
            }
        }
        xDividendPerToken[address(USDC)][to_] = dividendPerToken[address(USDC)];
        xDividendPerToken[address(USDT)][to_] = dividendPerToken[address(USDT)];
        xDividendPerToken[address(WETH)][to_] = dividendPerToken[address(WETH)];
    }

    function _claim(address token, bool convertWethToEth) private {
        uint256 amount;
        uint256 csxBalance = balanceOf(msg.sender);
        uint256 creditBalance = credit[token][msg.sender];

        if (csxBalance != 0) {
            uint256 userDividendPerToken = xDividendPerToken[token][msg.sender];

            xDividendPerToken[token][msg.sender] = dividendPerToken[token];

            amount = (((dividendPerToken[token] - userDividendPerToken) *
                csxBalance) / PRECISION);
        }

        if (creditBalance != 0) {
            credit[token][msg.sender] = 0;
            amount += creditBalance;
        }

        if (amount != 0) {
            if (token == address(WETH) && convertWethToEth) {
                // Convert WETH to ETH and send to user
                WETH.withdraw(amount);
                // Check if the transfer is successful
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "ETH transfer failed");
            } else {
                require(
                    IERC20(token).transfer(msg.sender, amount),
                    "Token transfer failed"
                );
            }
            totalClaimed[token][msg.sender] += amount;
            emit FundsClaimed(amount, dividendPerToken[token], token);
        }
    }
}
