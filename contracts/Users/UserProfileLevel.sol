// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

contract UserProfileLevel {
    // Set the base cost for leveling up (1 token)
    uint256 private constant BASE_COST = 1 * 10 ** 18; // Assuming the token has 18 decimals

    // Address of the specific ERC20 token
    IERC20Burnable private token;

    // User struct to store user profile data
    struct User {
        uint256 level;
    }

    // Mapping to store user profiles by their address
    mapping(address => User) public users;

    constructor(address _tokenAddress) {
        token = IERC20Burnable(_tokenAddress);
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
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        token.burn(totalCost);

        // Update the user's level
        user.level += _levels;
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
     *  Total cost = 
     *      Σ [AdjustedBaseCost(level) * (2 ** (level / scalingFactor))], from level 1 to 100.
     *
     *  Here are the approximations for the total cost to level up in each range:
     *      0-100: ≈ 977.09 CSX tokens
     *      100-200: ≈ 1,954.18 CSX tokens
     *      200-300: ≈ 3,908.36 CSX tokens
     *      300-400: ≈ 7,816.72 CSX tokens
     *      400-500: ≈ 15,633.44 CSX tokens
     *      500-600: ≈ 31,266.88 CSX tokens
     *      600-700: ≈ 62,533.76 CSX tokens
     *      700-800: ≈ 125,067.52 CSX tokens
     *      800-900: ≈ 250,135.04 CSX tokens
     *      900-1000: ≈ 500,270.08 CSX tokens
     *      ----------------------------------
     *      0-1000: ≈ 979,562.08 CSX tokens
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
}
