// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {NetValueCalculator} from "./NetValueCalculator.sol";
import {ITradeFactory} from "../TradeFactory/ITradeFactory.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20, IWETH, ReentrancyGuard} from "../CSX/Interfaces.sol";

error ZeroAddress();
error ZeroAmount();
error InvalidReferralCode(string reason);
error InvalidRatios(string reason);
error Unauthorized(string reason);
error NotTradeContract();
error NotPaymentToken();
error ReferralCodeNotRegistered(string reason);
error OwnerOfReferralCode(string reason);
error ReferralCodeAlreadySet(string reason);


struct ReferralInfo {
    address owner;
    uint256 ownerRatio;
    uint256 buyerRatio;        
}

contract ReferralRegistry is NetValueCalculator, ReentrancyGuard {
    using SafeERC20 for IERC20;
    ITradeFactory public factory;
    IKeepers private _keepers;

    event ReferralCodeRegistered(
        bytes32 indexed referralCode,
        address indexed owner,
        uint256 ownerRatio,
        uint256 buyerRatio
    );

    event ReferralCodeRebateUpdated(
        address indexed contractAddress,
        bytes32 indexed referralCode,
        address indexed owner,
        address paymentToken,
        uint256 rebate
    );

    event ClaimReward(
        address indexed user, 
        address indexed paymentToken, 
        uint256 amount
    );

    // Map to store total rebate per referral code per payment token
    mapping(bytes32 => mapping(address => uint256)) rebatePerCodePerPaymentToken;

    // Map to store claimable rewards per user per payment token
    mapping(address => mapping(address => uint256)) public claimableRewardsPerUserPerPaymentToken;

    // Map to store referral codes with corresponding owner's address and distribution ratios
    mapping(bytes32 => ReferralInfo) private referralInfos;

    // Map to store referral codes with corresponding user's address
    mapping(address => bytes32) private userReferralCode;

    // Map to store referral codes created by a user
    mapping(address => bytes32[]) private userCreatedCodes;

    // Reward Tokens
    IWETH public immutable TOKEN_WETH;
    IERC20 public immutable TOKEN_USDC;
    IERC20 public immutable TOKEN_USDT;

    /**
     * @notice Construct the ReferralRegistry contract
     * @param _address_keepers Keepers Contract Address
     * @param _token_weth Wrapped-ETH Token Address
     * @param _token_usdc USDC Token Address
     * @param _token_usdt USDT Token Address
     */
    constructor(address _address_keepers, address _token_weth, address _token_usdc, address _token_usdt) {
        if (_address_keepers == address(0)) {
            revert ZeroAddress();
        }
        if (_token_weth == address(0)) {
            revert ZeroAddress();
        }
        if (_token_usdc == address(0)) {
            revert ZeroAddress();
        }
        if (_token_usdt == address(0)) {
            revert ZeroAddress();
        }
        _keepers = IKeepers(_address_keepers);
        TOKEN_WETH = IWETH(_token_weth);
        TOKEN_USDC = IERC20(_token_usdc);
        TOKEN_USDT = IERC20(_token_usdt);
    }

    // =========================================== EXTERNAL FUNCTIONS ==========================================

    /**
     * @notice Get the rebate for a referral code and payment token
     * @param referralCode The referral code
     * @param paymentToken The payment token address
     * @return The rebate for the referral code and payment token
     */
    function getRebatePerCodePerPaymentToken(bytes32 referralCode, address paymentToken) external view returns (uint256) {
        return rebatePerCodePerPaymentToken[referralCode][paymentToken];
    }

    /**
     * @notice Get the referral codes created by a user
     * @param user The user address
     * @return The referral codes created by the user
     */
    function getReferralCodesByUser(address user) external view returns (bytes32[] memory) {
        return userCreatedCodes[user];
    }

    /**
     * @notice Get the referral code of a user
     * @param user The user address
     * @return The referral code of the user
     */
    function getReferralCode(address user) external view returns (bytes32) {
        return userReferralCode[user];
    }

    /**
     * @notice Get the referral info of a referral code
     * @param referralCode The referral code
     */
    function getReferralInfo(
        bytes32 referralCode
    ) external view returns (ReferralInfo memory) {
        return referralInfos[referralCode];
    }

    /**
     * @notice Get the owner of a referral code
     * @param referralCode The referral code
     */
    function getReferralCodeOwner(
        bytes32 referralCode
    ) external view returns (address) {
        return referralInfos[referralCode].owner;
    }

    /**
     * @notice Get the distribution ratios of a referral code
     * @param referralCode The referral code
     * @return ownerRatio 
     * @return buyerRatio 
     */
    function getReferralCodeRatios(
        bytes32 referralCode
    ) external view returns (uint256 ownerRatio, uint256 buyerRatio) {
        ownerRatio = referralInfos[referralCode].ownerRatio;
        buyerRatio = referralInfos[referralCode].buyerRatio;
    }

    /**
     * @notice Check if a referral code is registered
     * @param referralCode The referral code
     * @return true if the referral code is registered
     */
    function isReferralCodeRegistered(
        bytes32 referralCode
    ) external view returns (bool) {
        return referralInfos[referralCode].owner != address(0);
    }

    /**
     * @notice Reward a user via their referral code
     * @param referralCode bytes32 referral code
     * @param paymentToken address payment token
     * @param amount uint256 amount of payment token
     * @return true if the reward is successful
     * @dev Reverts if the payment token is not WETH, USDC or USDT
     * @dev Reverts if the referral code is empty
     * @dev Reverts if the amount is zero
     * @dev Reverts if the caller is not a trade contract
     * @dev Reverts if the referral code is not registered
     */
    function rewardUser(bytes32 referralCode, address paymentToken, uint256 amount) external nonReentrant returns (bool) {
        if(paymentToken != address(TOKEN_WETH)){
            if(paymentToken != address(TOKEN_USDC)){
                if(paymentToken != address(TOKEN_USDT)){
                    revert NotPaymentToken();
                }
            }
        }
        if (referralCode == 0) {
            revert InvalidReferralCode('Referral code cannot be empty');
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (!factory.isThisTradeContract(msg.sender)) {
            revert NotTradeContract();
        }
        address owner = referralInfos[referralCode].owner;
        if(owner == address(0)){
            revert ReferralCodeNotRegistered("Referral code not registered");
        }
        uint256 _actualAmountTransferred;
        uint256 _beforeBalance = IERC20(paymentToken).balanceOf(msg.sender);

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 _afterBalance = IERC20(paymentToken).balanceOf(msg.sender);
        _actualAmountTransferred = _beforeBalance - _afterBalance;

        claimableRewardsPerUserPerPaymentToken[owner][paymentToken] += _actualAmountTransferred;
        rebatePerCodePerPaymentToken[referralCode][paymentToken] += _actualAmountTransferred;
        emit ReferralCodeRebateUpdated(msg.sender, referralCode, owner, paymentToken, _actualAmountTransferred);
        return true;
    }

    /**
     * @notice Claim the reward for a user
     * @param weth bool claim weth
     * @param usdc bool claim usdc
     * @param usdt bool claim usdt
     */
    function claimReferralRewards(bool weth, bool usdc, bool usdt) external nonReentrant {
        if(weth) {
            uint256 amount = 
                claimableRewardsPerUserPerPaymentToken[msg.sender][address(TOKEN_WETH)];
            if(amount != 0)
                _claimReward(msg.sender, address(TOKEN_WETH));
        }
        if(usdc) {
            uint256 amount = 
                claimableRewardsPerUserPerPaymentToken[msg.sender][address(TOKEN_USDC)];
            if(amount != 0)                
                _claimReward(msg.sender, address(TOKEN_USDC));
        }
        if(usdt) {
            uint256 amount = 
                claimableRewardsPerUserPerPaymentToken[msg.sender][address(TOKEN_USDT)];
            if(amount != 0)
                _claimReward(msg.sender, address(TOKEN_USDT));
        }
    }

    /**
     * @notice Set a referral code for a user
     * @dev This function can only be called by a trade contract
     * @param referralCode The referral code
     * @param user The user address
     */
    function setReferralCodeAsTC(bytes32 referralCode, address user) external {
        if(user == address(0)){
            revert ZeroAddress();
        }
        if(!factory.isThisTradeContract(msg.sender)){
            revert NotTradeContract();
        }
        _setReferralCode(referralCode, user);
    }

    /**
     * @notice Set a referral code as a user
     * @param referralCode The referral code
     */
    function setReferralCodeAsUser(bytes32 referralCode) external {
        if (referralCode == 0) revert InvalidReferralCode("Referral code cannot be empty");
        if (referralInfos[referralCode].owner == address(0)) revert ReferralCodeNotRegistered("Referral code not registered");
        if (referralInfos[referralCode].owner == msg.sender) revert OwnerOfReferralCode("You are the owner of this referral code");
        if (userReferralCode[msg.sender] == referralCode) revert ReferralCodeAlreadySet("Referral code already set for this user");
        if (containsSpace(referralCode)) revert InvalidReferralCode("Referral code cannot contain spaces");

        _setReferralCode(referralCode, msg.sender);
    }

    /**
     * @notice Change the relying contracts
     * @dev This function can only be called by council
     * @param _factory CSXTradeFactory Address
     * @param _address_keepers Keepers Contract Address
     */
    function changeContracts(address _factory, address _address_keepers) external {
        if(!_keepers.isCouncil(msg.sender)){
            revert Unauthorized("Only council can change contracts");
        }
        if(_factory == address(0)){
            revert ZeroAddress();
        }
        if(_address_keepers == address(0)){
            revert ZeroAddress();
        }
        factory = ITradeFactory(_factory);
        _keepers = IKeepers(_address_keepers);
    }

    // =========================================== PRIVATE FUNCTIONS ===========================================

    /**
     * @notice Claim the reward for a user
     * @param user The user address
     * @param paymentToken The payment token address
     * @dev Private function to claim the reward for a user
     * @dev Reverts if the payment token is zero address
     * @dev Reverts if the amount is zero
     */
    function _claimReward(address user, address paymentToken) private {
        if (paymentToken == address(0)) {
            revert ZeroAddress();
        }
        uint256 amount = claimableRewardsPerUserPerPaymentToken[user][paymentToken];
        if (amount == 0) {
            revert ZeroAmount();
        }
        delete claimableRewardsPerUserPerPaymentToken[user][paymentToken];
        IERC20(paymentToken).safeTransfer(user, amount);
        emit ClaimReward(user, paymentToken, amount);
    }

    /**
     * @notice Set the referral code of a user
     * @dev Private function to set the referral code of a user
     * @param referralCode The referral code
     * @param user The user address
     */
    function _setReferralCode(bytes32 referralCode, address user) private {
        userReferralCode[user] = referralCode;
    }

    /**
     * @notice Register a referral code with distribution ratios
     * @param referralCode The referral code
     * @param ownerRatio affiliator rebate ratio
     * @param buyerRatio buyer discount ratio
     */
    function registerReferralCode(
        bytes32 referralCode,
        uint256 ownerRatio,
        uint256 buyerRatio
    ) external {
        if (referralCode == 0) revert InvalidReferralCode("Referral code cannot be empty");
        if (referralInfos[referralCode].owner != address(0)) revert InvalidReferralCode("Referral code already registered");
        if (ownerRatio + buyerRatio != 100) revert InvalidRatios("The sum of ownerRatio and buyerRatio must be 100");
        if (containsSpace(referralCode)) revert InvalidReferralCode("Referral code cannot contain spaces");

        referralInfos[referralCode] = ReferralInfo({
            owner: msg.sender,
            ownerRatio: ownerRatio,
            buyerRatio: buyerRatio
        });

        userCreatedCodes[msg.sender].push(referralCode);

        emit ReferralCodeRegistered(
            referralCode,
            msg.sender,
            ownerRatio,
            buyerRatio
        );
    }

    /**
     * @notice Check if a referral code contains a space
     * @dev Helper function to check if a referral code contains a space
     * @param code The referral code
     */
    function containsSpace(bytes32 code) private pure returns (bool) {
        for (uint256 i; i < 32; ++i) {
            if (code[i] == 0x20) {
                return true;
            }
        }
        return false;
    }
}
