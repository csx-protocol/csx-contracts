//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract stakedCSX is Ownable, ReentrancyGuard, ERC20 {
    IERC20 public CSX;

    using SafeMath for uint256;
    uint256 public constant MAX_SUPPLY = 100000000 ether;
    uint256 private constant PRECISION = 10**30; // in gwei

    /// @notice Eth share of each token in gwei
    uint256 dividendPerToken;
    mapping(address => uint256) xDividendPerToken;
    /// @notice Amount that should have been withdrawn
    mapping(address => uint256) credit;

    /// @notice State variable representing amount claimed by account in ETH
    mapping(address => uint256) totalClaimed;

    /// @notice If locked is true, users are not allowed to withdraw funds
    bool public locked;

    event FundsReceived(uint256 amount, uint256 dividendPerToken);

    modifier mintable(uint256 amount) {
        require(
            amount + totalSupply() <= MAX_SUPPLY,
            "amount surpasses max supply"
        );
        _;
    }
    modifier isUnlocked() {
        require(!locked, "contract is currently locked");
        _;
    }

    modifier onlyAddress(address _address) {
        require(msg.sender == _address, "Incorrect party.");
        _;
    }

    receive() external payable {
        require(totalSupply() != 0, "No tokens minted");
        dividendPerToken += (msg.value * PRECISION) / totalSupply();
        // gwei Multiplier decreases impact of remainder though
        emit FundsReceived(msg.value, dividendPerToken);
    }

    constructor(address csxAddress) ERC20('Staked CSX', 'sCSX')
    {
        locked = true;
        CSX = IERC20(csxAddress);
    }

    function stake(uint256 _amount) mintable(_amount) nonReentrant external {
        require(CSX.transferFrom(msg.sender, address(this), _amount), 'transfer failed');
        _claimToCredit(msg.sender);
        _mint(msg.sender, _amount);
    }

    function unStake(uint256 _amount) nonReentrant external {
        require(balanceOf(msg.sender) >= _amount, 'doesnt have enough stakedSMC');
        _claimToCredit(msg.sender);
        _burn(msg.sender, _amount);
        require(CSX.transfer(msg.sender, _amount), 'transfer failed');
    }

    function toggleLock() external onlyOwner {
        locked = !locked;
    }

    /// @notice Withdraw Eth from contract onto the caller w.r.t balance of token held by caller
    /// @dev Reentrancy Guard modifier in order to protect the transaction from reentrancy attack
    function claim() external nonReentrant isUnlocked {
        uint256 holderBalance = balanceOf(_msgSender());
        uint256 creditBalance = credit[_msgSender()];
        require(
            holderBalance != 0 || creditBalance != 0,
            "DToken: caller possess no tokens or credited balance"
        );

        uint256 amount;

        if (holderBalance != 0) {
            uint256 userDividendPerToken = xDividendPerToken[_msgSender()];
            xDividendPerToken[_msgSender()] = dividendPerToken;
            amount = dividendPerToken
                .sub(userDividendPerToken)
                .mul(holderBalance)
                .div(PRECISION);
        }

        if (creditBalance != 0) {
            credit[_msgSender()] = 0;
            amount = amount.add(creditBalance);
        }

        if (amount != 0) {
            (bool success, ) = payable(_msgSender()).call{value: amount}("");
            require(success, "Could not withdraw eth");
        }
    }

    function getClaimableAmount(address _account) external view returns (uint256) {
        uint256 amount = dividendPerToken
            .sub(xDividendPerToken[_account])
            .mul(balanceOf(_account))
            .div(PRECISION);
        amount = amount.add(credit[_account]);
        return amount;
    }

    //=================================== INTERNAL ==============================================
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (from == address(0) || to == address(0)) return;
        // receiver first withdraw funds to credit
        _claimToCredit(to);
        _claimToCredit(from);
    }

    //=================================== PRIVATE ==============================================

    function _claimToCredit(address to_) private {
        uint256 recipientBalance = balanceOf(to_);
        if (recipientBalance != 0) {
            //uint256 amount = ( (dividendPerToken - xDividendPerToken[to_]) * recipientBalance / MULTIPLIER);
            uint256 amount = dividendPerToken
                .sub(xDividendPerToken[_msgSender()])
                .mul(recipientBalance)
                .div(PRECISION);
            //credit[to_] += amount;
            credit[to_] = credit[to_].add(amount);
        }
        xDividendPerToken[to_] = dividendPerToken;
    }
}
