// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";
import { EscrowedCSX } from "contracts/CSX/EscrowedCSX.sol";

contract EscrowedCSXTest is ERC20BehaviourTest {
    CSXToken public csx;
    EscrowedCSX public eCSX;


    uint256 public constant maxSupply = 100000000 ether;

    function setUp() public {
        vm.prank(DEPLOYER);
        csx = new CSXToken("CSX Token", "CSX", maxSupply);
        
        vm.prank(DEPLOYER);
        eCSX = new EscrowedCSX(address(csx), "EscrowedCSX Token", "eCSX");
        
        vm.prank(DEPLOYER);
        csx.approve(address(eCSX), 1);

        vm.prank(DEPLOYER);
        eCSX.init(_vCSXToken);
        //eCSX.mintEscrow(1);
        //_erc20Init(address(eCSX), 1);
        
        vm.stopPrank();
        
    }

    function testName() public {
        assertEq(csx.name(), "EscrowedCSX Token");
    }

    function testSymbol() public {
        assertEq(csx.symbol(), "eCSX");
    }
}
