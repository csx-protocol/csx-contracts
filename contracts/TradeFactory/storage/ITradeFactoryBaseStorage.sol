// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "../../Trade/Trade.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITradeFactoryBaseStorage {
    // TODO: add functions

    function totalContracts() external view returns (uint256);

    function newTradeContract(
        string memory _itemMarketName,
        TradeUrl memory _tradeUrl,
        string memory _assetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        uint256 _weiPrice,
        FloatInfo memory _float
    ) external;

    function getTradeContractByIndex(
        uint256 index
    ) external view returns (SMTrade);

    function getTradeContractByAddress(
        address tradeAddress
    ) external view returns (SMTrade);

    function getLastTradeContractAddress() external view returns (address);
}
