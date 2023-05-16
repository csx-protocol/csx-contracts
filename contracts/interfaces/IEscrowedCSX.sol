// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IEscrowedCSX {
    event Initialized();
    function mintEscrow(uint256 _amount) external;
}