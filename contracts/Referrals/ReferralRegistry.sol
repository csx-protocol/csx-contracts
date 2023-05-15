// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {NetValueCalculator} from "./NetValueCalculator.sol";
import {ITradeFactory} from "../TradeFactory/ITradeFactory.sol";

contract ReferralRegistry is NetValueCalculator {
    ITradeFactory public factory;
 
    bool init;
    address migrator;

    //NetValueCalculator()
    constructor() {
        migrator = msg.sender;
    }

    function initFactory(address _factory) external {
        require(msg.sender == migrator);
        require(!init);
        init = true;
        factory = ITradeFactory(_factory);
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
        require(
            msg.sender == contractAddress &&
                factory.isThisTradeContract(contractAddress),
            "not trade contract"
        );
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
        require(referralCode != 0, "Referral code cannot be empty.");
        require(
            referralInfos[referralCode].owner != address(0),
            "Referral code not registered."
        );
        require(
            referralInfos[referralCode].owner != msg.sender, 
            "owner of referral code."
        );
        require(
            userReferralCode[msg.sender] != referralCode,
            "Referral code already set."
        );
        require(
            !containsSpace(referralCode),
            "Referral code cannot contain spaces."
        );
        _setReferralCode(referralCode, msg.sender);
    }

    function getReferralCode(address user) external view returns (bytes32) {
        return userReferralCode[user];
    }

    function _setReferralCode(bytes32 referralCode, address user) private {
        // TODO MOVED
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
        require(referralCode != 0, "Referral code cannot be empty.");
        require(
            referralInfos[referralCode].owner == address(0),
            "Referral code already registered."
        );
        require(
            ownerRatio + buyerRatio == 100,
            "The sum of ownerRatio and buyerRatio must be 100."
        );
        require(
            !containsSpace(referralCode),
            "Referral code cannot contain spaces."
        );

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
