// SPDX-License-Identifier: ISC

pragma solidity 0.8.19;

import "../Trade/Trade.sol";
import {Strings} from "../utils/Strings.sol";
import "../Users/IUsers.sol";

import {IReferralRegistry} from "../Referrals/IReferralRegistry.sol";

struct Sticker {
    string name;
    string material;
    uint8 slot;
    string imageLink;
}

// struct FloatInfo {
//     string value;
//     string min;
//     string max;
// }

struct SkinInfo {
    string floatValues; // "[0.00, 0.00, 0.000000]" (max, min, value)
    uint256 paintSeed; // ranging from 1 to 1000, determines the unique pattern of a skin, such as the placement of the artwork, wear, and color distribution.
    uint256 paintIndex; // Paint index is a fixed value for each skin and does not change across different instances of the same skin. Ex. the AWP Dragon Lore has a paint index of 344. 
}

struct TradeUrl {
    uint256 partner;
    string token;
}

enum PriceType {
    WETH,
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
    SkinInfo skinInfo;
    TradeStatus status;
    Sticker[] stickers;
    string weaponType;
    PriceType priceType;
}

interface ITradeFactory {
    // Trade Contract
    function removeAssetIdUsed(string memory _assetId, address sellerAddrss) external returns (bool);

    function onStatusChange(TradeStatus status, string memory data, address sellerAddress, address buyerAddress) external;

    //Users
    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool);

    function getTradeDetailsByAddress(address tradeAddrs)
        external
        view
        returns (TradeInfo memory result);

    
    function baseFee() external view returns (uint256);

    function totalContracts() external view returns (uint256);
}

