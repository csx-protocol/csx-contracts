// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IStakedCSX {
    error ZeroTokensMinted();
    error TokenNotSupported(address token);
    error UnstakeSameBlock(uint256 blockNumber);
    
    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);

    event FundsReceived(
        uint256 amount,
        uint256 dividendPerToken,
        address token
    );

    event FundsClaimed(
        uint256 amount,
        uint256 dividendPerToken,
        address token
    );
    
    function getDividendPerToken(address token) external view returns (uint256);
    function getClaimableAmount(address account) external view returns (uint256, uint256, uint256);
    function depositDividend(address token, uint256 amount) external returns (bool);
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function claim(bool, bool, bool, bool) external;
}