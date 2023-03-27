// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "./TradeFactoryBase.sol";

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
    string sellerAddress;
}

contract SMTradeFactory is TradeFactoryBase {
    constructor(
        address _keepers,
        address _users,
        address _tradeFactoryBaseStorage
    ) TradeFactoryBase(_keepers, _users, _tradeFactoryBaseStorage) {}

    function createListingContract(
        string memory _itemMarketName,
        TradeUrl memory _tradeUrl,
        string memory _assetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        uint256 _weiPrice,
        FloatInfo memory _float,
        Sticker[] memory _stickers,
        string memory _weaponType
    ) external nonReentrant {
        require(usersContract.isBanned(msg.sender) == false, "bnd");
        require(
            assetIdFromUserAddrssToTradeAddrss[_assetId][msg.sender] ==
                address(0),
            "id"
        );
        // tradeContracts[totalContracts] = new SMTrade(
        //     address(this),
        //     address(keepersContract),
        //     address(usersContract),
        //     msg.sender,
        //     _weiPrice,
        //     _itemMarketName,
        //     _tradeUrl,
        //     _assetId,
        //     _inspectLink,
        //     _itemImageUrl,
        //     _float
        // );
        //++totalContracts;

        tradeFactoryBaseStorage.newTradeContract(
            _itemMarketName,
            _tradeUrl,
            _assetId,
            _inspectLink,
            _itemImageUrl,
            _weiPrice,
            _float
        );       

        //address newAddress = address(tradeContracts[totalContracts - 1]);
        address newAddress = tradeFactoryBaseStorage.getLastTradeContractAddress();

        uint256 totalContracts = tradeFactoryBaseStorage.totalContracts();

        isTradeContract[newAddress] = true;

        SMTrade _contract = tradeFactoryBaseStorage.getTradeContractByIndex(totalContracts - 1);

        _contract.initExtraInfo(
            _stickers,
            _weaponType
        );        

        contractAddressToIndex[newAddress] = totalContracts - 1;
        assetIdFromUserAddrssToTradeAddrss[_assetId][msg.sender] = newAddress;

        ExtraTest memory _extraTest;

        _extraTest.tradeUrlPartner = Strings.toString(_tradeUrl.partner);
        _extraTest.weiPriceStringed = Strings.toString(_weiPrice);
        _extraTest.sellerAddress = Strings.toHexString(msg.sender);

        string memory data = string(
            abi.encodePacked(
                _itemMarketName,
                "||",
                _assetId,
                "||",
                _extraTest.tradeUrlPartner,
                "+",
                _tradeUrl.token,
                "||",
                _float.value,
                "||",
                _extraTest.weiPriceStringed,
                "||",
                _extraTest.sellerAddress
            )
        );
        emit TradeContractStatusChange(newAddress, TradeStatus.Pending, data);
    }

    function getTradeDetailsByIndex(
        uint256 index
    ) public view returns (TradeInfo memory result) {
        uint256 i = index;
        //SMTrade _contract = tradeContracts[i];
        SMTrade _contract = tradeFactoryBaseStorage.getTradeContractByIndex(i);

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
        FloatInfo memory _float;
        (_float.value, _float.min, _float.max) = _contract.float();
        result.float = _float;
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
        uint256 totalContracts = tradeFactoryBaseStorage.totalContracts();
        while (resultIndex < maxResults && i < totalContracts) {
            TradeInfo memory _trade = getTradeDetailsByIndex(i);

            if (_trade.status == status) {
                tradeIndexes[resultIndex].index = i;
                tradeIndexes[resultIndex].weiPrice = _trade.weiPrice;
                tradeIndexes[resultIndex].priceType = PriceType.ETHER;
                tradeIndexes[resultIndex].weaponType = _trade.weaponType;
                tradeIndexes[resultIndex].itemMarketName = _trade.itemMarketName;
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
        uint256 totalContracts = tradeFactoryBaseStorage.totalContracts();
        while (i < totalContracts) {
            TradeInfo memory _trade = getTradeDetailsByIndex(i);
            if (_trade.status == status) {
                ++count;
            }
            ++i;
        }
        return count;
    }
}
