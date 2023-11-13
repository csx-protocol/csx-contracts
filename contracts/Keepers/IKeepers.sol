// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IKeepers {
    function indexOf(address _keeper) external view returns (uint256);
    function isKeeperNode(address _address) external view returns (bool);
    function isCouncil(address _address) external view returns (bool);
    function council() external view returns (address);
}