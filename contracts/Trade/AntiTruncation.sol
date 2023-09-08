// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// interface IERC20 {
//     function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
//     function balanceOf(address account) external view returns (uint256);
// }

// interface IDividendContract {
//     function depositDividend(address token, uint256 amount) external returns (bool);
// }

// contract AntiTruncationContract {
//     address public WETH;
//     address public USDC;
//     address public USDT;
//     address public dividendContract;

//     // Thresholds in wei. Assuming 0.01 for WETH, 1 for USDC and 1 for USDT
//     mapping(address => uint256) public depositThresholds;

//     // Time control
//     uint256 public lastDepositTime;
//     uint256 public constant TIME_BETWEEN_DEPOSITS = 2 weeks;

//     event FundsDeposited(address token, uint256 amount);

//     constructor(address _WETH, address _USDC, address _USDT, address _dividendContract) {
//         WETH = _WETH;
//         USDC = _USDC;
//         USDT = _USDT;
//         dividendContract = _dividendContract;

//         depositThresholds[WETH] = 1e16; // 0.01 WETH
//         depositThresholds[USDC] = 1e6;  // 1 USDC
//         depositThresholds[USDT] = 1e6;  // 1 USDT
//     }

//     function depositToDividendContract(address token) external returns (bool) {
//         require(block.timestamp >= lastDepositTime + TIME_BETWEEN_DEPOSITS, "Cannot deposit yet");

//         uint256 balance = IERC20(token).balanceOf(address(this));

//         // Only deposit if balance is above threshold to avoid dust
//         require(balance >= depositThresholds[token], "Balance below threshold");

//         require(token == WETH || token == USDC || token == USDT, "Invalid token");

//         require(IERC20(token).transferFrom(address(this), dividendContract, balance), "Token transfer failed");
//         IDividendContract(dividendContract).depositDividend(token, balance);

//         lastDepositTime = block.timestamp;
        
//         emit FundsDeposited(token, balance);
//         return true;
//     }
// }
