// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// The NetValueCalculator contract calculates the net value for each party involved in a transaction:
// the buyer, the affiliator, and the token holders.
contract NetValueCalculator {
    // The calculateNetValue function calculates the net value for each party involved in a transaction
    // based on the transaction value, whether the buyer is affiliated, the base fee percentage, and the ratio between the discount
    // and rebate percentages.
    //
    // Example:
    // --------
    // Assuming the following input values:
    // - transactionValue = 1,000 tokens
    // - isBuyerAffiliated = true
    // - baseFeePercent = 2
    // - discountRatio = 10
    //
    // Steps:
    // 1. Calculate the base fee:
    //    - baseFee = (transactionValue * baseFeePercent) / 100
    //    - baseFee = (1,000 * 2) / 100 = 20 tokens
    //
    // 2. Calculate the discounted fee and affiliator rebate:
    //    - discountedFee = (baseFee * discountRatio) / 100
    //    - discountedFee = (20 * 10) / 100 = 2 tokens
    //    - affiliatorRebate = (baseFee * (50 - discountRatio)) / 100
    //    - affiliatorRebate = (20 * (50 - 10)) / 100 = 8 tokens
    //
    // 3. Calculate the net value for the buyer, the affiliator, and the token holders:
    //    - buyerNetValue = transactionValue - baseFee + discountedFee
    //    - buyerNetValue = 1,000 - 20 + 2 = 982 tokens
    //    - holdersAmount = baseFee - discountedFee - affiliatorRebate
    //    - holdersAmount = 20 - 2 - 8 = 10 tokens
    //
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
            uint256 affiliatorRebate, // Rebate for the affiliator
            uint256 holdersAmount, // Remaining amount for token holders
            uint256 discountedFee // Discounted fee for the buyer if they are affiliated
        )
    {
        require(discountRatio <= 50, "Invalid discount ratio");

        // Calculate the base fee
        uint256 baseFee = (transactionValue * baseFeePercent) / 100;

        // Calculate the discounted fee and affiliator rebate if the buyer is affiliated
        if (isBuyerAffiliated) {
            discountedFee = (baseFee * discountRatio) / 100;
            affiliatorRebate = (baseFee * (50 - discountRatio)) / 100;
        } else {
            discountedFee = 0;
            affiliatorRebate = 0;
        }

        // Calculate the total fee, net value for the buyer, and the remaining amount for token holders
        uint256 totalFee = baseFee - discountedFee - affiliatorRebate;

        // Calculate the net value for the buyer by subtracting the total fee from the transaction value
        buyerNetValue = transactionValue - totalFee;

        // Calculate the remaining amount for token holders by subtracting the discounted fee and affiliator rebate from the base fee
        holdersAmount = baseFee - discountedFee - affiliatorRebate;
    }
}
