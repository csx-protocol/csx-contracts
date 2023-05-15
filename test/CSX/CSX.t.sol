// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "contracts/CSX/CSX.sol";

contract CSXTokenTest is Test {
    CSXToken public csx;

    address deployer = address(1);

    uint256 public constant maxSupply = 100000000;

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

    function testTransfer(address user, uint256 amount) public {
        vm.assume(user != address(0));
        vm.assume(user != deployer);
        vm.assume(amount > 0);
        vm.assume(amount <= maxSupply);
        vm.prank(deployer);
        csx.transfer(user, amount);
        vm.stopPrank();
        assertEq(csx.balanceOf(user), amount);
    }
}
