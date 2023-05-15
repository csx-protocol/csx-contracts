// SPDX-License-Identifier: ISC

pragma solidity 0.8.19;
// enum TradeStatus {
//     Pending,
//     SellerCancelled,
//     Committed,
//     Accepted,
//     Completed,
//     Disputed,
//     Resolved,
//     Clawbacked
// }

enum TradeStatus {
    ForSale, // Seller Lists Item
    SellerCancelled, // Seller Cancels Item
    BuyerCommitted, // Buyer Commits coins to Buy
    BuyerCancelled, // Buyer Cancels Commitment
    SellerCommitted, // Seller Commits to Sell
    SellerCancelledAfterBuyerCommitted, // Seller Cancels After Buyer Commits (refunds buyer)
    Completed, // Trade Completed
    Disputed, // Trade Disputed
    Resolved, // Trade Resolved
    Clawbacked // Trade Clawbacked
}

enum Role {
    BUYER,
    SELLER
}

import {PriceType} from "../TradeFactory/ITradeFactory.sol";

interface IUsers {
    function warnUser(address _user) external;

    function banUser(address _user) external;

    function isBanned(address user) external view returns (bool);

    function repAfterTrade(address _user, bool isPositive) external;

    function startDeliveryTimer(address contractAddress, address user) external;

    function endDeliveryTimer(address contractAddress, address user) external;

    function getAverageDeliveryTime(address user) external view returns (uint256);

    function addUserInteractionStatus(address tradeAddress, Role role,  address userAddress, TradeStatus status) external;

    function changeUserInteractionStatus(address tradeAddress, address userAddress, TradeStatus status) external;

    function emitNewTrade(address seller, address buyer, bytes32 refCode, PriceType priceType, uint256 value) external;
}