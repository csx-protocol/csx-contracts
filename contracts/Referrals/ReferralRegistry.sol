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

    struct ReferralInfo {
        address owner;
        uint256 ownerRatio;
        uint256 buyerRatio;
        uint256 rebate;
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
        uint256 rebate
    );

    // Function only for isTradeContract to emit if refferal transaction is made
    function emitReferralCodeRebateUpdated(
        address contractAddress,
        bytes32 referralCode,
        address owner,
        uint256 rebate
    ) external onlyTradeContracts(contractAddress) {
        emit ReferralCodeRebateUpdated(contractAddress, referralCode, owner, rebate);
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
            buyerRatio: buyerRatio,
            rebate: 0
        });

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
    ) external view returns (address) {
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
