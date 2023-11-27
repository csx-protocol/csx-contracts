// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ITradeFactoryBaseStorage} from "./storage/ITradeFactoryBaseStorage.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IUsers, TradeStatus} from "../Users/IUsers.sol";
import {TradeInfo, Strings} from "../TradeFactory/ITradeFactory.sol";

error NotTradeContract();
error NotCouncil();
error BaseFeeGreaterThan100Percent();

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

    modifier isCouncil() {
        if (!keepersContract.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        _;
    }

    /**
     * @notice Change the base fee
     * @dev This function can only be called by a council member
     * @param _baseFee new base fee
     */
    function changeBaseFee(uint256 _baseFee) external isCouncil {
        if(_baseFee > 1000) {
            revert BaseFeeGreaterThan100Percent();
        }
        baseFee = _baseFee;
    }

    /**
     * @notice Change the keepers, users and tradeFactoryBaseStorage contracts
     * @dev This is used when the keepers, users or tradeFactoryBaseStorage contracts are upgraded
     * @dev This function can only be called by a council member
     * @param _keepers new keepers contract address
     * @param _users new users contract address
     * @param _tradeFactoryBaseStorage new tradeFactoryBaseStorage contract address
     */
    function changeContracts(address _keepers, address _users, address _tradeFactoryBaseStorage) external isCouncil {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
        tradeFactoryBaseStorage = ITradeFactoryBaseStorage(_tradeFactoryBaseStorage);
    }

    /**
     * @notice Check if the contract address is a trade contract
     * @param contractAddress address of the contract
     * @return true if the contract address is a trade contract else false
     */
    function isThisTradeContract(address contractAddress)
        external
        view
        returns (bool)
    {
        return isTradeContract[contractAddress];
    }

    mapping(TradeStatus => uint256) public tradeCountByStatus;
    /**
     * @notice Called when the status of a trade contract changes
     * @dev This function can only be called by a trade contract
     * @param status new status
     * @param prevStatus previous status
     * @param data data to emit
     * @param sellerAddress the seller address
     * @param buyerAddress the buyer address
     */
    function onStatusChange(
        TradeStatus status,
        TradeStatus prevStatus,
        string memory data,
        address sellerAddress,
        address buyerAddress
    ) external {
        if (!isTradeContract[msg.sender]) {
            revert NotTradeContract();
        }
        --tradeCountByStatus[prevStatus];
        ++tradeCountByStatus[status];
        emit TradeContractStatusChange(
            msg.sender,
            status,
            data,
            sellerAddress,
            buyerAddress
        );
    }

    /**
     * @notice Get the total contracts
     */
    function totalContracts() external view returns (uint256) {
        return tradeFactoryBaseStorage.totalContracts();
    }
}
