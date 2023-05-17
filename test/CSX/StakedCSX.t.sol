// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { CommonToken } from "./CommonToken.t.sol";

contract StakedCSXTest is TestUtils, CommonToken {
    function setUp() public {
        _initCSXToken();
        _initWETH();
        _initUsdc();
        _initUSDT();
        _initStakedCSX();
    }

    function testExpectRevertStakeWhenZeroAmount() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.prank(DEPLOYER);
        sCSX.stake(ZERO);
        vm.stopPrank();
    }

    function testExpectRevertStakeWhenInsufficientBalance(uint256 amount, address staker) public {
        vm.assume(amount > 0);
        vm.assume(amount <= 100000000 ether);
        vm.assume(staker != ZERO_ADDRESS);
        vm.assume(staker != DEPLOYER);
        vm.prank(staker);
        csx.approve(address(sCSX), amount);
        assertEq(csx.allowance(staker, address(sCSX)), amount);
        assertEq(csx.balanceOf(staker), ZERO);
        vm.expectRevert(IErrors.InsufficientBalance.selector);
        vm.prank(staker);
        sCSX.stake(amount);
        vm.stopPrank();
    }

    function testExpectRevertStakeWhenInsufficientAllowance(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= 100000000 ether);
        vm.expectRevert(IErrors.InsufficientAllowance.selector);
        vm.prank(DEPLOYER);
        sCSX.stake(amount);
        vm.stopPrank();
    }

    function testStake(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= 100000000 ether); 
        assertEq(csx.balanceOf(DEPLOYER), maxSupply);
        vm.prank(DEPLOYER);
        csx.approve(address(sCSX), amount);
        assertEq(csx.allowance(DEPLOYER, address(sCSX)), amount);
        vm.prank(DEPLOYER);
        sCSX.stake(amount);
        assertEq(sCSX.balanceOf(DEPLOYER), amount);
        assertEq(csx.balanceOf(address(sCSX)), amount);
        vm.stopPrank();
    }

    function testStakes(address[5] memory stakers) public {
        uint256 count = stakers.length;
        // Divide the maxSupply by 2 then divide equally among stakers
        uint256 amount = (maxSupply / 2) / count;
        for (uint256 i = 0; i < count; i++) {
            vm.assume(stakers[i] != ZERO_ADDRESS);
            vm.assume(stakers[i] != DEPLOYER);
            
            for (uint256 j = 0; j < i; j++) {
                vm.assume(stakers[i] != stakers[j]);
            }
            _stake(stakers[i], amount);
        }
 
        assertEq(csx.balanceOf(address(sCSX)), amount * count);
    }

    function _stake(address _staker, uint256 _amount) internal {
        vm.prank(DEPLOYER);
        csx.transfer(_staker, _amount);
        assertEq(csx.balanceOf(_staker), _amount);
        vm.prank(_staker);
        csx.approve(address(sCSX), _amount);
        assertEq(csx.allowance(_staker, address(sCSX)), _amount);
        vm.prank(_staker);
        sCSX.stake(_amount);
        assertEq(sCSX.balanceOf(_staker), _amount);
        vm.stopPrank();
    }
}