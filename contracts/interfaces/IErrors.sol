// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IErrors {
    error ZeroAddress();
    error ZeroAmount();
    error AlreadyInitialized();
    error InsufficientAllowance();
    error InsufficientBalance();
}