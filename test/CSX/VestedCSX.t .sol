// // SPDX-License-Identifier: MIT

// pragma solidity ^0.8.19;

// import { TestUtils } from "test/utils/TestUtils.t.sol";
// import { ERC20Mock } from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
// import { ERC20BehaviourTest } from "@csx/spec/token/ERC20/ERC20.behaviour.sol";
// import { CSXToken } from "contracts/CSX/CSX.sol";
// import { EscrowedCSX } from "contracts/CSX/EscrowedCSX.sol";
// import { VestedCSX } from "contracts/CSX/VestedCSX.sol";

// contract VestedCSXTest is TestUtils {
//     CSXToken public csx;
//     EscrowedCSX public eCSX;
//     VestedCSX public vCSX;

//     uint256 public constant maxSupply = 100000000 ether;

//     function setUp() public {
//         vm.prank(DEPLOYER);
//         csx = new CSXToken("CSX Token", "CSX", maxSupply);
        
//         vm.prank(DEPLOYER);
//         eCSX = new EscrowedCSX(address(csx), "EscrowedCSX Token", "eCSX");

//         vm.prank(DEPLOYER);
//         vCSX = new ERC20Mock("vCSX Token", "vCSX", DEPLOYER, 1);
        
//         vm.prank(DEPLOYER);
//         csx.approve(address(eCSX), maxSupply);
//         assertEq(csx.allowance(DEPLOYER, address(eCSX)), maxSupply);
//         // vm.prank(DEPLOYER);
//         // eCSX.init(address(vCSX));
//         // eCSX.mintEscrow(1);
//         // _erc20Init(address(eCSX), 1);
        
//         // vm.stopPrank();
        
//     }

//     // function testName() public {
//     //     assertEq(csx.name(), "EscrowedCSX Token");
//     // }

//     // function testSymbol() public {
//     //     assertEq(csx.symbol(), "eCSX");
//     // }
// }
