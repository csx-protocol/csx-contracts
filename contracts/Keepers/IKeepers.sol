// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IKeepers {
    function isKeeper(address _address) external view returns (bool);
    function isKeeperNode(address _address) external view returns (bool);
    function isCouncil(address _address) external view returns (bool);
    function council() external view returns (address);
    function isVesterUnderCouncilControl(address _address) external view returns (bool);
}