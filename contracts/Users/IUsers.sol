// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
enum TradeStatus {
    Pending,
    SellerCancelled,
    Committed,
    Accepted,
    Completed,
    Disputed,
    Resolved,
    Clawbacked
}

enum Role {
    BUYER,
    SELLER
}

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
}