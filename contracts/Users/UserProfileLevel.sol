// SPDX-License-Identifier: MIT
// CSX UserProfileLevel Contract v1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

contract UserProfileLevel {
    // Event to be emitted when a user levels up their profile
    event ProfileLeveledUp(address indexed userAddress, uint256 newLevel, uint256 numberOfLevelsIncreased);


    // Set the base cost for leveling up (1 token)
    uint256 private constant BASE_COST = 1 * 10 ** 18; // Assuming the token has 18 decimals

    // Address of the specific ERC20 token
    IERC20Burnable private csxToken;

    // User struct to store user profile data
    struct User {
        uint256 level;
    }

    // Mapping to store user profiles by their address
    mapping(address => User) public users;

    constructor(address _tokenAddress) {
        csxToken = IERC20Burnable(_tokenAddress);
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
        require(_levels > 0, "Number of levels must be greater than 0.");

        User storage user = users[msg.sender];
        uint256 totalCost = getLevelUpCost(user.level, 50, _levels);

        require(_tokenAmount >= totalCost, "Not enough tokens sent to level up.");

        // Transfer tokens from user and burn the cost amount
        csxToken.transferFrom(msg.sender, address(this), _tokenAmount);
        csxToken.burn(totalCost);

        // Update the user's level
        user.level += _levels;

        // Emit ProfileLeveledUp event
        emit ProfileLeveledUp(msg.sender, user.level, _levels);
    }

    /**
     * @dev Get the token cost to level up from the current level to the next level.
     * The cost increases exponentially with the user's level, and the base cost increases
     * by 1 token for every 10 levels.
     *
     * @param currentLevel The current user level
     * @param scalingFactor The scaling factor to adjust the exponential growth
     * @param levels The number of levels to level up
     * @return totalCost The total token cost to level up the specified number of levels
     *
     * Example:
     *  Rough calculations for the cost to level up from level 1 to 100 with a scaling factor of 50:
     *
     *  AdjustedBaseCost(1) = 1
     *  Total cost = 
     *      Σ [AdjustedBaseCost(level) * (2 ** (level / scalingFactor))], from level 1 to 100.
     *
     *  Here are the approximations for the total cost to level up in each range:
     *      Level 0-100: ≈ 977.09 CSX tokens
     *      Level 100-200: ≈ 1,954.18 CSX tokens
     *      Level 200-300: ≈ 3,908.36 CSX tokens
     *      Level 300-400: ≈ 7,816.72 CSX tokens
     *      Level 400-500: ≈ 15,633.44 CSX tokens
     *      Level 500-600: ≈ 31,266.88 CSX tokens
     *      Level 600-700: ≈ 62,533.76 CSX tokens
     *      Level 700-800: ≈ 125,067.52 CSX tokens
     *      Level 800-900: ≈ 250,135.04 CSX tokens
     *      Level 900-1000: ≈ 500,270.08 CSX tokens
     *      ----------------------------------
     *      0-1000: ≈ 979,562.08 CSX tokens (≈ 0.97% of the total supply)
     */
    function getLevelUpCost(uint256 currentLevel, uint256 scalingFactor, uint256 levels) public pure returns (uint256) {
        uint256 totalCost = 0;

        for (uint256 i = 0; i < levels; i++) {
            uint256 adjustedBaseCost = BASE_COST + (((currentLevel + i) / 10) * 1 * 10 ** 18); // Assuming the token has 18 decimals
            uint256 cost = adjustedBaseCost * (2 ** ((currentLevel + i) / scalingFactor));
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
    function getCostForNextLevels(address userAddress, uint256 levels) public view returns (uint256) {
        uint256 currentLevel = users[userAddress].level;
        return getLevelUpCost(currentLevel, 50, levels);
    }

    /**
     * @dev Function to get the user's level and the cost to level up for the next 1, 5, and 10 levels.
     * @param userAddress The address of the user whose data is being requested
     * @return userData A tuple containing the user's level, cost for the next level, cost for the next 5 levels, and cost for the next 10 levels
     */
    function getUserData(address userAddress) public view returns (uint256, uint256, uint256, uint256) {
        uint256 currentLevel = users[userAddress].level;

        uint256 costForNextLevel = getLevelUpCost(currentLevel, 50, 1);
        uint256 costForNext5Levels = getLevelUpCost(currentLevel, 50, 5);
        uint256 costForNext10Levels = getLevelUpCost(currentLevel, 50, 10);

        return (currentLevel, costForNextLevel, costForNext5Levels, costForNext10Levels);
    }

    /**
     * @dev Function to transfer the user's profile to a new address.
     * The new address must have zero levels.
     *
     * @param newAddress The address to which the profile should be transferred
     */
    function transferProfile(address newAddress) public {
        require(users[newAddress].level == 0, "The new address must have zero levels.");
        require(newAddress != address(0), "The new address cannot be the zero address.");
        require(newAddress != msg.sender, "The new address cannot be the same as the sender's address.");
        require(users[msg.sender].level > 0, "The sender must have at least one level.");

        User storage currentUser = users[msg.sender];
        uint256 currentLevel = currentUser.level;

        // Reset the sender's profile level
        currentUser.level = 0;

        User storage newUser = users[newAddress];
        newUser.level = currentLevel;        
    }
}
