// //SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ITradeFactoryBaseStorage} from "./storage/ITradeFactoryBaseStorage.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IUsers, TradeStatus} from "../Users/IUsers.sol";
import {TradeInfo, Strings} from "../TradeFactory/ITradeFactory.sol";

error NotTradeContract();
error NotCouncil();

abstract contract TradeFactoryBase is ReentrancyGuard {
    uint256 public baseFee;
    //uint256 public totalContracts;
    mapping(address => uint256) contractAddressToIndex;

    // mapping(uint256 => SMTrade) tradeContracts;
    mapping(address => bool) isTradeContract;

    IKeepers public keepersContract;
    IUsers public usersContract;
    ITradeFactoryBaseStorage tradeFactoryBaseStorage;

    constructor(address _keepers, address _users, address _tradeFactoryBaseStorage, uint256 _baseFee) {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
        tradeFactoryBaseStorage = ITradeFactoryBaseStorage(_tradeFactoryBaseStorage);
        baseFee = _baseFee;
    }

    event TradeContractStatusChange(
        address contractAddress,
        TradeStatus,
        string data,
        address sellerAddress,
        address buyerAddress
    );

    modifier onlyTradeContracts() {
        if (!isTradeContract[msg.sender]) {
            revert NotTradeContract();
        }
        _;
    }

    modifier isCouncil() {
        if (!keepersContract.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        _;
    }

    function changeBaseFee(uint256 _baseFee) external isCouncil {
        baseFee = _baseFee;
    }

    function changeContracts(address _keepers, address _users, address _tradeFactoryBaseStorage) external isCouncil {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
        tradeFactoryBaseStorage = ITradeFactoryBaseStorage(_tradeFactoryBaseStorage);
    }

    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool)
    {
        return isTradeContract[contractAddress];
    }

    mapping(TradeStatus => uint256) public tradeCountByStatus;
    function onStatusChange(TradeStatus status, TradeStatus prevStatus, string memory data, address sellerAddress, address buyerAddress)
        external
        onlyTradeContracts
    {
        --tradeCountByStatus[prevStatus];
        ++tradeCountByStatus[status];        
        emit TradeContractStatusChange(msg.sender, status, data, sellerAddress, buyerAddress);
    }

    function totalContracts() public view returns (uint256) {
        return tradeFactoryBaseStorage.totalContracts();
    }
}
