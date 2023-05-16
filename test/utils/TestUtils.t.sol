// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";

abstract contract TestUtils is Test {
    address constant ZERO_ADDRESS = address(0);
    address constant DEPLOYER = address(1);
    uint256 constant ZERO = 0;
}