// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

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

    function emitReferralCodeRebateUpdated(
        address contractAddress,
        address _paymentToken,
        bytes32 referralCode,
        uint256 rebate
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
        uint256 fullItemPrice,
        bool isBuyerAffiliated,
        uint256 baseFeePercent,
        uint256 discountRatio // Ratio between the discount and reward percentages
    )
        external
        pure
        returns (
            uint256 buyerNetPrice, // Net price for the buyer
            uint256 sellerNetProceeds, // Net proceeds for the seller
            uint256 affiliatorNetReward, // Net reward for the affiliator
            uint256 tokenHoldersNetReward // Net reward for token holders
        );

    function setReferralCodeAsTC(bytes32 referralCode, address user) external;

    function getReferralCode(address user) external view returns (bytes32);
}
