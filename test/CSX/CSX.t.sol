// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";

contract CSXTokenTest is ERC20BehaviourTest {
    CSXToken public csx;
    uint256 public constant maxSupply = 100000000 ether;

    function setUp() public {
        vm.prank(DEPLOYER);
        csx = new CSXToken("CSX Token", "CSX", maxSupply);
        _erc20Init(address(csx), maxSupply);
        vm.stopPrank();
    }

    function testName() public {
        assertEq(csx.name(), "CSX Token");
    }

    function testSymbol() public {
        assertEq(csx.symbol(), "CSX");
    }
}
