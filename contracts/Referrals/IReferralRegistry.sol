// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IReferralRegistry {
    struct ReferralInfo {
        address owner;
        uint256 ownerRatio;
        uint256 buyerRatio;
    }

    event ReferralCodeRegistered(
        bytes32 indexed referralCode,
        address indexed owner,
        uint256 ownerRatio,
        uint256 buyerRatio
    );

    function emitReferralCodeRegistered(
        bytes32 referralCode,
        address owner,
        uint256 ownerRatio,
        uint256 buyerRatio
    ) external;

    function registerReferralCode(
        bytes32 referralCode,
        uint256 ownerRatio,
        uint256 buyerRatio
    ) external;

    function getReferralInfo(
        bytes32 referralCode
    ) external view returns (ReferralInfo memory);

    function getReferralCodeOwner(
        bytes32 referralCode
    ) external view returns (address);

    function getReferralCodeRatios(
        bytes32 referralCode
    ) external view returns (uint256 ownerRatio, uint256 buyerRatio);

    function isReferralCodeRegistered(
        bytes32 referralCode
    ) external view returns (bool);

     function calculateNetValue(
        uint256 transactionValue,
        bool isBuyerAffiliated,
        uint256 baseFeePercent,
        uint256 discountRatio // Ratio between the discount and rebate percentages
    )
        external
        pure
        returns (
            uint256 buyerNetValue, // Net value for the buyer
            uint256 affililatorRebate, // Rebate for the affililator
            uint256 holdersAmount, // Remaining amount for token holders
            uint256 discountedFee // Discounted fee for the buyer if they are affiliated
        );
}
