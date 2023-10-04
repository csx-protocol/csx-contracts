// //SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {TradeUrl, SkinInfo, CSXTrade, IKeepers, IUsers} from  "../../Trade/CSXTrade.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITradeFactoryBaseStorage {
    function totalContracts() external view returns (uint256);

    function newTradeContract(
        string memory _itemMarketName,
        TradeUrl memory _tradeUrl,
        string memory _assetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        uint256 _weiPrice,
        SkinInfo memory _skinInfo
    ) external returns (bool);

    function getTradeContractByIndex(
        uint256 index
    ) external view returns (CSXTrade);

    function getLastTradeContractAddress() external view returns (address);
}
