// SPDX-License-Identifier: MIT
// CSX Vesting Contract v2

pragma solidity 0.8.19;

import {ERC20, IERC20, ReentrancyGuard, IWETH, IERC20Burnable} from "./Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import "./VestedStaking.sol";

contract VestedCSX is ReentrancyGuard, ERC20Burnable {
    IERC20Burnable public EscrowedCSX;
    IStakedCSX public StakedCSX;
    IWETH public WETH;
    IERC20 public USDC;     
    IERC20 public CSX;
    IERC20 public USDT;

    uint256 public constant MAX_SUPPLY = 100000000 ether;

    modifier mintable(uint256 amount) {
        require(
            amount + totalSupply() <= MAX_SUPPLY,
            "amount surpasses max supply"
        );
        _;
    }

    constructor(
        address _eCsxAddress,
        address _sCsxAddress,
        address _wethAddress,
        address _usdcAddress,
        address _csxAddress,
        address _usdtAddress
    ) ERC20("Vested CSX", "vCSX") {
        EscrowedCSX = IERC20Burnable(_eCsxAddress);
        StakedCSX = IStakedCSX(_sCsxAddress);
        WETH = IWETH(_wethAddress);
        USDC = IERC20(_usdcAddress);
        CSX = IERC20(_csxAddress);
        USDT = IERC20(_usdtAddress);
    }

    //=================================== EXTERNAL ==============================================

    mapping(address => VestedStaking) public vestedStakingContractPerUser;

    function vest(uint256 amount) external mintable(amount) nonReentrant {
        require(amount > 0, "Amount must be greater than 0"); // To prevent users wasting gas

        // Burn the deposited escrow tokens
        EscrowedCSX.burnFrom(msg.sender, amount);

        // Mint vCSX tokens to the user
        _mint(msg.sender, amount);

        // Create VestedStaking Contract if it doesn't exist
        if (address(vestedStakingContractPerUser[msg.sender]) == address(0)) {
            vestedStakingContractPerUser[msg.sender] = new VestedStaking(
                address(msg.sender),
                address(StakedCSX),
                address(this),
                address(CSX),
                address(USDC),
                address(USDT),
                address(WETH)
            );
        } 

        // Approve VestedStaking Contract to transfer CSX tokens
        CSX.approve(address(vestedStakingContractPerUser[msg.sender]), amount);

        // Deposit CSX tokens to VestedStaking Contract for the user
        vestedStakingContractPerUser[msg.sender].deposit(amount);
    }

    //=================================== INTERNAL ==============================================
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from == address(0) || to == address(0)) return;
        revert("NonTransferableToken: Token transfers are disabled.");
    }
}
