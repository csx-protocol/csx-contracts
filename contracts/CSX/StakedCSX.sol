// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IWETH, SafeERC20} from "./Interfaces.sol";

struct InitParams {
    address KEEPERS_INTERFACE;
    address TOKEN_CSX;
    address TOKEN_WETH;
    address TOKEN_USDC;
    address TOKEN_USDT;
}

contract StakedCSX is ReentrancyGuard, ERC20 {
    // SafeERC20 wrapper from OpenZeppelin
    using SafeERC20 for IERC20;

    // Staking Token
    IERC20 public immutable TOKEN_CSX;

    // Reward Tokens
    IWETH public immutable TOKEN_WETH;
    IERC20 public immutable TOKEN_USDC;
    IERC20 public immutable TOKEN_USDT;

    // Keepers
    IKeepers public immutable KEEPERS_INTERFACE;

    // To prevent float calculation
    uint256 private constant _DIVISION = 10 ** 33; 

    // Duration of rewards to be paid out (in seconds) per reward token.
    // Reward token => duration
    mapping(address => uint256) public duration;
    
    // Timestamp of when the rewards finish per reward token.
    // Reward token => finishAt
    mapping(address => uint256) public finishAt;
    
    // Minimum of last updated time and reward finish time per reward token.
    // Reward token => updatedAt
    mapping(address => uint256) public updatedAt;
    
    // Reward to be paid out per second per reward token.
    // Reward token => rewardRate
    mapping(address => uint256) public rewardRate;

    // Sum of (reward rate * dt * _DIVISION / total supply) per reward token.
    // Reward token => rewardPerTokenStored
    mapping(address => uint256) public rewardPerTokenStored;

    // User address => Reward token => rewardPerTokenStored
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    
    // User address => Reward token => rewards to be claimed
    mapping(address => mapping(address => uint256)) public rewards;

    // Reward Token => Non distributed rewards per token (in wei)
    // Rewards sent via depositDividend are stored here until distributed
    mapping (address => uint256) public nonDistributedRewardsPerToken;

    // Events for various actions
    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event ClaimReward(address indexed user, uint256 reward);
    event Distribute(address indexed token, uint256 amount);
    event DepositedDividend(address indexed contractAddress, address indexed token, uint256 amount);

    // Custom errors for require statements
    error ZeroAddress();
    error Unauthorized();
    error InvalidToken();
    error RewardRateZero();
    error InsufficientBalance();
    error EthTransferFailed();
    error RewardAmountExceedsBalance(
        address rewardToken,
        uint256 requested,
        uint256 available
    );
    error RewardDurationNotFinished(
        address rewardToken,
        uint256 finishAt,
        uint256 currentTime
    );

    // ================================== CONSTRUCTOR ============================================

    /** Constructor
     * @notice Initializes the contract
     * @param _params The parameters for the contract
     * @dev It will revert if any of the addresses are the zero address
     * @dev It will set the staking token, reward tokens, and keepers interface
     * @dev It will set the name and symbol of the contract
     */
    constructor(InitParams memory _params) ERC20("Staked CSX", "sCSX") {
        if (_params.KEEPERS_INTERFACE == address(0)) {
            revert ZeroAddress();
        }
        if (_params.TOKEN_CSX == address(0)) {
            revert ZeroAddress();
        }
        if (_params.TOKEN_WETH == address(0)) {
            revert ZeroAddress();
        }
        if (_params.TOKEN_USDC == address(0)) {
            revert ZeroAddress();
        }
        if (_params.TOKEN_USDT == address(0)) {
            revert ZeroAddress();
        }
        TOKEN_CSX = IERC20(_params.TOKEN_CSX);
        TOKEN_WETH = IWETH(_params.TOKEN_WETH);
        TOKEN_USDC = IERC20(_params.TOKEN_USDC);
        TOKEN_USDT = IERC20(_params.TOKEN_USDT);
        KEEPERS_INTERFACE = IKeepers(_params.KEEPERS_INTERFACE);
    }

    // =================================== MODIFIERS ============================================

    /** Only Council or KeeperNode
     * @notice This modifier is used to restrict access to the Council or Keepers
     * @dev It will revert if the sender is not the Council or a Keeper
     */
    modifier onlyCK() {
         if(!KEEPERS_INTERFACE.isCouncil(msg.sender)) {
            if(!KEEPERS_INTERFACE.isKeeperNode(msg.sender)){
                revert Unauthorized();
            }
        }
        _;
    }

    /** Only allowed token
     * @notice This modifier is used to restrict access to the allowed tokens
     * @param _token The token to check
     * @dev It will revert if the token is not WETH, USDC, or USDT
     */
    modifier onlyAllowedTokens(address _token) {
        if (_token != address(TOKEN_WETH)) {
            if (_token != address(TOKEN_USDC)) {
                if (_token != address(TOKEN_USDT)) {
                    revert InvalidToken();
                }
            }
        }
        _;
    }

    // =================================== EXTERNAL ==============================================

    /** Stake CSX tokens
     * @param amount The amount to be staked
     * @dev This function is used to stake the amount
     * @dev It will revert if the amount is 0
     * @dev It will update the rewards for the sender
     * @dev It will mint the amount to the sender
     * @dev It will transfer the amount from the sender to the contract
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert InsufficientBalance();
        }
        _updateRewards(msg.sender);
        _mint(msg.sender, amount);
        _transferToken(msg.sender, address(this), address(TOKEN_CSX), amount);
        emit Stake(msg.sender, amount);
    }

    /** Unstakes the user's CSX tokens
     * @param amount The amount to be unstaked
     * @dev This function is used to unstake a amount
     * @dev It will revert if the amount is 0
     * @dev It will update the rewards for the sender
     * @dev It will burn the amount from the sender
     * @dev It will transfer the amount from the contract to the sender
     */
    function unStake(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert InsufficientBalance();
        }
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance();
        }
        _updateRewards(msg.sender);
        _burn(msg.sender, amount);
        _transferToken(address(this), msg.sender, address(TOKEN_CSX), amount);
        emit Unstake(msg.sender, amount);
    }

    /** Get rewards for account
     * @notice This function is used to get the rewards for the account
     * @param _account The account to get the rewards for
     * @return usdcAmount in 6 decimals
     * @return usdtAmount in 6 decimals
     * @return wethAmount in 18 decimals
     * @dev It will return the earned amount for each reward token
     */
    function rewardOf(address _account) external view returns (uint256 usdcAmount, uint256 usdtAmount, uint256 wethAmount) {
        usdcAmount = earned(_account, address(TOKEN_USDC));
        usdtAmount = earned(_account, address(TOKEN_USDT));
        wethAmount = earned(_account, address(TOKEN_WETH));
    }

    /** Claim rewards for account
     * @notice This function is used to claim the rewards for the account calling.
     * @param claimUsdc boolean to claim USDC
     * @param claimUsdt boolean to claim USDT
     * @param claimWeth boolean to claim WETH
     * @param convertWethToEth boolean to convert WETH to ETH
     * @dev claiming for msg.sender
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

    /** Deposit rewards for stakers
     * @notice Deposits funds to stakers
     * @dev Deposits funds to stakers as non distributed rewards
     * @dev Caching the balance before transfer for on-transfer fee tokens
     * @param token The token to be deposited
     * @param amount The amount of tokens to be deposited
     */
    function depositDividend(address token, uint256 amount) external nonReentrant onlyAllowedTokens(token) returns (bool) {
        if (amount == 0) {
            revert InsufficientBalance();
        }
        uint256 actualAmountReceived = _transferToken(msg.sender, address(this), token, amount);
        nonDistributedRewardsPerToken[token] += actualAmountReceived;
        emit DepositedDividend(msg.sender, token, actualAmountReceived);
        return true;    
    }

    /** Sets the duration of the rewards
     * @notice Sets the duration of the rewards
     * @param _duration The duration in seconds
     * @param _token The reward token for the rewards
     * @dev This function is used to set the duration of the rewards
     * @dev It will revert if the rewards have not finished
     * @dev It will update the duration of the rewards
     * @dev It is only callable by the Council or Keepers
     */
    function setRewardsDuration(uint256 _duration, address _token) external onlyCK {
        if (finishAt[_token] >= block.timestamp) {
            revert RewardDurationNotFinished(
                _token,
                finishAt[_token],
                block.timestamp
            );
        }
        duration[_token] = _duration;
    }

    /** Distribute rewards
     * @notice Distributes the rewards
     * @param dWeth boolean to distribute WETH
     * @param dUsdc boolean to distribute USDC
     * @param dUsdt boolean to distribute USDT
     * @dev It will revert if the sender is not the Council or a Keeper
     * @dev It will revert if all three booleans are false
     * @dev It will distribute the full amount of the nonDistributedRewardsPerToken for each token
     */
    function distribute(
        bool dWeth,
        bool dUsdc,
        bool dUsdt
    ) external onlyCK {
        if(dWeth == false) {
            if(dUsdc == false) {
                if(dUsdt == false) {
                    revert InvalidToken();
                }
            }
        }
        uint256 rewardWETH = nonDistributedRewardsPerToken[address(TOKEN_WETH)];
        uint256 rewardUSDC = nonDistributedRewardsPerToken[address(TOKEN_USDC)];
        uint256 rewardUSDT = nonDistributedRewardsPerToken[address(TOKEN_USDT)];
        if (rewardWETH > 0) {
            if(dWeth) {
                notifyRewardAmount(rewardWETH, address(TOKEN_WETH));
            }            
        }
        if (rewardUSDC > 0) {
            if(dUsdc) {
                notifyRewardAmount(rewardUSDC, address(TOKEN_USDC));
            }            
        }
        if (rewardUSDT > 0) {
            if(dUsdt) {
                notifyRewardAmount(rewardUSDT, address(TOKEN_USDT));
            }            
        }
    }

    /** Receive
     * @notice For converting WETH to ETH
     * @dev Reverts if the sender is not the WETH Contract.
     * @dev This is needed to prevent accidental sends to this contract.
     */
    receive() external payable {
        if (address(TOKEN_WETH) != msg.sender) {
            revert InvalidToken();
        }
    }

    // =================================== PUBLIC ================================================

    /** Applicable reward time
     * @notice Returns the last time for applicable rewards
     * @param _token The reward token for the rewards
     * @return The last time the reward was applicable
     * @dev It will return the minimum of the finish time and the current time
     * @dev If the finish time is less than the current time, it will return the finish time
     * @dev If the finish time is greater than the current time, it will return the current time
     * @dev This is used to prevent the reward rate from being greater than the balance of the reward token in the contract
     */
    function lastTimeRewardApplicable(address _token) public view returns (uint256) {
        return _min(finishAt[_token], block.timestamp);
    }

    /** Reward per token
     * @notice Returns the reward per token
     * @param _token The reward token for the rewards
     * @return The reward per token
     * @dev It will return the reward per token if the total supply is 0
     * @dev Or it will return the reward per token plus the reward rate 
     *      times the time since the last update, times the reward token 
     *      precision divided by the total supply.
     */
    function rewardPerToken(address _token) public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored[_token];
        }

        return
            rewardPerTokenStored[_token] +
            (rewardRate[_token] * (lastTimeRewardApplicable(_token) - updatedAt[_token]) * _DIVISION) /
            totalSupply();
    }

    /** Get earned amount
     * @notice This function is used to get the earned amount for the account
     * @param _account The account to get the earned amount for
     * @param _token The reward token for the rewards
     * @return amount The earned amount
     */
    function earned(address _account, address _token) public view returns (uint256 amount) {
        amount =
            ((balanceOf(_account) *
                (rewardPerToken(_token) - userRewardPerTokenPaid[_account][_token])) / _DIVISION) +
            rewards[_account][_token];
    }

    /** Notify the reward amount
     * @notice Notifies the contract that reward tokens have been added to be distributed.
     * @param _amount The amount of reward tokens to be distributed
     * @param _token The reward token for the rewards
     * @dev This function is used to notify the contract that reward tokens have been added to be distributed
     * @dev It will calculate the reward rate based on the amount of reward tokens added and the duration of the rewards
     * @dev It will also update the finish time of the rewards
     * @dev if nonDistributedRewardsPerToken is greater than the amount, it will subtract the amount from nonDistributedRewardsPerToken
     * ^(Scenarios exists where balance has rounding errored amount left in contract after notify & token transfers directly to contract without depositDividend being called)
     * @dev If the reward rate is 0, it will revert
     * @dev If the reward rate * duration is greater than the balance of the reward token in the contract, it will revert
     * @dev If the reward token is a potential fee on transfer token, it will calculate the actual amount transferred
     * @dev It will transfer the reward tokens from the sender to the contract
     * @dev It will update the reward rate, finish time, and last updated time
     */
    function notifyRewardAmount(
        uint256 _amount,
        address _token
    ) public onlyCK onlyAllowedTokens(_token) {
        if (_amount == 0) {
            revert InsufficientBalance();
        }
        if (nonDistributedRewardsPerToken[_token] >= _amount) {
            nonDistributedRewardsPerToken[_token] -= _amount;
        }
        _updateRewards(address(0));
        if (block.timestamp >= finishAt[_token]) {
            rewardRate[_token] = _amount / duration[_token];
        } else {
            uint256 remainingRewards = (finishAt[_token] - block.timestamp) * rewardRate[_token];
            rewardRate[_token] = (_amount + remainingRewards) / duration[_token];
        }

        if (rewardRate[_token] == 0) {
            revert RewardRateZero();
        }

        if (rewardRate[_token] * duration[_token] > IERC20(_token).balanceOf(address(this))) {
            revert RewardAmountExceedsBalance(
                _token,
                rewardRate[_token] * duration[_token],
                IERC20(_token).balanceOf(address(this))
            );
        }

        finishAt[_token] = block.timestamp + duration[_token];
        updatedAt[_token] = block.timestamp;
        
        emit Distribute(_token, _amount);
    }

    // =================================== INTERNAL ==============================================

    /** Before token transfer
     * @notice Updates the user's reward rate if the user has transferred tokens
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
        if (from == address(0)) return;
        if (to == address(0)) return;        
        _updateRewards(to);
        _updateRewards(from);
    }

    // =================================== PRIVATE ==============================================

    /** Update Rewards
     * @notice Updates all the rewards for the account
     * @param _account The account to update the rewards for
     * @dev This is used to update the all rewards for the account
     * @dev It will use the _updateReward function to update the rewards for each token
     */
    function _updateRewards(address _account) private {
        _updateReward(_account, address(TOKEN_WETH));
        _updateReward(_account, address(TOKEN_USDC));
        _updateReward(_account, address(TOKEN_USDT));
    }

    /** Update reward
     * @notice Updates the reward for the account
     * @param _account The account to update the reward for
     * @param _token The reward token for the rewards
     * @dev This is used to update the reward for the account
     * @dev It will update the reward per token stored
     * @dev It will update the last time the reward was applicable
     * @dev If the account is not the zero address, it will update the token rewards for the account
     */
    function _updateReward(address _account, address _token) private {
        rewardPerTokenStored[_token] = rewardPerToken(_token);
        updatedAt[_token] = lastTimeRewardApplicable(_token);

        if (_account != address(0)) {
            rewards[_account][_token] = earned(_account, _token);
            userRewardPerTokenPaid[_account][_token] = rewardPerTokenStored[_token];
        }
    }

    /** Claim reward
     * @notice Claims the reward for the account
     * @param _to The account to claim the reward for
     * @param _token The reward token for the rewards
     * @param _convertWethToEth Whether to convert WETH to ETH
     */
    function _claim(
        address _to,
        address _token,
        bool _convertWethToEth
    ) private {
        _updateReward(_to, _token);
        uint256 reward = rewards[_to][_token];
        if (reward > 0) {
            rewards[_to][_token] = 0;
            if (_token == address(TOKEN_WETH) && _convertWethToEth) {
                if (TOKEN_WETH.balanceOf(address(this)) < reward) {
                    revert InsufficientBalance();
                }
                TOKEN_WETH.withdraw(reward);
                (bool success, ) = payable(_to).call{value: reward}("");
                if (!success) {
                    revert EthTransferFailed();
                }                
            } else {
                uint256 _actual = _transferToken(
                    address(this),
                    _to,
                    _token,
                    reward
                );
                reward = _actual;
            }

            emit ClaimReward(_to, reward);
        }
    }

    /** Transfer token
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
        bool isFeeOnTransferToken = _token == address(TOKEN_USDT) || _token == address(TOKEN_USDC);
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

    /** Minimum of two numbers
     * @notice Returns the minimum of two numbers
     * @param x First number
     * @param y Second number
     * @return min The minimum of the two numbers
     * @dev This function is used to return the minimum of two numbers
     * @dev If the two numbers are equal, it will return the first number
     * @dev If the two numbers are not equal, it will return the smaller number
     */
    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }
}
