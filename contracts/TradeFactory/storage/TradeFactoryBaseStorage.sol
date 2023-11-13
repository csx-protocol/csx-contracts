// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

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

    /**
     * @notice Change the keepers and users contracts
     * @dev This is used when the keepers or users contracts are upgraded
     * @dev This function can only be called by a council member
     * @param _keepers new keepers contract address
     * @param _users new users contract address
     */
    function changeContracts(address _keepers, address _users) external isCouncil {
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
    }

    /**
     * @notice Initialize the factory contract
     * @dev This function can only be called by a council member
     * @dev This function can only be called once
     * @param _factoryAddress address of the factory contract
     */
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

    /**
     * @notice Create a new trade contract
     * @dev This function can only be called by the factory contract
     * @param _itemMarketName Item market name
     * @param _tradeUrl Trade URL
     * @param _assetId Asset ID
     * @param _inspectLink Inspect link
     * @param _itemImageUrl Item image URL
     * @param _weiPrice Price in wei
     * @param _skinInfo Skin info
     */
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

    /**
     * @notice Get a trade contract by index
     * @param index Index of the trade contract
     * @return CSXTrade Contract
     */
    function getTradeContractByIndex(uint256 index)
        external
        view
        returns (CSXTrade)
    {
        return tradeContracts[index];
    }

    /**
     * @notice Get the last trade contract address
     * @dev This function is used to get the last trade contract address
     * @return address Last trade contract address
     */
    function getLastTradeContractAddress() external view returns (address) {
        return address(tradeContracts[totalContracts - 1]);
    }
}
