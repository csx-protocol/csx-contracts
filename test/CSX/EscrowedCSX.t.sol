// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { ERC20Mock } from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
import { CommonToken } from "./CommonToken.t.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";
import { EscrowedCSX } from "contracts/CSX/EscrowedCSX.sol";

contract EscrowedCSXTest is TestUtils, CommonToken {
    function setUp() public {
        _initCSXToken();
        _initEscrowedCSX();
        _initWETH();
        _initUsdc();
        _initUSDT();
        _initStakedCSX();
        _initVestedCSX();

        vm.prank(DEPLOYER);
        csx.approve(address(eCSX), MAX_SUPPLY);
        assertEq(csx.allowance(DEPLOYER, address(eCSX)), MAX_SUPPLY);
        vm.prank(DEPLOYER);
        eCSX.init(address(vCSX));

        vm.prank(DEPLOYER);
        //eCSX.mintEscrow(1 ether);
        //_erc20Init(address(eCSX), 1);
        
        vm.stopPrank();
    }

    // function testCsxToken() public {
    //     assertEq(address(eCSX.csxToken()), address(csx));
    // }

    // function testExpectRevertInitWhenAlreadyInitialized() public {
    //     vm.expectRevert(IErrors.AlreadyInitialized.selector);
    //     vm.prank(DEPLOYER);
    //     eCSX.init(address(vCSX));
    //     vm.stopPrank();
    // }

    function testExpectRevertMintEscrowWhenZeroAmount() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.prank(DEPLOYER);
        eCSX.mintEscrow(ZERO);
        vm.stopPrank();
    }

    // function testExpectRevertMintEscrowWhenInsufficientAllowance(uint256 amount) public {
    //     vm.assume(amount > 0);
    //     vm.assume(amount < MAX_SUPPLY - 1 ether);
    //     vm.expectRevert(IErrors.InsufficientAllowance.selector);
    //     vm.prank(DEPLOYER);
    //     eCSX.mintEscrow(amount);
    //     vm.stopPrank();
    // }

    function testMintEscrow(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount < MAX_SUPPLY - 1 ether);
        assertEq(csx.balanceOf(DEPLOYER), MAX_SUPPLY);
        vm.prank(DEPLOYER);
        csx.approve(address(eCSX), amount);
        assertEq(csx.allowance(DEPLOYER, address(eCSX)), amount);
        vm.prank(DEPLOYER);
        eCSX.mintEscrow(amount);
        assertEq(eCSX.balanceOf(DEPLOYER), amount);
        assertEq(csx.balanceOf(address(vCSX)), amount);
        vm.stopPrank();
    }

    // function testName() public {
    //     assertEq(csx.name(), "EscrowedCSX Token");
    // }

    // function testSymbol() public {
    //     assertEq(csx.symbol(), "eCSX");
    // }
}
