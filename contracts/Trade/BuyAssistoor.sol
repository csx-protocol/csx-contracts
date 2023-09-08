// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import { IWETH } from "../CSX/Interfaces.sol";

interface ITradeContract {
    function commitBuy(TradeUrl memory _buyerTradeUrl, bytes32 _affLink, address _buyerAddress) external;
    function priceType() external view returns (PriceType);
    function weiPrice() external view returns (uint256);
}

error InvalidTradeContract();
error InvalidPriceType();
error EthDepositFailed();
error WethApprovalFailed();

import { TradeStatus, Role } from '../Users/IUsers.sol';
import { TradeUrl, PriceType } from '../TradeFactory/ITradeFactory.sol';

contract BuyAssistoor {
    IWETH public weth;

    constructor(address _weth) {
        weth = IWETH(_weth);
    }

    function BuyWithEthToWeth(TradeUrl memory _buyerTradeUrl, bytes32 _affLink, address _tradeContract) public payable {
         if (_tradeContract == address(0)) {
            revert InvalidTradeContract();
        }

        ITradeContract tradeContract = ITradeContract(_tradeContract);

        if (tradeContract.priceType() != PriceType.WETH) {
            revert InvalidPriceType();
        }
        
        // Convert the ETH to WETH
        weth.deposit{value: msg.value}();

        // Check the balance
        if (weth.balanceOf(address(this)) < msg.value) {
            revert EthDepositFailed();
        }

        // Approve the transfer of WETH
        bool approved = weth.approve(address(tradeContract), msg.value);
        if (!approved) {
            revert WethApprovalFailed();
        }

        // Now you have WETH, and you can call commitBuy function
        tradeContract.commitBuy(_buyerTradeUrl, _affLink, msg.sender);
    }
}
