// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {NetValueCalculator} from "./NetValueCalculator.sol";
import {ITradeFactory} from "../TradeFactory/ITradeFactory.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";

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
        keepers = IKeepers(_keepers);
    }

    mapping(bytes32 => mapping(address => uint256)) rebatePerCodePerPaymentToken;

    function getRebatePerCodePerPaymentToken(bytes32 referralCode, address paymentToken) external view returns (uint256) {
        return rebatePerCodePerPaymentToken[referralCode][paymentToken];
    }

    struct ReferralInfo {
        address owner;
        uint256 ownerRatio;
        uint256 buyerRatio;        
    }

    modifier onlyTradeContracts(address contractAddress) {
        if (!(msg.sender == contractAddress && factory.isThisTradeContract(contractAddress))) {
            revert NotTradeContract();
        }
        _;
    }

    // Map to store referral codes with corresponding owner's address and distribution ratios
    mapping(bytes32 => ReferralInfo) private referralInfos;

    mapping(address => bytes32) private userReferralCode;

    mapping(address => bytes32[]) private userCreatedCodes;

    function getReferralCodesByUser(address user) external view returns (bytes32[] memory) {
        return userCreatedCodes[user];
    }

    function setReferralCodeAsTC(bytes32 referralCode, address user) external onlyTradeContracts(msg.sender) {
        _setReferralCode(referralCode, user);
    }

    function setReferralCodeAsUser(bytes32 referralCode) external {
        if (referralCode == 0) revert InvalidReferralCode("Referral code cannot be empty");
        if (referralInfos[referralCode].owner == address(0)) revert ReferralCodeNotRegistered("Referral code not registered");
        if (referralInfos[referralCode].owner == msg.sender) revert OwnerOfReferralCode("You are the owner of this referral code");
        if (userReferralCode[msg.sender] == referralCode) revert ReferralCodeAlreadySet("Referral code already set for this user");
        if (containsSpace(referralCode)) revert InvalidReferralCode("Referral code cannot contain spaces");

        _setReferralCode(referralCode, msg.sender);
    }

    function changeContracts(address _factory, address _keepers) external {
        if(!keepers.isCouncil(msg.sender)){
            revert Unauthorized("Only council can change contracts");
        }
        factory = ITradeFactory(_factory);
        keepers = IKeepers(_keepers);
    }

    function getReferralCode(address user) external view returns (bytes32) {
        return userReferralCode[user];
    }

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

    // Function only for isTradeContract to emit if refferal transaction is made
    function emitReferralCodeRebateUpdated(
        address contractAddress,
        address _paymentToken,
        bytes32 referralCode,
        uint256 rebate
    ) external onlyTradeContracts(contractAddress) {        
        rebatePerCodePerPaymentToken[referralCode][_paymentToken] += rebate;
        address owner = getReferralCodeOwner(referralCode);
        emit ReferralCodeRebateUpdated(contractAddress, referralCode, owner, _paymentToken, rebate);
    }

    // Function to register a referral code with distribution ratios
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

    // Function to get the the RefferalInfo struct of a referral code
    function getReferralInfo(
        bytes32 referralCode
    ) external view returns (ReferralInfo memory) {
        return referralInfos[referralCode];
    }

    // Function to check the owner of a referral code
    function getReferralCodeOwner(
        bytes32 referralCode
    ) public view returns (address) {
        return referralInfos[referralCode].owner;
    }

    // Function to get the distribution ratios of a referral code
    function getReferralCodeRatios(
        bytes32 referralCode
    ) external view returns (uint256 ownerRatio, uint256 buyerRatio) {
        return (
            referralInfos[referralCode].ownerRatio,
            referralInfos[referralCode].buyerRatio
        );
    }

    // Function to check if a referral code is registered
    function isReferralCodeRegistered(
        bytes32 referralCode
    ) external view returns (bool) {
        return referralInfos[referralCode].owner != address(0);
    }

    // Helper function to check if a referral code contains spaces
    function containsSpace(bytes32 code) private pure returns (bool) {
        for (uint256 i = 0; i < 32; i++) {
            if (code[i] == 0x20) {
                return true;
            }
        }
        return false;
    }
}
