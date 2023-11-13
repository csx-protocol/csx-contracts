// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

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
    /**
     * @notice Calculates the net value for each party involved in a transaction
     * @param fullItemPrice The full item price in tokens
     * @param isBuyerAffiliated Whether the buyer is affiliated or not
     * @param baseFeePercentTen The base fee percentage multiplied by 10. e.g., 26 represents 2.6%
     * @param discountRatio The ratio between the discount and reward percentages
     * @return buyerNetPrice 
     * @return sellerNetProceeds 
     * @return affiliatorNetReward 
     * @return tokenHoldersNetReward 
     */
    function calculateNetValue(
        uint256 fullItemPrice,
        bool isBuyerAffiliated,
        uint256 baseFeePercentTen, // Now the base fee can have one decimal. e.g., 26 represents 2.6%
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
        uint256 baseFee = (fullItemPrice * baseFeePercentTen) / 1000; // divide by 1000 instead of 100

        uint256 discountedFee;
        // Calculate the discounted fee and affiliator reward if the buyer is affiliated
        if (isBuyerAffiliated) {
            discountedFee = (fullItemPrice * baseFeePercentTen * discountRatio) / 100000; // divide by 100000 instead of 10000
            affiliatorNetReward = (fullItemPrice * baseFeePercentTen * (50 - discountRatio)) / 100000; // divide by 100000 instead of 10000
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
