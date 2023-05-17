// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "test/utils/TestUtils.t.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

abstract contract ERC20CappedBehaviourTest is TestUtils {
    ERC20Capped public token;
    uint256 public cap;

    string constant CAPPED_EXCEEDED = "ERC20Capped: cap exceeded";

    function testCap() public {
        assertEq(token.cap(), cap);
    }

    function testMintLessThanCap(uint256 amount) public {
        vm.assume(amount > ZERO);
        vm.assume(amount < cap);
        vm.expectEmit(true, true, false, true);
        emit Transfer(ZERO_ADDRESS, DEPLOYER, amount);
        vm.prank(DEPLOYER);
        token.mint(DEPLOYER, amount);
        vm.stopPrank();
        assertEq(token.balanceOf(DEPLOYER), amount);
    }

    function testExpectRevertMintAmountExceedCap(uint256 amount) public {
        vm.assume(amount > ZERO);
        vm.assume(amount == cap - 1);
        vm.prank(DEPLOYER);
        token.mint(DEPLOYER, amount);
        vm.expectRevert(bytes(CAPPED_EXCEEDED));
        vm.prank(DEPLOYER);
        token.mint(DEPLOYER, 2);
        vm.stopPrank();
    }

    function testExpectRevertMintAfterCapReached(uint256 amount) public {
        vm.assume(amount > ZERO);
        vm.assume(amount == cap);
        vm.prank(DEPLOYER);
        token.mint(DEPLOYER, amount);
        vm.expectRevert(bytes(CAPPED_EXCEEDED));
        vm.prank(DEPLOYER);
        token.mint(DEPLOYER, 1);
        vm.stopPrank();
    }

    function _erc20CappedInit(address _token, uint256 _cap) internal {
        token = ERC20Capped(_token);
        cap = _cap;
    }
}