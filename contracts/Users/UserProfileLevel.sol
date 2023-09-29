// SPDX-License-Identifier: MIT
// CSX UserProfileLevel Contract v1

pragma solidity ^0.8.21;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Burnable} from "../CSX/Interfaces.sol";
import {IUsers} from "../Users/IUsers.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";

error ZeroLevels();
error InsufficientTokens();
error UserBanned();
error NoPendingTransfer();
error TransferToSelf();
error NewAddressNotEmpty();
error NoLevelsToTransfer();
error NotCouncil();

contract UserProfileLevel {
    // Event to be emitted when a user levels up their profile
    event ProfileLeveledUp(
        address indexed userAddress,
        uint256 newLevel,
        uint256 numberOfLevelsIncreased
    );

    // Set the base cost for leveling up (1 token)
    uint256 private constant BASE_COST = 1 * 10 ** 18; // Assuming the token has 18 decimals

    IERC20Burnable private immutable csxToken;
    IUsers private usersContract;
    IKeepers private keepersContract;

    // User struct to store user profile data
    struct User {
        uint256 level;
    }

    // Mapping to store user profiles by their address
    mapping(address => User) public users;

    // Mapping to store pending transfers of user profiles
    mapping(address => address) public pendingTransfers;

    modifier isNotBanned(address _userAddress) {
        if (usersContract.isBanned(_userAddress)) {
            revert UserBanned();
        }
        _;
    }

    constructor(address _tokenAddress, address _usersContractAddress, address _keepersContractAddress) {
        csxToken = IERC20Burnable(_tokenAddress);
        usersContract = IUsers(_usersContractAddress);
        keepersContract = IKeepers(_keepersContractAddress);
    }

    /**
     * @dev Function to level up the user's profile multiple levels at once.
     * Users can send tokens to this function to level up their profile.
     * The cost to level up increases with the user's level.
     * Tokens used for leveling up will be burned.
     *
     * @param _tokenAmount The amount of tokens to be used for leveling up
     * @param _levels The number of levels to level up
     */
    function levelUp(uint256 _tokenAmount, uint256 _levels) public {
        if (_levels == 0) {
            revert ZeroLevels();
        }

        User storage user = users[msg.sender];
        uint256 totalCost = getLevelUpCost(user.level, _levels);

        if (_tokenAmount < totalCost) {
            revert InsufficientTokens();
        }

        // Update the user's level
        user.level += _levels;

        // Emit ProfileLeveledUp event
        emit ProfileLeveledUp(msg.sender, user.level, _levels);

        // Burn the _tokenAmount
        csxToken.burnFrom(msg.sender, _tokenAmount);
    }

    function changeContracts(address _usersContractAddress, address _keepersContractAddress) external {
        if (!keepersContract.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        usersContract = IUsers(_usersContractAddress);
        keepersContract = IKeepers(_keepersContractAddress);
    }

    /**
    * @dev Get the token cost to level up from the current level to the next level.
    * The cost increases linearly with the user's level.
    
    * @param currentLevel The current user level
    * @param levels The number of levels to level up
    * @return totalCost The total token cost to level up the specified number of levels
    *
    * Total cost = Σ (level * BASE_COST), for each level from 1 to n.
    *
    * Total costs to level up in each range:
    *      0-10: 55 CSX tokens
    *      0-20: 210 CSX tokens
    *      0-30: 465 CSX tokens
    *      0-40: 820 CSX tokens
    *      0-50: 1,275 CSX tokens
    *      0-60: 1,830 CSX tokens
    *      0-70: 2,485 CSX tokens
    *      0-80: 3,240 CSX tokens
    *      0-90: 4,095 CSX tokens
    *      0-100: 5,050 CSX tokens
    *      0-200: 20,100 CSX tokens
    *      0-300: 45,150 CSX tokens
    *      0-400: 80,200 CSX tokens
    *      0-500: 125,250 CSX tokens
    *      0-700: 245,350 CSX tokens
    *      0-800: 320,400 CSX tokens
    *      0-900: 405,450 CSX tokens
    *      0-1000: 500,500 CSX tokens
    *      0-2000: 2,001,000 CSX tokens
    */
    function getLevelUpCost(
        uint256 currentLevel,
        uint256 levels
    ) public pure returns (uint256) {
        uint256 totalCost = 0;

        for (uint256 i = 0; i < levels; i++) {
            uint256 cost = BASE_COST + ((currentLevel + i) * BASE_COST);
            totalCost += cost;
        }

        return totalCost;
    }

    /**
     * @dev Function to view the user's level.
     * @param userAddress The address of the user whose level is being requested
     * @return level The user's level
     */
    function getUserLevel(address userAddress) public view returns (uint256) {
        return users[userAddress].level;
    }

    /**
     * @dev Function to view the cost to level up the user's profile for the specified number of levels.
     * @param userAddress The address of the user whose next levels cost is being requested
     * @param levels The number of levels to check the cost for
     * @return totalTokenCostToLevelUp The total token cost to level up the specified number of levels
     */
    function getCostForNextLevels(
        address userAddress,
        uint256 levels
    ) public view returns (uint256) {
        uint256 currentLevel = users[userAddress].level;
        return getLevelUpCost(currentLevel, levels);
    }

    /**
     * @dev Function to get the user's level and the cost to level up for the next 1, 5, and 10 levels.
     * @param userAddress The address of the user whose data is being requested
     * @return userData A tuple containing the user's level, cost for the next level, cost for the next 5 levels, and cost for the next 10 levels
     */
    function getUserData(
        address userAddress
    ) public view returns (uint256, uint256, uint256, uint256) {
        uint256 currentLevel = users[userAddress].level;

        uint256 costForNextLevel = getLevelUpCost(currentLevel, 1);
        uint256 costForNext5Levels = getLevelUpCost(currentLevel, 5);
        uint256 costForNext10Levels = getLevelUpCost(currentLevel, 10);

        return (
            currentLevel,
            costForNextLevel,
            costForNext5Levels,
            costForNext10Levels
        );
    }

    function initiateTransfer(
        address newAddress
    ) external isNotBanned(msg.sender) isNotBanned(newAddress) {
        if (users[newAddress].level != 0) {
            revert NewAddressNotEmpty();
        }
        if (newAddress == address(0) || newAddress == msg.sender) {
            revert TransferToSelf();
        }
        if (users[msg.sender].level == 0) {
            revert NoLevelsToTransfer();
        }

        // Set the pending transfer
        pendingTransfers[msg.sender] = newAddress;
    }

    function acceptTransfer(
        address _originalOwner
    ) external isNotBanned(msg.sender) isNotBanned(_originalOwner) {
        address intendedRecipient = pendingTransfers[_originalOwner];
        if (intendedRecipient != msg.sender) {
            revert NoPendingTransfer();
        }
        if (users[_originalOwner].level == 0) {
            revert NoLevelsToTransfer();
        }
        if(users[intendedRecipient].level != 0) {
            revert NewAddressNotEmpty();
        }
        
        // Complete the transfer
        User storage currentUser = users[_originalOwner];
        uint256 currentLevel = currentUser.level;
        currentUser.level = 0;

        User storage newUser = users[msg.sender];
        newUser.level = currentLevel;

        // Remove the pending transfer
        delete pendingTransfers[_originalOwner];
    }

    function cancelTransfer() external {
        if (pendingTransfers[msg.sender] == address(0)) {
            revert NoPendingTransfer();
        }

        // Remove the pending transfer
        delete pendingTransfers[msg.sender];
    }
}
