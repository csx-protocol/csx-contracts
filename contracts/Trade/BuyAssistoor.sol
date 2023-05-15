// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IWETH } from "../CSX/Interfaces.sol";

interface ITradeContract {
    function commitBuy(TradeUrl memory _buyerTradeUrl, bytes32 _affLink) external;
    function priceType() external view returns (PriceType);
    function weiPrice() external view returns (uint256);
}

import { TradeStatus, Role } from '../Users/IUsers.sol';
import { TradeUrl, PriceType } from '../TradeFactory/ITradeFactory.sol';

contract BuyAssistoor {
    IWETH public weth;

    constructor(address _weth) {
        weth = IWETH(_weth);
    }

    function BuyWithEthToWeth(TradeUrl memory _buyerTradeUrl, bytes32 _affLink, address _tradeContract) public payable {
        require(_tradeContract != address(0), "Invalid buy contract address");

        ITradeContract tradeContract = ITradeContract(_tradeContract);

        require(tradeContract.priceType() == PriceType.WETH, "Invalid price type");
        
        // Convert the ETH to WETH
        weth.deposit{value: msg.value}();

        // Check the balance
        require(weth.balanceOf(address(this)) >= msg.value, "ETH deposit failed");

        // Approve the transfer of WETH
        bool approved = weth.approve(address(tradeContract), msg.value);
        require(approved, "WETH approval failed");

        // Now you have WETH, and you can call commitBuy function
        tradeContract.commitBuy(_buyerTradeUrl, _affLink);
    }
}
