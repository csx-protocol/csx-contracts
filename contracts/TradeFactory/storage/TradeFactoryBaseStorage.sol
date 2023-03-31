// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "./ITradeFactoryBaseStorage.sol";

contract TradeFactoryBaseStorage is ReentrancyGuard {
    uint256 public totalContracts;
    mapping(uint256 => CSXTrade) tradeContracts;
    IKeepers public keepersContract;
    IUsers public usersContract;
    address factoryAddress;
    bool hasInit;

    constructor(address _keepers, address _users) {
        // TODO
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
    }

    function init(address _factoryAddress) external {
        require(keepersContract.isCouncil(msg.sender));
        require(!hasInit, "init");
        hasInit = true;
        factoryAddress = _factoryAddress;
    }

    function getTradeContract(uint256 index) external view returns (CSXTrade) {
        return tradeContracts[index];
    }

    function newTradeContract(
        string memory _itemMarketName,
        TradeUrl memory _tradeUrl,
        string memory _assetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        uint256 _weiPrice,
        FloatInfo memory _float
    ) external nonReentrant {
        require(factoryAddress == msg.sender, "!fact");
        tradeContracts[totalContracts] = new CSXTrade(
            address(msg.sender),
            address(keepersContract),
            address(usersContract),
            tx.origin,
            _weiPrice,
            _itemMarketName,
            _tradeUrl,
            _assetId,
            _inspectLink,
            _itemImageUrl,
            _float
        );
        ++totalContracts;
    }

    function getTradeContractByIndex(uint256 index)
        external
        view
        returns (CSXTrade)
    {
        return tradeContracts[index];
    }

    function getLastTradeContractAddress() external view returns (address) {
        return address(tradeContracts[totalContracts - 1]);
    }
}
