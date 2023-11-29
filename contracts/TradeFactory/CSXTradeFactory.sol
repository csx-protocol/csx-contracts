// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

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

    /**
     * @notice Constructor
     * @param _keepers Keepers contract address
     * @param _users Users contract address
     * @param _tradeFactoryBaseStorage TradeFactoryBaseStorage contract address
     * @param _baseFee Base fee for creating a trade contract (once decimal of precision e.g 1 = 0.1%)
     * @param _paymentTokens Payment tokens addresses
     * @param _referralRegistryAddress Referral registry address
     * @param _sCSXTokenAddress Staked CSX token address
     * @param _buyAssistoor BuyAssistoor contract address
     */
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

    /**
     * @notice List an item for sale
     * @dev Creates a new trade contract
     * @param params Listing params
     */
    function createListingContract(
        ListingParams memory params
    ) external nonReentrant {
        if (usersContract.isBanned(msg.sender)) {
            revert UserBanned();
        }
        if (
            usersContract.hasAlreadyListedItem(params.assetId, msg.sender)
        ) {
            revert AssetIDAlreadyExists();
        }
        if (params.priceType != PriceType.WETH) {
            if (params.priceType != PriceType.USDC) {
                if (params.priceType != PriceType.USDT) {
                    revert InvalidPriceType();
                }
            }
        }
        if(params.weiPrice == 0) {
            revert InvalidPriceType();
        }

        ++tradeCountByStatus[TradeStatus.ForSale];

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

        uint256 _tContracts = tradeFactoryBaseStorage.totalContracts();
        address newAddress = tradeFactoryBaseStorage
            .getLastTradeContractAddress();
        
        isTradeContract[newAddress] = true;

        contractAddressToIndex[newAddress] = _tContracts - 1;

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

    /**
     * @notice Change the contracts for trade
     * @dev This function is used when the contracts for trade are upgraded
     * @dev This function can only be called by a council member
     * @param _paymentTokens Payment token type
     * @param _referralRegistryAddress Referral registry address
     * @param _sCSXTokenAddress Staked CSX token address
     * @param _buyAssistoor BuyAssistoor contract address
     */
    function changeContractsForTrade(
        PaymentTokens memory _paymentTokens,
        address _referralRegistryAddress,
        address _sCSXTokenAddress,
        address _buyAssistoor
    ) external isCouncil {
        paymentTokens = _paymentTokens;
        referralRegistryAddress = _referralRegistryAddress;
        sCSXTokenAddress = _sCSXTokenAddress;
        buyAssistoor = _buyAssistoor;
    }

    /**
     * @notice Get Trade Details by Index
     * @param index Index of the trade contract
     * @return result TradeInfo
     */
    function getTradeDetailsByIndex(
        uint256 index
    ) public view returns (TradeInfo memory result) {
        uint256 i = index;
        CSXTrade _contract = tradeFactoryBaseStorage.getTradeContractByIndex(i);

        result.contractAddress = address(_contract);
        result.seller = _contract.SELLER_ADDRESS();
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

        for (uint256 y; y < lengthOfStickersArray; y++) {
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

    /**
     * @notice Get Trade Details by Address
     * @param tradeAddrs Address of the trade contract
     * @return result TradeInfo
     */
    function getTradeDetailsByAddress(
        address tradeAddrs
    ) external view returns (TradeInfo memory result) {
        uint256 i = contractAddressToIndex[tradeAddrs];
        result = getTradeDetailsByIndex(i);
    }

    /**
     * @notice Get Trade Details by Address
     * @param status Status of the trade contract
     * @param indexFrom Index from which to start
     * @param maxResults Max results to return
     */
    function getTradeIndexesByStatus(
        TradeStatus status,
        uint256 indexFrom,
        uint256 maxResults
    ) external view returns (TradeIndex[] memory) {
        TradeIndex[] memory tradeIndexes = new TradeIndex[](maxResults);
        uint256 resultIndex;
        uint256 i = indexFrom;
        uint256 _tC = tradeFactoryBaseStorage.totalContracts();
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
}
