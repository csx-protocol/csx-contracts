//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

error ZeroAddress();
error NotCouncil();
error NotNominatedCouncil();
error KeeperAlreadyExists();
error NotAKeeper();

contract Keepers {
    address public keeperOracleAddress;
    address[] public keepers;
    address public council;
    address private nominatedCouncil;
    mapping(address => uint256) public keepersIndex;
    mapping(address => bool) public vesterUnderCouncilControl;
    mapping(address => uint256) private lastVesterUpdate;

    event CouncilNominated(address indexed nominatedCouncil);
    event CouncilChanged(address indexed newCouncil);
    event KeeperAdded(address indexed newKeeper);
    event KeeperRemoved(address indexed keeper);
    event KeeperNodeChanged(address indexed newKeeperNode);
    event VesterUnderCouncilControl(address indexed vesterAddress, bool underCouncilControl); 

    /**
     * @notice Initializes the Keepers contract.
     * @param _council Council Address
     * @param _keeperOracleAddress // Keeper Oracle Address
     * @dev Reverts if the council address is the zero address.
     * @dev Reverts if the keeper oracle address is the zero address.
     */
    constructor(address _council, address _keeperOracleAddress) {
        if (_council == address(0)) {
            revert NotCouncil();
        }
        if (_keeperOracleAddress == address(0)) {
            revert NotAKeeper();
        }
        council = _council;
        // Mocks index 0 to require(indexOf(_keeper) == 0)
        keepers.push(address(0));
        keeperOracleAddress = _keeperOracleAddress;
    }

    modifier onlyCouncil() {
        if (msg.sender != council) {
            revert NotCouncil();
        }
        _;
    }

    /**
     * @notice Returns the keeper at the specified index.
     * @dev Returns the index of the keeper in the keepers array.
     * @param _keeper The address of the keeper to check
     */
    function indexOf(address _keeper) public view returns (uint256) {
        return keepersIndex[_keeper];
    }

    /**
     * @notice Adds a new keeper to the keepers array.
     * @dev Reverts if the keeper already exists.
     * @param _keeper The address of the keeper to add
     */
    function addKeeper(address _keeper) external onlyCouncil {
        if (indexOf(_keeper) != 0) {
            revert KeeperAlreadyExists();
        }
        keepers.push(_keeper);
        keepersIndex[_keeper] = keepers.length - 1;
        emit KeeperAdded(_keeper);
    }

    /**
     * @notice Removes a keeper from the keepers array.
     * @dev Reverts if the keeper does not exist.
     * @param _keeper The address of the keeper to remove
     */
    function removeKeeper(address _keeper) external onlyCouncil {
        uint256 index = keepersIndex[_keeper];
        if (index == 0) {
            revert NotAKeeper();
        }

        // Move the last element to the slot to be deleted
        keepers[index] = keepers[keepers.length - 1];
        // Update the index mapping for the moved keeper
        keepersIndex[keepers[index]] = index;
        // Delete the last element
        keepers.pop();
        // Delete the mapping for the removed keeper
        delete keepersIndex[_keeper];

        emit KeeperRemoved(_keeper);
    }

    /**
     * @notice Checks if the specified address is the keeper node.
     * @param _address The address of the keeper to check
     * @return true if the address is a keeper, false otherwise
     */
    function isKeeperNode(address _address) external view returns (bool) {
        if (_address == keeperOracleAddress) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Checks if the specified address is a keeper.
     * @param _address The address of the keeper to check
     * @return true if the address is a keeper, false otherwise
     */
    function isKeeper(address _address) external view returns (bool) {
        if (indexOf(_address) != 0) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Changes the keeper node address.
     * @param _newAddres The address of the new keeper node
     * @dev Reverts if the new address is the zero address.
     * @dev Reverts if the sender is not the council.
     */
    function changeKeeperNode(address _newAddres) external onlyCouncil {
        if (_newAddres == address(0)) {
            revert NotCouncil();
        }
        keeperOracleAddress = _newAddres;
        emit KeeperNodeChanged(_newAddres);
    }

    /**
     * @notice Nominates a new council address.
     * @param _newCouncil The address of the nominated council
     * @dev Reverts if the new address is the zero address.
     * @dev Reverts if the sender is not the current council.
     */
    function nominateNewCouncil(address _newCouncil) external onlyCouncil {
        if (_newCouncil == address(0)) {
            revert ZeroAddress();
        }
        nominatedCouncil = _newCouncil;
        emit CouncilNominated(_newCouncil);
    }

    /**
     * @notice Accepts the role of council.
     * @dev Reverts if the sender is not the nominated council.
     */
    function acceptCouncilRole() external {
        if (msg.sender != nominatedCouncil) {
            revert NotNominatedCouncil();
        }
        council = nominatedCouncil;
        nominatedCouncil = address(0);
        emit CouncilChanged(council);
    }

    /**
     * @notice Changes the control of a vester.
     * @param _address The address of the vester to change control
     * @dev Reverts if the vester is a zero address.
     * @dev Reverts if the sender is not the council.
     */
    function changeVesterUnderCouncilControl(address _address, bool _value) external onlyCouncil {
        if (_address == address(0)) {
            revert ZeroAddress();
        }
        vesterUnderCouncilControl[_address] = _value;
        lastVesterUpdate[_address] = block.timestamp;
        emit VesterUnderCouncilControl(_address, _value);
    }

    /**
     * @notice Checks if council has control of a vester.
     * @param _address The address of the vester to check
     * @dev Grace period before council control is 2 days.
     */
    function isVesterUnderCouncilControl(address _address) external view returns (bool) {
        if (vesterUnderCouncilControl[_address] && block.timestamp > lastVesterUpdate[_address] + 2 days) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Checks if the specified address is the council.
     * @param _address The address of the keeper to check
     * @return true if the address is the council, false otherwise
     */
    function isCouncil(address _address) external view returns (bool) {
        if (_address == council) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Returns the number of keepers.
     * @return The number of keepers
     */
    function getKeepersCount() external view returns (uint256) {
        return keepers.length;
    }
}
