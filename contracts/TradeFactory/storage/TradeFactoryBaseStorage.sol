// //SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import {IKeepers, ReentrancyGuard, CSXTrade, IUsers, TradeUrl, SkinInfo} from "./ITradeFactoryBaseStorage.sol";

error NotFactory();
error AlreadyInitialized();
error NotCouncil();

contract TradeFactoryBaseStorage is ReentrancyGuard {
    uint256 public totalContracts;
    mapping(uint256 => CSXTrade) tradeContracts;
    IKeepers public keepersContract;
    IUsers public usersContract;
    address public factoryAddress;
    bool public hasInit;

    constructor(address _keepers, address _users) {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
    }

    modifier isCouncil {
        if (!keepersContract.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        _;
    }

    function changeContracts(address _keepers, address _users) external isCouncil {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
    }

    function init(address _factoryAddress) external {
        if (!keepersContract.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        if (hasInit) {
            revert AlreadyInitialized();
        }
        if(_factoryAddress == address(0)) {
            revert NotFactory();
        }
        hasInit = true;
        factoryAddress = _factoryAddress;
    }

    function newTradeContract(
        string memory _itemMarketName,
        TradeUrl memory _tradeUrl,
        string memory _assetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        uint256 _weiPrice,
        SkinInfo memory _skinInfo
    ) external nonReentrant returns (bool) {
        if (factoryAddress != msg.sender) {
            revert NotFactory();
        }
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
            _skinInfo
        );
        ++totalContracts;
        return true;
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
