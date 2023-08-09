// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";
import { CommonToken } from "./CommonToken.t.sol";

contract CSXTokenTest is ERC20BehaviourTest, CommonToken {
    function setUp() public {
        vm.startPrank(DEPLOYER);
        _initCSXToken();
        _erc20Init(address(csx), MAX_SUPPLY);
        vm.stopPrank();
    }

    function testRevertContractZeroAmount() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.startPrank(DEPLOYER);
        CSXToken csx = new CSXToken("CSX Token", "CSX", ZERO);
        vm.stopPrank();
    }

    function testName() public {
        assertEq(csx.name(), "CSX Token");
    }

    function testSymbol() public {
        assertEq(csx.symbol(), "CSX");
    }
}
