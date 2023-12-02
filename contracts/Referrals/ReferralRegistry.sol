// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {NetValueCalculator} from "./NetValueCalculator.sol";
import {ITradeFactory} from "../TradeFactory/ITradeFactory.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";

error ZeroAddress();
error InvalidReferralCode(string reason);
error InvalidRatios(string reason);
error Unauthorized(string reason);

error NotTradeContract();
error ReferralCodeNotRegistered(string reason);
error OwnerOfReferralCode(string reason);
error ReferralCodeAlreadySet(string reason);


contract ReferralRegistry is NetValueCalculator {
    ITradeFactory public factory;
    IKeepers private keepers;

    constructor(address _keepers) {
        if (_keepers == address(0)) {
            revert ZeroAddress();
        }
        keepers = IKeepers(_keepers);
    }

    mapping(bytes32 => mapping(address => uint256)) rebatePerCodePerPaymentToken;

    /**
     * @notice Get the rebate for a referral code and payment token
     * @param referralCode The referral code
     * @param paymentToken The payment token address
     * @return The rebate for the referral code and payment token
     */
    function getRebatePerCodePerPaymentToken(bytes32 referralCode, address paymentToken) external view returns (uint256) {
        return rebatePerCodePerPaymentToken[referralCode][paymentToken];
    }

    struct ReferralInfo {
        address owner;
        uint256 ownerRatio;
        uint256 buyerRatio;        
    }

    modifier onlyTradeContracts(address contractAddress) {
        if (msg.sender != contractAddress) {
            revert NotTradeContract();            
        }
        if(factory.isThisTradeContract(contractAddress)){
            revert NotTradeContract();
        }
        _;
    }

    // Map to store referral codes with corresponding owner's address and distribution ratios
    mapping(bytes32 => ReferralInfo) private referralInfos;

    mapping(address => bytes32) private userReferralCode;

    mapping(address => bytes32[]) private userCreatedCodes;

    /**
     * @notice Get the referral codes created by a user
     * @param user The user address
     * @return The referral codes created by the user
     */
    function getReferralCodesByUser(address user) external view returns (bytes32[] memory) {
        return userCreatedCodes[user];
    }

    /**
     * @notice Set a referral code for a user
     * @dev This function can only be called by a trade contract
     * @param referralCode The referral code
     * @param user The user address
     */
    function setReferralCodeAsTC(bytes32 referralCode, address user) external onlyTradeContracts(msg.sender) {
        if(user == address(0)){
            revert ZeroAddress();
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
     * @param _keepers Keepers Contract Address
     */
    function changeContracts(address _factory, address _keepers) external {
        if(!keepers.isCouncil(msg.sender)){
            revert Unauthorized("Only council can change contracts");
        }
        if(_factory == address(0)){
            revert ZeroAddress();
        }
        if(_keepers == address(0)){
            revert ZeroAddress();
        }
        factory = ITradeFactory(_factory);
        keepers = IKeepers(_keepers);
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
     * @notice Set the referral code of a user
     * @dev Private function to set the referral code of a user
     * @param referralCode The referral code
     * @param user The user address
     */
    function _setReferralCode(bytes32 referralCode, address user) private {
        userReferralCode[user] = referralCode;
    }
    

    // Event to be emitted when a referral code is registered
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

    /**
     * @notice Emit event when a referral code is registered
     * @dev This function can only be called by a trade contract
     * @param contractAddress The trade contract address
     * @param _paymentToken The payment token address
     * @param referralCode The referral code
     * @param rebate The rebate amount
     */
    function emitReferralCodeRebateUpdated(
        address contractAddress,
        address _paymentToken,
        bytes32 referralCode,
        uint256 rebate
    ) external onlyTradeContracts(contractAddress) {        
        rebatePerCodePerPaymentToken[referralCode][_paymentToken] += rebate;
        address owner = referralInfos[referralCode].owner;
        emit ReferralCodeRebateUpdated(contractAddress, referralCode, owner, _paymentToken, rebate);
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
