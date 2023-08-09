// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { ERC20Mock } from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { CommonToken } from "./CommonToken.t.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";
import { EscrowedCSX } from "contracts/CSX/EscrowedCSX.sol";
import { VestedCSX } from "contracts/CSX/VestedCSX.sol";
import { VestedStaking } from "contracts/CSX/VestedStaking.sol";

contract VestedCSXTest is TestUtils, CommonToken {

    function setUp() public {
        vm.startPrank(DEPLOYER);
        _initCSXToken();
        _initEscrowedCSX();
        _initWETH();
        _initUsdc();
        _initUSDT();
        _initStakedCSX();
        _initVestedCSX();

        csx.approve(address(eCSX), MAX_SUPPLY);
        assertEq(csx.allowance(DEPLOYER, address(eCSX)), MAX_SUPPLY);
        eCSX.init(address(vCSX));
        
        vm.stopPrank();
    }

    function testRevertVestWhenAmountIsZero() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.startPrank(DEPLOYER);
        vCSX.vest(ZERO);
        vm.stopPrank();
    }

    function testRevertVestWhenNoEscrowedCSX(address staker, uint256 amount) public {
        vm.assume(staker != DEPLOYER);
        vm.assume(staker != ZERO_ADDRESS);
        vm.assume(amount > 0);
        vm.assume(amount < MAX_SUPPLY - 1 ether);
        vm.expectRevert(IErrors.InsufficientBalance.selector);
        vm.startPrank(staker);
        vCSX.vest(amount);
        vm.stopPrank();
    }

    function testVest(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount < MAX_SUPPLY - 1 ether);
        vm.startPrank(DEPLOYER);
        // we need to mint eCSX first
        csx.approve(address(eCSX), amount);
        assertEq(csx.allowance(DEPLOYER, address(eCSX)), amount);
        eCSX.mintEscrow(amount);
        assertEq(eCSX.balanceOf(DEPLOYER), amount);
        assertEq(csx.balanceOf(address(vCSX)), amount);

        eCSX.approve(address(vCSX), amount);
        assertEq(eCSX.allowance(DEPLOYER, address(vCSX)), amount);

        vCSX.vest(amount);
        assertEq(vCSX.balanceOf(DEPLOYER), amount);
        assertEq(eCSX.balanceOf(DEPLOYER), 0);

        assertEq(csx.balanceOf(address(sCSX)), amount);
        vm.stopPrank();
    }

    function testDoubleVest(uint256 amount, uint256 secondAmount) public {
        vm.assume(secondAmount > 0);
        vm.assume(amount < (MAX_SUPPLY / 2) - 1 ether);
        vm.assume(secondAmount < (MAX_SUPPLY / 2) - 1 ether);

        testVest(amount);

        vm.startPrank(DEPLOYER);
        // we need to mint eCSX first
        csx.approve(address(eCSX), secondAmount);
        assertEq(csx.allowance(DEPLOYER, address(eCSX)), secondAmount);
        eCSX.mintEscrow(secondAmount);
        assertEq(eCSX.balanceOf(DEPLOYER), secondAmount);
        assertEq(csx.balanceOf(address(vCSX)), secondAmount);

        eCSX.approve(address(vCSX), secondAmount);
        assertEq(eCSX.allowance(DEPLOYER, address(vCSX)), secondAmount);

        vCSX.vest(secondAmount);
        assertEq(vCSX.balanceOf(DEPLOYER), amount+secondAmount);
        assertEq(eCSX.balanceOf(DEPLOYER), 0);
        vm.stopPrank();
        
    }

    function testVestAsNonDeployer(address sender, uint256 amount) public {
        vm.assume(sender != DEPLOYER);
        vm.assume(sender != ZERO_ADDRESS);
        vm.assume(amount > 0);
        vm.assume(amount < MAX_SUPPLY - 1 ether);

        assertEq(csx.balanceOf(DEPLOYER), MAX_SUPPLY);
        
        // make sure sender got balances
        vm.startPrank(DEPLOYER);
        csx.transfer(sender, amount);
        vm.stopPrank();

        vm.startPrank(sender);
        // we need to mint eCSX first
        csx.approve(address(eCSX), amount);
        assertEq(csx.allowance(sender, address(eCSX)), amount);
        eCSX.mintEscrow(amount);
        assertEq(eCSX.balanceOf(sender), amount);
        assertEq(csx.balanceOf(address(vCSX)), amount);

        eCSX.approve(address(vCSX), amount);
        assertEq(eCSX.allowance(sender, address(vCSX)), amount);

        vCSX.vest(amount);
        assertEq(vCSX.balanceOf(sender), amount);
        assertEq(eCSX.balanceOf(sender), 0);
        vm.stopPrank();
    }

    function testWithdraw(uint256 amount) public {
        uint256 startAt = block.timestamp + 24*30 days;
        testVest(amount);
        vm.startPrank(DEPLOYER);
        address vestedStakingAddress = vCSX.getVestedStakingContractAddress(DEPLOYER);        
        vCSX.approve(vestedStakingAddress, amount);
        assertEq(vCSX.allowance(DEPLOYER, vestedStakingAddress), amount);

        emit log_named_uint("before withdraw", VestedStaking(vestedStakingAddress).getVestedAmount());
        vm.warp(startAt);
        VestedStaking(vestedStakingAddress).withdraw(amount);
        emit log_named_uint("after withdraw", VestedStaking(vestedStakingAddress).getVestedAmount());
        assertEq(vCSX.balanceOf(DEPLOYER), 0);
        vm.stopPrank();
    }

    function testName() public {
        assertEq(vCSX.name(), "Vested CSX");
    }

    function testSymbol() public {
        assertEq(vCSX.symbol(), "vCSX");
    }
}
