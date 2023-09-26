// //SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import {CSXTrade, PriceType, TradeUrl, SkinInfo, Sticker} from "../Trade/CSXTrade.sol";
import {TradeFactoryBase, TradeInfo, TradeStatus, Strings} from "./TradeFactoryBase.sol";

struct TradeIndex {
    uint256 index;
    uint256 weiPrice;
    PriceType priceType;
    string weaponType;
    string itemMarketName;
    uint256 nextIndex;
}

struct ExtraTest {
    string tradeUrlPartner;
    string weiPriceStringed;
}

struct ListingParams {
    string itemMarketName;
    TradeUrl tradeUrl;
    string assetId;
    string inspectLink;
    string itemImageUrl;
    uint256 weiPrice;
    SkinInfo skinInfo;
    Sticker[] stickers;
    string weaponType;
    PriceType priceType;
}

struct PaymentTokens {
    address weth;
    address usdc;
    address usdt;
}

error UserBanned();
error AssetIDAlreadyExists();
error InvalidPriceType();
error NoTradeCreated();
error InvalidAddress(address _address);

contract CSXTradeFactory is TradeFactoryBase {
    PaymentTokens public paymentTokens;
    address public referralRegistryAddress;
    address public sCSXTokenAddress;
    address public buyAssistoor;

    constructor(
        address _keepers,
        address _users,
        address _tradeFactoryBaseStorage,
        uint256 _baseFee,
        PaymentTokens memory _paymentTokens,
        address _referralRegistryAddress,
        address _sCSXTokenAddress,
        address _buyAssistoor
    ) TradeFactoryBase(_keepers, _users, _tradeFactoryBaseStorage, _baseFee) {
        if(_referralRegistryAddress == address(0)) {
            revert InvalidAddress(_referralRegistryAddress);
        }
        if(_sCSXTokenAddress == address(0)) {
            revert InvalidAddress(_sCSXTokenAddress);
        }
        if(_buyAssistoor == address(0)) {
            revert InvalidAddress(_buyAssistoor);
        }
        paymentTokens = _paymentTokens;
        referralRegistryAddress = _referralRegistryAddress;
        sCSXTokenAddress = _sCSXTokenAddress;
        buyAssistoor = _buyAssistoor;
    }

    function createListingContract(
        ListingParams memory params
    ) external nonReentrant {
        if (usersContract.isBanned(msg.sender)) {
            revert UserBanned();
        }
        if (
            // assetIdFromUserAddrssToTradeAddrss[params.assetId][msg.sender] !=
            // address(0)
            usersContract.hasAlreadyListedItem(params.assetId, msg.sender)
        ) {
            revert AssetIDAlreadyExists();
        }
        if (
            params.priceType != PriceType.WETH &&
            params.priceType != PriceType.USDC &&
            params.priceType != PriceType.USDT
        ) {
            revert InvalidPriceType();
        }

        bool nS = tradeFactoryBaseStorage.newTradeContract(
            params.itemMarketName,
            params.tradeUrl,
            params.assetId,
            params.inspectLink,
            params.itemImageUrl,
            params.weiPrice,
            params.skinInfo
        );

        if (!nS) {
            revert NoTradeCreated();
        }

        uint _tContracts = totalContracts();
        address newAddress = tradeFactoryBaseStorage
            .getLastTradeContractAddress();
        
        isTradeContract[newAddress] = true;

        contractAddressToIndex[newAddress] = _tContracts - 1;
        // assetIdFromUserAddrssToTradeAddrss[params.assetId][
        //     msg.sender
        // ] = newAddress;
        usersContract.setAssetIdUsed(params.assetId, msg.sender, newAddress);

        CSXTrade _contract = tradeFactoryBaseStorage.getTradeContractByIndex(
            _tContracts - 1
        );

        if (params.priceType == PriceType.WETH) {
            _contract.initExtraInfo(
                params.stickers,
                params.weaponType,
                paymentTokens.weth,
                params.priceType,
                referralRegistryAddress,
                sCSXTokenAddress
            );
        } else if (params.priceType == PriceType.USDC) {
            _contract.initExtraInfo(
                params.stickers,
                params.weaponType,
                paymentTokens.usdc,
                params.priceType,
                referralRegistryAddress,
                sCSXTokenAddress
            );
        } else if (params.priceType == PriceType.USDT) {
            _contract.initExtraInfo(
                params.stickers,
                params.weaponType,
                paymentTokens.usdt,
                params.priceType,
                referralRegistryAddress,
                sCSXTokenAddress
            );
        }

        ExtraTest memory _extraTest;
        _extraTest.tradeUrlPartner = Strings.toString(params.tradeUrl.partner);
        _extraTest.weiPriceStringed = Strings.toString(params.weiPrice);
        string memory data = string(
            abi.encodePacked(
                params.itemMarketName,
                "||",
                params.assetId,
                "||",
                _extraTest.tradeUrlPartner,
                "+",
                params.tradeUrl.token,
                "||",
                params.skinInfo.floatValues,
                "||",
                _extraTest.weiPriceStringed
            )
        );

        emit TradeContractStatusChange(
            newAddress,
            TradeStatus.ForSale,
            data,
            msg.sender,
            address(0)
        );
    }

    function getTradeDetailsByIndex(
        uint256 index
    ) public view returns (TradeInfo memory result) {
        uint256 i = index;
        CSXTrade _contract = tradeFactoryBaseStorage.getTradeContractByIndex(i);

        result.contractAddress = address(_contract);
        result.seller = _contract.seller();
        result.buyer = _contract.buyer();
        result.itemMarketName = _contract.itemMarketName();
        result.inspectLink = _contract.inspectLink();

        TradeUrl memory _sTradeUrl;
        (_sTradeUrl.partner, _sTradeUrl.token) = _contract.sellerTradeUrl();
        result.sellerTradeUrl = _sTradeUrl;

        TradeUrl memory _bTradeUrl;
        (_bTradeUrl.partner, _bTradeUrl.token) = _contract.buyerTradeUrl();
        result.buyerTradeUrl = _bTradeUrl;

        result.weiPrice = _contract.weiPrice();
        result.itemImageUrl = _contract.itemImageUrl();
        result.averageSellerDeliveryTime = usersContract.getAverageDeliveryTime(
            result.seller
        );
        SkinInfo memory _skinInfo;
        (
            _skinInfo.floatValues,
            _skinInfo.paintSeed,
            _skinInfo.paintIndex
        ) = _contract.skinInfo();
        result.skinInfo = _skinInfo;
        result.status = _contract.status();

        uint256 lengthOfStickersArray = _contract.stickerLength();
        Sticker[] memory _stickers = new Sticker[](lengthOfStickersArray);

        for (uint256 y = 0; y < _stickers.length; y++) {
            (
                _stickers[y].name,
                _stickers[y].material,
                _stickers[y].slot,
                _stickers[y].imageLink
            ) = _contract.stickers(y);
        }
        result.stickers = _stickers;

        result.weaponType = _contract.weaponType();

        result.priceType = _contract.priceType();

        result.assetId = _contract.itemSellerAssetId();

        return result;
    }

    function getTradeDetailsByAddress(
        address tradeAddrs
    ) public view returns (TradeInfo memory result) {
        uint256 i = contractAddressToIndex[tradeAddrs];
        result = getTradeDetailsByIndex(i);
    }

    function getTradeIndexesByStatus(
        TradeStatus status,
        uint256 indexFrom,
        uint256 maxResults
    ) external view returns (TradeIndex[] memory) {
        TradeIndex[] memory tradeIndexes = new TradeIndex[](maxResults);
        uint256 resultIndex;
        uint256 i = indexFrom;
        uint256 _tC = totalContracts();
        while (resultIndex < maxResults && i < _tC) {
            TradeInfo memory _trade = getTradeDetailsByIndex(i);

            if (_trade.status == status) {
                tradeIndexes[resultIndex].index = i;
                tradeIndexes[resultIndex].weiPrice = _trade.weiPrice;
                tradeIndexes[resultIndex].priceType = _trade.priceType;
                tradeIndexes[resultIndex].weaponType = _trade.weaponType;
                tradeIndexes[resultIndex].itemMarketName = _trade
                    .itemMarketName;
                tradeIndexes[resultIndex].nextIndex = i + 1;
                ++resultIndex;
            }

            ++i;
        }
        return tradeIndexes;
    }

    function getTradeCountByStatus(
        TradeStatus status
    ) external view returns (uint256) {
        uint256 count;
        uint256 i = 0;
        uint256 _tC = totalContracts();
        while (i < _tC) {
            TradeInfo memory _trade = getTradeDetailsByIndex(i);
            if (_trade.status == status) {
                ++count;
            }
            ++i;
        }
        return count;
    }
}
