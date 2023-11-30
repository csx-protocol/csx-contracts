// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IWETH, SafeERC20} from "./Interfaces.sol";

contract StakedCSX is ReentrancyGuard, ERC20 {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // Staking Token
    IERC20 public immutable TOKEN_CSX;

    // Reward Tokens
    IWETH public immutable TOKEN_WETH;
    IERC20 public immutable TOKEN_USDC;
    IERC20 public immutable TOKEN_USDT;

    // Keepers
    IKeepers public immutable KEEPERS_INTERFACE;

    uint256 private constant _DIVISION = 10 ** 33; // to prevent float calculation

    // rewardToken -> lastRewardRate
    mapping(address => uint256) public lastRewardRate; // S0 = {};

    // rewardToken -> user -> rewardRate
    mapping(address => mapping (address => uint256)) public rewardRate; // S0 = {};;
    
    // rewardToken -> user -> credit
    mapping(address => mapping(address => uint256)) credit; // C = {};

    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event ClaimReward(address indexed user, uint256 reward);
    event Distribute(uint256 wethAmount, uint256 usdcAmount, uint256 usdtAmount);
    event DepositedDividend(address indexed contractAddress, address indexed token, uint256 amount);

    error AmountSurpassesMaxSupply();
    error AmountMustBeGreaterThanZero();
    error TokenTransferFailed();
    error InvalidToken();
    error NoTokensMinted();
    error InvalidSender();
    error InsufficientBalance();
    error EthTransferFailed();
    error InvalidUser();
    error ZeroAddress();

    constructor(
        address _csxToken,
        address _wethToken,
        address _usdcToken,
        address _usdtToken,
        address _keepers
    ) ERC20("Staked CSX", "sCSX") {
        if (_csxToken == address(0)) {
            revert ZeroAddress();
        }
        if (_wethToken == address(0)) {
            revert ZeroAddress();
        }
        if (_usdcToken == address(0)) {
            revert ZeroAddress();
        }
        if (_usdtToken == address(0)) {
            revert ZeroAddress();
        }
        if (_keepers == address(0)) {
            revert ZeroAddress();
        }
        TOKEN_CSX = IERC20(_csxToken);
        TOKEN_WETH = IWETH(_wethToken);
        TOKEN_USDC = IERC20(_usdcToken);
        TOKEN_USDT = IERC20(_usdtToken);
        KEEPERS_INTERFACE = IKeepers(_keepers);
    }

    /**
     * @notice Stakes the user's CSX tokens
     * @dev Mints sCSX & Sends the user's CSX to this contract.
     * @param _amount The amount of tokens to be staked
     */
    function stake(uint256 _amount) external nonReentrant {
        if (_amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        _mint(msg.sender, _amount);
        _updateRewardRate(msg.sender, address(TOKEN_WETH));
        _updateRewardRate(msg.sender, address(TOKEN_USDC));
        _updateRewardRate(msg.sender, address(TOKEN_USDT));
        TOKEN_CSX.safeTransferFrom(msg.sender, address(this), _amount);
        emit Stake(msg.sender, _amount);
    }

    /**
     * @notice Unstakes the user's sCSX tokens
     * @dev Burns the user's sCSX tokens & Sends the user's CSX to this contract.
     * @param _amount The amount of tokens to be unstaked
     */
    function unStake(uint256 _amount) external nonReentrant {
        if (_amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        if (balanceOf(msg.sender) < _amount) {
            revert InsufficientBalance();
        }    

        _claimToCredit(msg.sender);
        _burn(msg.sender, _amount);

        TOKEN_CSX.safeTransfer(msg.sender, _amount);

        emit Unstake(msg.sender, _amount);
    }

    /**
     * @notice Deposits funds to stakers
     * @dev Deposits funds to stakers as non distributed rewards
     * @dev Caching the balance before transfer for on-transfer fee tokens
     * @param _token The token to be deposited
     * @param _reward The amount of tokens to be deposited
     */
    function depositDividend(address _token, uint256 _reward) nonReentrant external returns (bool) {
        if (_reward == 0) {
            revert AmountMustBeGreaterThanZero();
        }
        if (_token != address(TOKEN_WETH)) {
            if (_token != address(TOKEN_USDC)) {
                if (_token != address(TOKEN_USDT)) {
                    revert InvalidToken();
                }
            }
        }

        uint256 actualAmountReceived = _transferToken(msg.sender, address(this), _token, _reward);
        nonDistributedRewardsPerToken[_token] += actualAmountReceived;
        emit DepositedDividend(msg.sender, _token, actualAmountReceived);
        return true;    
    }

    mapping (address => uint256) public nonDistributedRewardsPerToken;
    /**
     * @notice Distributes funds to stakers
     * @dev Distributes funds to stakers as distributed rewards
     * @param dWeth distribute WETH?
     * @param dUsdc distribute USDC?
     * @param dUsdt distribute USDT?
     */
    function distribute(bool dWeth, bool dUsdc, bool dUsdt) external {
        if(dWeth == false) {
            if(dUsdc == false) {
                if(dUsdt == false) {
                    revert InvalidToken();
                }
            }
        }
        if(!KEEPERS_INTERFACE.isCouncil(msg.sender)) {
            if(!KEEPERS_INTERFACE.isKeeperNode(msg.sender)){
                revert InvalidUser();
            }
        }
        if(totalSupply() == 0) {
            revert NoTokensMinted();
        }
        uint256 rewardWETH = nonDistributedRewardsPerToken[address(TOKEN_WETH)];
        uint256 rewardUSDC = nonDistributedRewardsPerToken[address(TOKEN_USDC)];
        uint256 rewardUSDT = nonDistributedRewardsPerToken[address(TOKEN_USDT)];
        if(rewardWETH == 0) {
            if(rewardUSDC == 0){
                if(rewardUSDT == 0){
                    revert NoTokensMinted();
                }
            }
        }
        if(rewardWETH > 0) {
            if(dWeth){
                nonDistributedRewardsPerToken[address(TOKEN_WETH)] = 0;
                lastRewardRate[address(TOKEN_WETH)] += ((rewardWETH * _DIVISION) / totalSupply());
            }            
        }
        if(rewardUSDC > 0) {
            if(dUsdc){
              nonDistributedRewardsPerToken[address(TOKEN_USDC)] = 0;
              lastRewardRate[address(TOKEN_USDC)] += ((rewardUSDC * _DIVISION) / totalSupply());  
            }
        }
        if(rewardUSDT > 0) {
            if(dUsdt){
              nonDistributedRewardsPerToken[address(TOKEN_USDT)] = 0;
              lastRewardRate[address(TOKEN_USDT)] += ((rewardUSDT * _DIVISION) / totalSupply());
            }
        }
        emit Distribute(rewardWETH, rewardUSDC, rewardUSDT);
    }

    /**
     * @notice Claims the user's rewards
     * @param claimUsdc claim USDC?
     * @param claimUsdt claim USDT?
     * @param claimWeth claim WETH?
     * @param convertWethToEth convert WETH to ETH?
     */
    function claim(
        bool claimUsdc,
        bool claimUsdt,
        bool claimWeth,
        bool convertWethToEth
    ) external nonReentrant {
        if (claimWeth) {
            _claim(msg.sender, address(TOKEN_WETH), convertWethToEth);
        }
        if (claimUsdc) {
            _claim(msg.sender, address(TOKEN_USDC), false);
        }
        if (claimUsdt) {
            _claim(msg.sender, address(TOKEN_USDT), false);
        }       
    }

    /**
     * @notice Check the user's rewards
     * @param _account The user's address
     * @return usdcAmount
     * @return usdtAmount 
     * @return wethAmount 
     */
    function rewardOf(address _account) public view returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) {
        if(_account == address(0)) {
            revert InvalidUser();
        }
        uint256 deposited = balanceOf(_account);
        
        if(deposited != 0) {
            wethAmount = (deposited * (lastRewardRate[address(TOKEN_WETH)] - rewardRate[address(TOKEN_WETH)][_account])) / _DIVISION; // reward = deposited * (S - S0[address]);
            usdcAmount = (deposited * (lastRewardRate[address(TOKEN_USDC)] - rewardRate[address(TOKEN_USDC)][_account])) / _DIVISION; // reward = deposited * (S - S0[address]);
            usdtAmount = (deposited * (lastRewardRate[address(TOKEN_USDT)] - rewardRate[address(TOKEN_USDT)][_account])) / _DIVISION; // reward = deposited * (S - S0[address]);
        }
        
        if(credit[address(TOKEN_WETH)][_account] > 0) {
            wethAmount += credit[address(TOKEN_WETH)][_account];
        }
       
        if(credit[address(TOKEN_USDC)][_account] > 0) {
            usdcAmount += credit[address(TOKEN_USDC)][_account];
        }
       
        if(credit[address(TOKEN_USDT)][_account] > 0) {
            usdtAmount += credit[address(TOKEN_USDT)][_account];
        }
    }

    /**
     * @notice For converting WETH to ETH
     * @dev Reverts if the sender is not the WETH Contract.
     */
    receive() external payable {
        if (address(TOKEN_WETH) != msg.sender) {
            revert InvalidSender();
        }
    }

    //=================================== INTERNAL ==============================================

    /**
     * @notice Updates the user's reward rate
     * @param from From address
     * @param to To address
     * @param amount Amount of tokens
     */
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

    /**
     * @notice Claims the user's rewards to credit
     * @param _to The user's address
     */
    function _claimToCredit(address _to) private {
        if(balanceOf(_to) != 0) {
            (,,uint256 rewardWETH) = rewardOf(_to);
            if (rewardWETH > 0) {
                credit[address(TOKEN_WETH)][_to] += rewardWETH;
            }
            (uint256 rewardUSDC,,) = rewardOf(_to);
            if(rewardUSDC > 0) {
                credit[address(TOKEN_USDC)][_to] += rewardUSDC;
            }
            (,uint256 rewardUSDT,) = rewardOf(_to);
            if(rewardUSDT > 0) {
                credit[address(TOKEN_USDT)][_to] += rewardUSDT;
            }
        }
        _updateRewardRate(_to, address(TOKEN_WETH));
        _updateRewardRate(_to, address(TOKEN_USDC));
        _updateRewardRate(_to, address(TOKEN_USDT));
    }

    /**
     * @notice Claims the user's rewards
     * @param _to To address
     * @param _token The token to be claimed
     * @param convertWethToEth convert WETH to ETH?
     */
    function _claim(address _to, address _token, bool convertWethToEth) private {
        uint256 reward;
        if(_token == address(TOKEN_WETH)) {
            (,,reward) = rewardOf(_to);
        } else
        if(_token == address(TOKEN_USDC)) {
            (reward,,) = rewardOf(_to);
        } else 
        if(_token == address(TOKEN_USDT)) {
            (,reward,) = rewardOf(_to);
        }
        if(reward > 0) {
            credit[_token][_to] = 0;
            _updateRewardRate(_to, _token);

            if (_token == address(TOKEN_WETH) && convertWethToEth) {
                if (TOKEN_WETH.balanceOf(address(this)) < reward) {
                    revert InsufficientBalance();
                }
                TOKEN_WETH.withdraw(reward);

                (bool success, ) = payable(msg.sender).call{value: reward}("");
                if (!success) {
                    revert EthTransferFailed();
                }
            } else {
                uint256 actualAmountTransferred = _transferToken(address(this), _to, _token, reward);
                emit ClaimReward(msg.sender, actualAmountTransferred);
            }           
        }
        emit ClaimReward(msg.sender, reward);
    }

    /**
     * @notice Updates the user's reward rate
     * @param _to To address
     * @param _token The token to be updated
     */
    function _updateRewardRate(address _to, address _token) private {
        rewardRate[_token][_to] = lastRewardRate[_token];
    }

    /**
     * @notice Transfers tokens from the sender to the recipient
     * @param from From address
     * @param to To address
     * @param _token The token to be transferred
     * @param amount Amount of tokens
     * @return actualAmountTransferred
     * @dev This function is used to transfer tokens from the sender to the recipient
     * @dev If the token is a potential fee on transfer token, it will calculate the actual amount transferred
     */
    function _transferToken(address from, address to, address _token, uint256 amount) private returns (uint256) {
        bool isFeeOnTransferToken = _token == address(TOKEN_USDT);
        uint256 beforeBalance;

        if (isFeeOnTransferToken) {
            beforeBalance = IERC20(_token).balanceOf(to);
        }

        if (from == address(this)) {
            IERC20(_token).safeTransfer(to, amount);
        } else {
            IERC20(_token).safeTransferFrom(from, to, amount);
        }

        uint256 actualAmountTransferred = amount;
        if (isFeeOnTransferToken) {
            uint256 afterBalance = IERC20(_token).balanceOf(to);
            actualAmountTransferred = afterBalance - beforeBalance;
        }

        return actualAmountTransferred;
    }

}
