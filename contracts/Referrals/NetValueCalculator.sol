// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error InvalidDiscountRatio(uint256 provided, uint256 max);

// The NetValueCalculator contract calculates the net value for each party involved in a transaction:
// the buyer, the seller, the affiliator, and the token holders.
contract NetValueCalculator {
    // The calculateNetValue function calculates the net value for each party involved in a transaction
    // based on the full item price, whether the buyer is affiliated, the base fee percentage, and the ratio between the discount
    // and rebate percentages.
    //
    // Example:
    // --------
    // Assuming the following input values:
    // - fullItemPrice = 1,000 tokens
    // - isBuyerAffiliated = true
    // - baseFeePercent = 2
    // - discountRatio = 10
    //
    // Steps:
    // 1. Calculate the base fee:
    //    - baseFee = (fullItemPrice * baseFeePercent) / 100
    //    - baseFee = (1,000 * 2) / 100 = 20 tokens
    //
    // 2. Calculate the discounted fee and affiliator reward:
    //    - discountedFee = (baseFee * discountRatio) / 100
    //    - discountedFee = (20 * 10) / 100 = 2 tokens
    //    - affiliatorReward = (baseFee * (50 - discountRatio)) / 100
    //    - affiliatorReward = (20 * (50 - 10)) / 100 = 8 tokens
    //
    // 3. Calculate the net value for the buyer, the seller, the affiliator, and the token holders:
    //    - buyerNetPrice = fullItemPrice - discountedFee
    //    - buyerNetPrice = 1,000 - 2 = 998 tokens
    //    - sellerNetProceeds = fullItemPrice - baseFee
    //    - sellerNetProceeds = 1,000 - 20 = 980 tokens
    //    - tokenHoldersNetReward = baseFee - discountedFee - affiliatorReward
    //    - tokenHoldersNetReward = 20 - 2 - 8 = 10 tokens
    //
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
        )
    {
        if (discountRatio > 50) {
            revert InvalidDiscountRatio(discountRatio, 50);
        }

        // Calculate the base fee
        uint256 baseFee = (fullItemPrice * baseFeePercent) / 100;

        uint256 discountedFee;
        // Calculate the discounted fee and affiliator reward if the buyer is affiliated
        if (isBuyerAffiliated) {
            discountedFee = (baseFee * discountRatio) / 100;
            affiliatorNetReward = (baseFee * (50 - discountRatio)) / 100;
        } else {
            discountedFee = 0;
            affiliatorNetReward = 0;
        }

        // Calculate the buyer net price
        buyerNetPrice = fullItemPrice - discountedFee;

        // Calculate the seller net proceeds
        sellerNetProceeds = fullItemPrice - baseFee;
        // Calculate the token holders net reward
        tokenHoldersNetReward = baseFee - discountedFee - affiliatorNetReward;
    }
}
