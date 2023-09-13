// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;

    function transfer(address to, uint value) external returns (bool);

    function withdraw(uint) external;
}

contract StakedCSX is ReentrancyGuard, ERC20 {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // Staking Token
    IERC20 public immutable tokenCSX;

    // Reward Tokens
    IWETH public immutable tokenWETH;
    IERC20 public immutable tokenUSDC;
    IERC20 public immutable tokenUSDT;

    uint256 public constant DIVISION = 10 ** 33; // to prevent float calculation

    //uint256 public lastRewardRate; // S = 0;
    // rewardToken -> lastRewardRate
    mapping(address => uint256) public lastRewardRate; // S0 = {};

    // rewardToken -> user -> rewardRate
    mapping(address => mapping (address => uint256)) public rewardRate; // S0 = {};
    //mapping(address => uint256) public rewardRate; // S0 = {};
    
    //mapping(address => uint256) public credit; // C = {};
    mapping(address => mapping(address => uint256)) credit; // C = {};

    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event ClaimReward(address indexed user, uint256 reward);
    event Distribute(address indexed user, uint256 reward);

    error AmountSurpassesMaxSupply();
    error AmountMustBeGreaterThanZero();
    error TokenTransferFailed();
    error InvalidToken();
    error NoTokensMinted();
    error InvalidSender();
    error InsufficientBalance();
    error EthTransferFailed();

    constructor(
        address _csxToken,
        address _wethToken,
        address _usdcToken,
        address _usdtToken
    ) ERC20("Staked CSX", "sCSX") {
        tokenCSX = IERC20(_csxToken);
        tokenWETH = IWETH(_wethToken);
        tokenUSDC = IERC20(_usdcToken);
        tokenUSDT = IERC20(_usdtToken);
    }

    function stake(uint256 _amount) external nonReentrant {
        if (_amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        tokenCSX.safeTransferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
        _updateRewardRate(msg.sender, address(tokenWETH));
        _updateRewardRate(msg.sender, address(tokenUSDC));
        _updateRewardRate(msg.sender, address(tokenUSDT));
        emit Stake(msg.sender, _amount);
    }

    function unStake(uint256 _amount) external nonReentrant {
        if (_amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        if (balanceOf(msg.sender) < _amount) {
            revert InsufficientBalance();
        }    

        _claimToCredit(msg.sender);
        _burn(msg.sender, _amount);

        tokenCSX.safeTransfer(msg.sender, _amount);

        emit Unstake(msg.sender, _amount);
    }

    mapping(address => uint256) public roundingErrors;
    function depositDividend(address _token, uint256 _reward) external {
        if(_reward == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        if(totalSupply() == 0) {
            revert NoTokensMinted();
        }
        if (
            _token != address(tokenWETH) &&
            _token != address(tokenUSDC) &&
            _token != address(tokenUSDT)
        ) {
            revert InvalidToken();
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _reward);

        lastRewardRate[address(_token)] += ((_reward * DIVISION) / totalSupply());
        
        emit Distribute(msg.sender, _reward);
    }

    function claim(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external nonReentrant {
        if (claimWeth) {
            _claim(msg.sender, address(tokenWETH), convertWethToEth);
        }
        if (claimUsdc) {
            _claim(msg.sender, address(tokenUSDC), false);
        }
        if (claimUsdt) {
            _claim(msg.sender, address(tokenUSDT), false);
        }       
    }

    function rewardOf(address _account) public view returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) {
        uint256 deposited = balanceOf(_account);
        
        if(deposited != 0) {
            wethAmount = (deposited * (lastRewardRate[address(tokenWETH)] - rewardRate[address(tokenWETH)][_account])) / DIVISION; // reward = deposited * (S - S0[address]);
            usdcAmount = (deposited * (lastRewardRate[address(tokenUSDC)] - rewardRate[address(tokenUSDC)][_account])) / DIVISION; // reward = deposited * (S - S0[address]);
            usdtAmount = (deposited * (lastRewardRate[address(tokenUSDT)] - rewardRate[address(tokenUSDT)][_account])) / DIVISION; // reward = deposited * (S - S0[address]);
        }
        
        if(credit[address(tokenWETH)][_account] > 0) {
            wethAmount += credit[address(tokenWETH)][_account];
        }
       
        if(credit[address(tokenUSDC)][_account] > 0) {
            usdcAmount += credit[address(tokenUSDC)][_account];
        }
       
        if(credit[address(tokenUSDT)][_account] > 0) {
            usdtAmount += credit[address(tokenUSDT)][_account];
        }
    }

    receive() external payable {
        if (address(tokenWETH) != msg.sender) {
            revert InvalidSender();
        }
    }

    //=================================== INTERNAL ==============================================

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from == address(0) || to == address(0)) return;
        _claimToCredit(to);
        _claimToCredit(from);
    }

    //=================================== PRIVATE ==============================================

    function _claimToCredit(address _to) private {
        if(balanceOf(_to) != 0) {
            (,,uint256 rewardWETH) = rewardOf(_to);
            if (rewardWETH > 0) {
                credit[address(tokenWETH)][_to] += rewardWETH;
            }
            (uint256 rewardUSDC,,) = rewardOf(_to);
            if(rewardUSDC > 0) {
                credit[address(tokenUSDC)][_to] += rewardUSDC;
            }
            (,uint256 rewardUSDT,) = rewardOf(_to);
            if(rewardUSDT > 0) {
                credit[address(tokenUSDT)][_to] += rewardUSDT;
            }
        }
        _updateRewardRate(_to, address(tokenWETH));
        _updateRewardRate(_to, address(tokenUSDC));
        _updateRewardRate(_to, address(tokenUSDT));
    }

    function _claim(address _to, address _token, bool convertWethToEth) private {
        uint256 reward;
        if(_token == address(tokenWETH)) {
            (,,reward) = rewardOf(_to);
        } else
        if(_token == address(tokenUSDC)) {
            (reward,,) = rewardOf(_to);
        } else 
        if(_token == address(tokenUSDT)) {
            (,reward,) = rewardOf(_to);
        }
        if(reward > 0) {
            credit[_token][_to] = 0;
            _updateRewardRate(_to, _token);

            if (_token == address(tokenWETH) && convertWethToEth) {
                if (tokenWETH.balanceOf(address(this)) < reward) {
                    revert InsufficientBalance();
                }
                tokenWETH.withdraw(reward);

                (bool success, ) = payable(msg.sender).call{value: reward}("");
                if (!success) {
                    revert EthTransferFailed();
                }
            } else {
                IERC20(_token).safeTransfer(_to, reward);
            }            
        }
        emit ClaimReward(msg.sender, reward);
    }

    function _updateRewardRate(address _to, address _token) private {
        rewardRate[_token][_to] = lastRewardRate[_token];
    }
}
