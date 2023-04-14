// SPDX-License-Identifier: MIT
// CSX Escrow Contract v1

pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import {ReentrancyGuard} from "./Interfaces.sol";

contract EscrowedCSX is ERC20Burnable, ReentrancyGuard {
    address deployer = msg.sender;
    bool isInitialized = false;
    IERC20 public csxToken;
    IERC20 public vestingToken;

    // uint256 public constant VESTING_PERIOD = 24 * 30 days;

    // struct Vesting {
    //     uint256 amount;
    //     uint256 startTime;
    // }

    // mapping(address => Vesting) public vestings;

    event Minted(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    constructor(address _csxToken) ERC20("Escrowed CSX", "eCSX") {
        csxToken = IERC20(_csxToken);
    }

    function init(address _vCSXToken) external {
        require(!isInitialized, "Already initialized");
        require(msg.sender == deployer, "Only deployer can initialize");
        isInitialized = true;
        vestingToken = IERC20(_vCSXToken);
    }

    function mintEscrow(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(csxToken.transferFrom(msg.sender, address(vestingToken), _amount), 'Transfer failed.');
        _mint(msg.sender, _amount);
        // vestings[msg.sender] = Vesting(_amount, block.timestamp);
        // handle vesting in vCSX contract
        emit Minted(msg.sender, _amount);
    }

    // function claim() external nonReentrant {
    //     require(vestings[msg.sender].amount > 0, "No vested tokens found");
    //     require(block.timestamp >= vestings[msg.sender].startTime + VESTING_PERIOD, "Vesting period not completed");

    //     uint256 amount = vestings[msg.sender].amount;
    //     delete vestings[msg.sender];
    //     _burn(msg.sender, amount);
    //     csxToken.transfer(msg.sender, amount);
    //     emit Claimed(msg.sender, amount);
    // }
}
