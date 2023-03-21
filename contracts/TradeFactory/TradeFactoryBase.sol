// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./ITradeFactory.sol";
import "../Keepers/IKeepers.sol";
import "../Users/IUsers.sol";

abstract contract TradeFactoryBase is ReentrancyGuard {
    uint256 public totalContracts;
    mapping(address => uint256) contractAddressToIndex;

    mapping(uint256 => SMTrade) tradeContracts;
    mapping(address => bool) isTradeContract;

    IKeepers public keepersContract;
    IUsers public usersContract;

    constructor(address _keepers, address _users) {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
    }

    event TradeContractStatusChange(
        address contractAddress,
        TradeStatus,
        string data
    );

    modifier onlyTradeContracts() {
        require(isTradeContract[msg.sender], "!trade-c");
        _;
    }

    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool)
    {
        return isTradeContract[contractAddress];
    }

    function onStatusChange(TradeStatus status, string memory data)
        external
        onlyTradeContracts
    {
        emit TradeContractStatusChange(msg.sender, status, data);
    }

    /* 
    Move to Users Contract to free up space if needed
    */

    mapping(string => mapping(address => address))
        public assetIdFromUserAddrssToTradeAddrss;

    function removeAssetIdUsed(string memory _assetId, address sellerAddrss)
        external
        onlyTradeContracts
        returns (bool)
    {
        assetIdFromUserAddrssToTradeAddrss[_assetId][sellerAddrss] = address(0);
        return true;
    }

    function hasAlreadyListedItem(string memory _assetId, address sellerAddrss)
        external
        view
        returns (bool)
    {
        if (
            assetIdFromUserAddrssToTradeAddrss[_assetId][sellerAddrss] == address(0)
        ) {
            return false;
        } else {
            return true;
        }
    }
    

    /*
     END Move to Users Contract to free up space if needed
    */
}
