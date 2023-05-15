// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";

contract CSXTokenTest is Test {
    CSXToken public csx;

    address deployer = address(1);

    uint256 public constant maxSupply = 100000000;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    function setUp() public {
        vm.prank(deployer);
        csx = new CSXToken("CSX Token", "CSX", maxSupply);
        vm.stopPrank();
    }

    function testName() public {
        assertEq(csx.name(), "CSX Token");
    }

    function testSymbol() public {
        assertEq(csx.symbol(), "CSX");
    }

    function testTotalSupply() public {
        assertEq(csx.totalSupply(), maxSupply);
    }

    function testBalanceDeployer() public {
        assertEq(csx.balanceOf(deployer), maxSupply);
    }

    function testBalanceUser(address user) public {
        vm.assume(user != address(0));
        vm.assume(user != deployer);
        assertEq(csx.balanceOf(user), 0);
    }

    function testTransfer(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(to != deployer);
        vm.assume(amount > 0);
        vm.assume(amount <= maxSupply);
        vm.expectEmit(true, true, false, true);
        vm.prank(deployer);
        csx.transfer(to, amount);
        emit Transfer(deployer, to, amount);
        vm.stopPrank();
        assertEq(csx.balanceOf(to), amount);
    }

    function testApprove(address approver, address spender, uint256 amount) public {
        vm.assume(approver != address(0));
        vm.assume(spender != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= maxSupply);
        vm.expectEmit(true, true, false, true);
        vm.prank(approver);
        csx.approve(spender, amount);
        emit Approval(approver, spender, amount);
        vm.stopPrank();
        assertEq(csx.allowance(approver, spender), amount);
    }

    function testTransferFrom(address approver, address spender, uint256 amount) public {
        vm.assume(approver != deployer);
        vm.assume(spender != deployer);
        vm.assume(approver != address(0));
        vm.assume(spender != address(0));
        vm.assume(approver != spender);
        testTransfer(approver, amount);
        testApprove(approver, spender, amount);
        vm.expectEmit(true, true, false, true);
        vm.prank(spender);
        csx.transferFrom(approver, spender, amount);
        emit Transfer(approver, spender, amount);
        assertEq(csx.balanceOf(spender), amount);
    }
}
