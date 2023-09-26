//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

error NotCouncil();
error KeeperAlreadyExists();
error NotAKeeper();

contract Keepers {
    address keeperNodeAddress;
    address[] public keepers;
    address public council;
    mapping(address => uint256) public keepersIndex;

    event CouncilChanged(address newCouncil);
    event KeeperAdded(address newKeeper);
    event KeeperRemoved(address keeper);
    event KeeperNodeChanged(address newKeeperNode);

    constructor(address _council, address _keeperNodeAddress) {
        if(_council == address(0)) {
            revert NotCouncil();
        }
        if(_keeperNodeAddress == address(0)) {
            revert NotAKeeper();
        }
        council = _council;
        // Mocks index 0 to require(indexOf(_keeper) == 0)
        keepers.push(address(0));
        keeperNodeAddress = _keeperNodeAddress;
    }

    modifier onlyCouncil() {
        if (msg.sender != council) {
            revert NotCouncil();
        }
        _;
    }

    modifier onlyKeepers() {
        if (indexOf(msg.sender) == 0) {
            revert NotAKeeper();
        }
        _;
    }

    function indexOf(address _keeper) public view returns (uint256) {
        return keepersIndex[_keeper];
    }

    function addKeeper(address _keeper) external onlyCouncil {
        if (indexOf(_keeper) != 0) {
            revert KeeperAlreadyExists();
        }
        keepers.push(_keeper);
        keepersIndex[_keeper] = keepers.length - 1;
        emit KeeperAdded(_keeper);
    }

    function removeKeeper(address _keeper) external onlyCouncil {
        uint256 index = keepersIndex[_keeper];
        if (index == 0) {
            revert NotAKeeper();
        }
        delete keepersIndex[_keeper];
        delete keepers[index];
        emit KeeperRemoved(_keeper);
    }

    function isKeeperNode(address _address) external view returns (bool) {
        if (_address == keeperNodeAddress) {
            return true;
        } else {
            return false;
        }
    }

    function isKeeper(address _address) external view returns (bool) {
        if (indexOf(_address) != 0) {
            return true;
        } else {
            return false;
        }
    }

    function changeKeeperNode(address _newAddres) external onlyCouncil {
        if(_newAddres == address(0)) {
            revert NotAKeeper();
        }
        keeperNodeAddress = _newAddres;
        emit KeeperNodeChanged(_newAddres);
    }

    function changeCouncil(address _newCouncil) public onlyCouncil {
        if(_newCouncil == address(0)) {
            revert NotCouncil();
        }
        council = _newCouncil;
        emit CouncilChanged(_newCouncil);
    }

    function isCouncil(address _address) external view returns (bool) {
        if (_address == council) {
            return true;
        } else {
            return false;
        }
    }
}
