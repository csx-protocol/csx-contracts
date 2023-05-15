// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ITradeFactoryBaseStorage} from "./storage/ITradeFactoryBaseStorage.sol";
import "./ITradeFactory.sol";
import "../Keepers/IKeepers.sol";
import "../Users/IUsers.sol";


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
        require(isTradeContract[msg.sender], "!tc");
        _;
    }

    function changeBaseFee(uint256 _baseFee) external {
        require(keepersContract.isCouncil(msg.sender));
        baseFee = _baseFee;
    }

    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool)
    {
        return isTradeContract[contractAddress];
    }

    function onStatusChange(TradeStatus status, string memory data, address sellerAddress, address buyerAddress)
        external
        onlyTradeContracts
    {
        emit TradeContractStatusChange(msg.sender, status, data, sellerAddress, buyerAddress);
    }

    function totalContracts() external view returns (uint256) {
        return tradeFactoryBaseStorage.totalContracts();
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
