// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Mock } from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import { IErrors } from "contracts/interfaces/IErrors.sol";
import { CommonToken } from "./CommonToken.t.sol";
import { IStakedCSX } from "contracts/interfaces/IStakedCSX.sol";

contract StakedCSXTest is TestUtils, CommonToken {
    event Transfer(address indexed from, address indexed to, uint256 value);

    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);
    event FundsReceived( uint256 amount, uint256 dividendPerToken, address indexed token);

    uint256 public constant PRECISION = 10 ** 33; // used for higher precision calculations

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
        vm.assume(amount <= MAX_SUPPLY);
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
        vm.assume(amount <= MAX_SUPPLY);
        vm.expectRevert(IErrors.InsufficientAllowance.selector);
        vm.prank(DEPLOYER);
        sCSX.stake(amount);
        vm.stopPrank();
    }

    function testStake(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY); 
        assertEq(csx.balanceOf(DEPLOYER), MAX_SUPPLY);
        vm.prank(DEPLOYER);
        csx.approve(address(sCSX), amount);
        assertEq(csx.allowance(DEPLOYER, address(sCSX)), amount);
        vm.expectEmit(true, true, false, true);
        emit Staked(DEPLOYER, amount);
        vm.prank(DEPLOYER);
        sCSX.stake(amount);
        assertEq(sCSX.balanceOf(DEPLOYER), amount);
        assertEq(csx.balanceOf(address(sCSX)), amount);
        vm.stopPrank();
    }

    function testStakes(address[5] memory stakers) public {
        uint256 count = stakers.length;
        // Divide the MAX_SUPPLY by 2 then divide equally among stakers
        uint256 amount = (MAX_SUPPLY / 2) / count;
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

    function testExpectRevertUnstakeWhenZeroAmount() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.prank(DEPLOYER);
        sCSX.unstake(ZERO);
        vm.stopPrank();
    }

    function testExpectRevertUnstakeWhenInsufficientBalance(uint256 amount, address staker) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY);
        vm.assume(staker != ZERO_ADDRESS);
        vm.assume(staker != DEPLOYER);
        vm.prank(staker);
        assertEq(sCSX.balanceOf(staker), ZERO);
        vm.expectRevert(IErrors.InsufficientBalance.selector);
        vm.prank(staker);
        sCSX.unstake(amount);
        vm.stopPrank();
    }

    function testExpectRevertUnstakeWhenUnstakeSameBlock(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY);
        vm.prank(DEPLOYER);
        testStake(amount);
        vm.expectRevert(abi.encodeWithSelector(IStakedCSX.UnstakeSameBlock.selector, block.number));
        vm.prank(DEPLOYER);
        sCSX.unstake(amount);
        vm.stopPrank();
    }
    
    function testUnstake(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY);
        uint256 currentBlockNumber = block.number;
        testStake(amount);
        vm.roll(currentBlockNumber + 1);
        assertEq(block.number, currentBlockNumber + 1);
        uint256 balanceBefore = csx.balanceOf(DEPLOYER);
        emit log_named_uint("balanceBefore", balanceBefore);
        vm.expectEmit(true, true, false, true);
        emit Unstaked(DEPLOYER, amount);
        vm.prank(DEPLOYER);
        sCSX.unstake(amount);
        assertEq(sCSX.balanceOf(DEPLOYER), ZERO);
        assertEq(csx.balanceOf(DEPLOYER), MAX_SUPPLY);
        vm.stopPrank();
    }

    function testUnstakes(address[5] memory stakers) public {
        uint256 count = stakers.length;
        uint256 currentBlockNumber = block.number;
        testStakes(stakers);
        uint256 amount = (MAX_SUPPLY / 2) / count;
        vm.roll(currentBlockNumber + 1);
        assertEq(block.number, currentBlockNumber + 1);
        for (uint256 i = 0; i < count; i++) {
            _unstake(stakers[i], amount);
        }
    }

    function testExpectRevertDepositDividendWhenZeroTokenAddress() public {
        vm.expectRevert(IErrors.ZeroAddress.selector);
        vm.prank(DEPLOYER);
        sCSX.depositDividend(ZERO_ADDRESS, 1);
        vm.stopPrank();
    }

    function testExpectRevertDepositDividendWhenZeroAmount() public {
        vm.expectRevert(IErrors.ZeroAmount.selector);
        vm.prank(DEPLOYER);
        sCSX.depositDividend(address(weth), ZERO);
        vm.stopPrank();
    }

    function testExpectRevertDepositDividendWhenNoBalance(address staker, uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(staker != ZERO_ADDRESS);
        vm.assume(staker != DEPLOYER);
        vm.expectRevert(IErrors.InsufficientBalance.selector);
        vm.prank(staker);
        sCSX.depositDividend(address(weth), amount);
        vm.stopPrank();
    }

    function testExpectRevertDepositDividendWhenNoAllowance(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= 10000 * 10 ** 6);
        emit log_named_uint("Balance weth", weth.balanceOf(DEPLOYER));
        emit log_named_uint("amount", amount);
        vm.expectRevert(IErrors.InsufficientAllowance.selector);
        vm.prank(DEPLOYER);
        sCSX.depositDividend(address(weth), amount);
        vm.stopPrank();
    }

    function testExpectRevertDepositDividendWhenTokenNotSupported(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY);
        address token = address(new ERC20Mock("Test", "TST", DEPLOYER, MAX_SUPPLY));
        vm.prank(DEPLOYER);
        IERC20(token).approve(address(sCSX), amount);
        vm.expectRevert(abi.encodeWithSelector(IStakedCSX.TokenNotSupported.selector, token));
        vm.prank(DEPLOYER);
        sCSX.depositDividend(token, amount);
        vm.stopPrank();
    }

    // // TODO: testExpectRevertDepositDividendWhenZeroSupply
    // function testExpectRevertDepositDividendWhenZeroTokensMinted(uint256 amount) public {
    //     vm.assume(amount > 0);
    //     vm.expectRevert(IStakedCSX.ZeroTokensMinted.selector);
    //     vm.prank(DEPLOYER);
    //     sCSX.depositDividend(address(weth), amount);
    //     vm.stopPrank();
    // }

    function testDepositDividendWETH(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY);
        testStake(amount);
        assertEq(block.timestamp, 1);
        skip(3600);
        assertEq(block.timestamp, 3601);
        _depositWETH(amount);
        assertEq(weth.balanceOf(address(sCSX)), amount);
        (,, uint256 claimableAmount) = sCSX.getClaimableAmount(DEPLOYER);
        assertEq(claimableAmount, amount);
    }

    function testDepositDividendUSDT(uint256 stakes, uint256 deposit) public {
        vm.assume(stakes > 0);
        vm.assume(stakes <= MAX_SUPPLY);
        vm.assume(deposit > 0);
        vm.assume(deposit <= MAX_SUPPLY_USD);
        testStake(stakes);
        assertEq(block.timestamp, 1);
        skip(3600);
        assertEq(block.timestamp, 3601);
        _depositUSDT(deposit);
        assertEq(usdt.balanceOf(address(sCSX)), deposit);
    }

    function testDepositDividendUSDC(uint256 stakes, uint256 deposit) public {
        vm.assume(stakes > 0);
        vm.assume(stakes <= MAX_SUPPLY);
        vm.assume(deposit > 0);
        vm.assume(deposit <= MAX_SUPPLY_USD);
        testStake(stakes);
        assertEq(block.timestamp, 1);
        skip(3600);
        assertEq(block.timestamp, 3601);
        _depositUSDC(deposit);
        assertEq(usdc.balanceOf(address(sCSX)), deposit);
    }

    function _stake(address _staker, uint256 _amount) internal {
        vm.prank(DEPLOYER);
        csx.transfer(_staker, _amount);
        assertEq(csx.balanceOf(_staker), _amount);
        vm.prank(_staker);
        csx.approve(address(sCSX), _amount);
        assertEq(csx.allowance(_staker, address(sCSX)), _amount);
        vm.expectEmit(true, true, false, true);
        emit Staked(_staker, _amount);
        vm.prank(_staker);
        sCSX.stake(_amount);
        assertEq(sCSX.balanceOf(_staker), _amount);
        vm.stopPrank();
    }

    function _unstake(address _staker, uint256 _amount) internal {
        vm.prank(_staker);
        sCSX.unstake(_amount);
        assertEq(sCSX.balanceOf(_staker), ZERO);
        assertEq(csx.balanceOf(_staker), _amount);
        vm.stopPrank();
    }

    function _depositWETH(uint256 amount) internal {
        vm.prank(DEPLOYER);
        weth.approve(address(sCSX), amount);
        uint256 dividendPerToken =  (amount * PRECISION) / sCSX.totalSupply();
        vm.prank(DEPLOYER);
        sCSX.depositDividend(address(weth), amount);
        vm.stopPrank();
        assertEq(sCSX.getDividendPerToken(address(weth)), dividendPerToken);
    }

    function _depositUSDT(uint256 amount) internal {
        vm.prank(DEPLOYER);
        usdt.approve(address(sCSX), amount);
        vm.prank(DEPLOYER);
        sCSX.depositDividend(address(usdt), amount);
        vm.stopPrank();
    }

    function _depositUSDC(uint256 amount) internal {
        vm.prank(DEPLOYER);
        usdc.approve(address(sCSX), amount);
        vm.prank(DEPLOYER);
        sCSX.depositDividend(address(usdc), amount);
        vm.stopPrank();
    }
}