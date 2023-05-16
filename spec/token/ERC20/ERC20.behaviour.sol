// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { IERC20 } from "contracts/interfaces/IERC20.sol";

abstract contract ERC20BehaviourTest is TestUtils {
    IERC20 token;
    uint256 initalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function testTotalSupply() public {
        assertEq(token.totalSupply(), initalSupply);
    }

    function testBalanceDeployer() public {
        assertEq(token.balanceOf(DEPLOYER), initalSupply);
    }

    function testBalanceUser(address user) public {
        vm.assume(user != ZERO_ADDRESS);
        vm.assume(user != DEPLOYER);
        assertEq(token.balanceOf(user), ZERO);
    }

    function testTransfer(address to, uint256 amount) public {
        vm.assume(to != ZERO_ADDRESS);
        vm.assume(to != DEPLOYER);
        vm.assume(amount > ZERO);
        vm.assume(amount <= initalSupply);
        vm.expectEmit(true, true, false, true);
        emit Transfer(DEPLOYER, to, amount);
        vm.prank(DEPLOYER);
        token.transfer(to, amount);
        vm.stopPrank();
        assertEq(token.balanceOf(to), amount);
    }

    function testApprove(address approver, address spender, uint256 amount) public {
        vm.assume(approver != ZERO_ADDRESS);
        vm.assume(spender != ZERO_ADDRESS);
        vm.assume(amount > ZERO);
        vm.assume(amount <= initalSupply);
        vm.expectEmit(true, true, false, true);
        emit Approval(approver, spender, amount);
        vm.prank(approver);
        token.approve(spender, amount);       
        vm.stopPrank();
        assertEq(token.allowance(approver, spender), amount);
    }

    function testTransferFrom(address approver, address spender, uint256 amount) public {
        vm.assume(approver != DEPLOYER);
        vm.assume(spender != DEPLOYER);
        vm.assume(approver != ZERO_ADDRESS);
        vm.assume(spender != ZERO_ADDRESS);
        vm.assume(approver != spender);
        // First we need to send the tokens from deployer to approver
        testTransfer(approver, amount);
        testApprove(approver, spender, amount);
        vm.expectEmit(true, true, false, true);
        emit Transfer(approver, spender, amount);
        vm.prank(spender);
        token.transferFrom(approver, spender, amount);
        // Should reste the allowance to sender to zero
        assertEq(token.allowance(approver, spender), 0);
        assertEq(token.balanceOf(spender), amount);
    }

    function testExpectRevertTransferExceedBalance(address to, uint256 amount) public {
        vm.assume(to != ZERO_ADDRESS);
        vm.assume(to != DEPLOYER);
        vm.assume(amount > ZERO);
        vm.assume(amount > token.balanceOf(DEPLOYER));
        vm.expectRevert(bytes("ERC20: transfer amount exceeds balance"));
        vm.prank(DEPLOYER);
        token.transfer(to, amount);
        vm.stopPrank();
    }

    function testExpectRevertTransferFromExceedBalance(address approver, address spender, uint256 amount, uint256 exceedAmount) public {
        vm.assume(approver != DEPLOYER);
        vm.assume(spender != DEPLOYER);
        vm.assume(approver != ZERO_ADDRESS);
        vm.assume(spender != ZERO_ADDRESS);
        vm.assume(approver != spender);
        // First we need to send the tokens from deployer to approver
        testTransfer(approver, amount);
        vm.assume(exceedAmount > token.balanceOf(approver));
        // make sure we approve exceedAmount
        testApprove(approver, spender, exceedAmount);
        vm.expectRevert(bytes("ERC20: transfer amount exceeds balance"));
        vm.prank(spender);
        token.transferFrom(approver, spender, exceedAmount);
        vm.stopPrank();
    }

    function _erc20Init(address _token, uint256 _initalSupply) internal {
        token = IERC20(_token);
        initalSupply = _initalSupply;
    }
}
