// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "../Trade/Trade.sol";
import "../utils/Strings.sol";
import "../Users/IUsers.sol";

struct Sticker {
    string name;
    string material;
    uint8 slot;
    string imageLink;
}

struct FloatInfo {
    string value;
    string min;
    string max;
}

struct TradeUrl {
    uint256 partner;
    string token;
}

enum PriceType {
    ETHER,
    USDC,
    USDT
}

struct UserInteraction {
    //uint256 contractIndex;
    address contractAddress;
    Role role;
    TradeStatus status;
}

struct TradeInfo {
    address contractAddress;
    address seller;
    TradeUrl sellerTradeUrl;
    address buyer;
    TradeUrl buyerTradeUrl;
    string itemMarketName;
    string inspectLink;
    string itemImageUrl;
    uint256 weiPrice;
    uint256 averageSellerDeliveryTime;
    FloatInfo float;
    TradeStatus status;
    Sticker[] stickers;
    string weaponType;
}

interface ITradeFactory {
    // Trade Contract
    function removeAssetIdUsed(string memory _assetId, address sellerAddrss) external returns (bool);

    function onStatusChange(TradeStatus status, string memory data) external;

    //Users
    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool);

    function getTradeDetailsByAddress(address tradeAddrs)
        external
        view
        returns (TradeInfo memory result);
}
