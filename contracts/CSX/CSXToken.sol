// SPDX-License-Identifier: MIT
// CSX Token Contract v1
pragma solidity 0.8.18;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";

contract CSXToken is ERC20Burnable {
    // MAX ONE HUNDERED MILLION CSX TOKENS WITH 18 DECIMALS CAN BE MINTED
    uint256 private constant _MAX_SUPPLY = 100_000_000 * 1e18;
    // DEPLOYER ADDRESS
    address private immutable _DEPLOYER = msg.sender;
    // KEEPERS INTERFACE
    IKeepers private _keepersInterface;
    // HAS INITIALIZED
    bool private _hasInit;
    // EVENT KEEPERS CHANGED
    event KeepersChanged(address indexed previousKeepers, address indexed newKeepers);
    // ERRORS
    error Unauthorized();
    error NotInitialized();
    error AlreadyInitialized();
    error ZeroAddress();
    error ZeroAmount();
    error MaxSupplyExceeded();

    /** private variable to keep track of the total minted tokens
     * @dev Total amount of tokens minted.
     * @dev Due to burn is possible, we we need to keep track 
     *      of total minted tokens rather than totalSupply().
     */
    uint256 private _totalMinted;

    /** Modifier to restrict access to the council
     * @notice This modifier is used to restrict access to the Council
     * @dev It will revert if the sender is not the Council
     */
    modifier onlyC() {
         if(!_keepersInterface.isCouncil(msg.sender)) {
            revert Unauthorized();
        }
        _;
    }

    /** Constructor of the CSX ERC-20 contract.
     * @notice Constructs the CSX ERC-20 contract.
     * @dev Sets the values for {name} and {symbol}.
     * @dev See {ERC20-constructor}.
     * @dev See {ERC20Burnable-constructor}.
     */
    constructor() ERC20("CSX Token", "CSX") {}

    /** Initialize the CSX token contract
     * @notice Initialize the CSX token contract
     * @param keepers address of the keepers contract
     * @dev This function can only be called by the deployer
     * @dev Reverts if the contract has already been initialized
     * @dev Reverts if the keepers address is zero
     * @dev Reverts if the caller is not the deployer
     */
    function init(address keepers) external {
        if(_hasInit) {
            revert AlreadyInitialized();
        }
        if(keepers == address(0)) {
            revert ZeroAddress();
        }
        if(msg.sender != _DEPLOYER) {
            revert Unauthorized();
        }
        _hasInit = true;
        _keepersInterface = IKeepers(keepers);
    }

    /** Mint Tokens
     * @notice Mints tokens to the specified account.
     * @param account Recipient of the tokens.
     * @param amount Amount of tokens to mint.
     * @dev Only callable by the deployer.
     * @dev Reverts if the amount is zero.
     * @dev Reverts if the total minted + amount would exceed the max supply.
     * @dev Reverts if the contract has not been initialized.
     */
    function mint(address account, uint256 amount) external onlyC {
        if(amount == 0) {
            revert ZeroAmount();
        }
        if(_totalMinted + amount > _MAX_SUPPLY) {
            revert MaxSupplyExceeded();
        }
        if(!_hasInit) {
            revert NotInitialized();
        }
        _totalMinted += amount;
        _mint(account, amount);
    }

    /** Change Keepers
     * @notice Change the keepers contract
     * @param newKeepers address of the keepers contract
     * @dev This function can only be called by a council
     * @dev Reverts if the keepers address is zero
     */
    function changeKeepers(address newKeepers) external onlyC {
        if(newKeepers == address(0)) {
            revert ZeroAddress();
        }
        address previousKeepers = address(_keepersInterface);
        _keepersInterface = IKeepers(newKeepers);
        emit KeepersChanged(previousKeepers, newKeepers);
    }
}
