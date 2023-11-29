// SPDX-License-Identifier: MIT
// CSX Vesting Contract v2

pragma solidity 0.8.18;

import {ERC20, IERC20, ReentrancyGuard, IWETH, IERC20Burnable, SafeERC20} from "./Interfaces.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import {VestedStaking, IStakedCSX} from "./VestedStaking.sol";

error AmountMustBeGreaterThanZero();
error AmountSurpassesMaxSupply();
error TokenTransfersDisabled();
error ZeroAddress();

contract VestedCSX is ReentrancyGuard, ERC20Burnable {
    using SafeERC20 for IERC20;
    IERC20Burnable public immutable ESCROWED_CSX;
    IStakedCSX public immutable STAKED_CSX;
    IWETH public immutable WETH;
    IERC20 public immutable USDC;
    IERC20 public immutable CSX;
    IERC20 public immutable USDT;
    address public immutable KEEPERS;

    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    constructor(
        address _eCsxAddress,
        address _sCsxAddress,
        address _wethAddress,
        address _usdcAddress,
        address _csxAddress,
        address _usdtAddress,
        address _keepersAddress
    ) ERC20("Vested CSX", "vCSX") {
        if(_isZeroAddress(_eCsxAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_sCsxAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_wethAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_usdcAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_csxAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_usdtAddress)) {
            revert ZeroAddress();
        }
        if(_isZeroAddress(_keepersAddress)) {
            revert ZeroAddress();
        }
        ESCROWED_CSX = IERC20Burnable(_eCsxAddress);
        STAKED_CSX = IStakedCSX(_sCsxAddress);
        WETH = IWETH(_wethAddress);
        USDC = IERC20(_usdcAddress);
        CSX = IERC20(_csxAddress);
        USDT = IERC20(_usdtAddress);
        KEEPERS = _keepersAddress;
    }

    //=================================== EXTERNAL ==============================================

    mapping(address => VestedStaking) public vestedStakingContractPerUser;

    /**
     * @notice Vest the user's escrowed CSX tokens
     * @dev Burns eCSX, Mints Vested CSX & Sends the user's CSX to the VestedStaking contract
     * @param amount The amount of tokens to be vested
     */
    function vest(uint256 amount) external nonReentrant {
        if (amount + totalSupply() > MAX_SUPPLY) {
            revert AmountSurpassesMaxSupply();
        }
        if (amount == 0) {
            revert AmountMustBeGreaterThanZero();
        }

        // Mint vCSX tokens to the user
        _mint(msg.sender, amount);

        // Create VestedStaking Contract if it doesn't exist
        if (address(vestedStakingContractPerUser[msg.sender]) == address(0)) {
            vestedStakingContractPerUser[msg.sender] = new VestedStaking(
                address(msg.sender),
                address(STAKED_CSX),
                address(this),
                address(CSX),
                address(USDC),
                address(USDT),
                address(WETH),
                KEEPERS
            );
        }

        // Burn the deposited escrow tokens
        ESCROWED_CSX.burnFrom(msg.sender, amount);

        // Approve VestedStaking Contract to transfer CSX tokens
        CSX.safeIncreaseAllowance(address(vestedStakingContractPerUser[msg.sender]), amount);

        // Deposit CSX tokens to VestedStaking Contract for the user
        vestedStakingContractPerUser[msg.sender].deposit(amount);
    }

    /**
     * @notice Get the user's VestedStaking Contract address
     * @param user The user's address
     */
    function getVestedStakingContractAddress(
        address user
    ) external view returns (address) {
        return address(vestedStakingContractPerUser[user]);
    }

    //=================================== INTERNAL ==============================================
    /**
     * @notice Hook that ensures vCSX token transfers are disabled
     * @param from From Address
     * @param to To Address
     * @param amount Amount of tokens
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from == address(0) || to == address(0)) return;
        revert TokenTransfersDisabled();
    }

    //=================================== PRIVATE ==============================================
    /**
     * @notice Check if the address is the zero address
     * @param _address The address to check
     * @return true if the address is the zero address else false
     */
    function _isZeroAddress(address _address) private pure returns (bool) {
        return _address == address(0);
    }
}
