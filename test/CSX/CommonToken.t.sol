// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { TestUtils } from "../utils/TestUtils.t.sol";
import { CSXToken } from "contracts/CSX/CSX.sol";
import { EscrowedCSX } from "contracts/CSX/EscrowedCSX.sol";
import { StakedCSX } from "contracts/CSX/StakedCSX.sol";
import { VestedCSX } from "contracts/CSX/VestedCSX.sol";
import { USDCToken } from "contracts/CSX/mocks/USDC.sol";
import { USDTToken } from "contracts/CSX/mocks/USDT.sol";
import { WETH9Mock } from "contracts/CSX/mocks/WETH9Mock.sol";

abstract contract CommonToken is TestUtils {
    CSXToken public csx;
    EscrowedCSX public eCSX;
    StakedCSX public sCSX;
    VestedCSX public vCSX;
    USDCToken public usdc;
    USDTToken public usdt;
    WETH9Mock public weth;

    uint256 public constant maxSupply = 100000000 ether;

    function _initCSXToken() internal virtual {
        vm.prank(DEPLOYER);
        csx = new CSXToken("CSX Token", "CSX", maxSupply);
        vm.stopPrank();
    }

    function _initEscrowedCSX() internal virtual {
        vm.prank(DEPLOYER);
        eCSX = new EscrowedCSX("EscrowedCSX Token", "eCSX", address(csx));
        vm.stopPrank();
    }

    function _initUsdc() internal virtual {
        vm.prank(DEPLOYER);
        usdc = new USDCToken();
        vm.stopPrank();
    }

    function _initUSDT() internal virtual {
        vm.prank(DEPLOYER);
        usdt = new USDTToken();
        vm.stopPrank();
    }

    function _initWETH() internal virtual {
        vm.prank(DEPLOYER);
        weth = new WETH9Mock();
        vm.stopPrank();
    }

    function _initStakedCSX() internal virtual {
        vm.prank(DEPLOYER);
        sCSX = new StakedCSX(
            "StakedCSX Token",
            "sCSX",
            maxSupply,
            address(csx),
            address(weth),
            address(usdc),
            address(usdt)
        );
    }

    function _initVestedCSX() internal virtual {
        vm.prank(DEPLOYER);
        vCSX = new VestedCSX(
            "Vested CSX",
            "vCSX",
            maxSupply,
            address(eCSX),
            address(sCSX),
            address(weth), 
            address(usdc), 
            address(csx), 
            address(usdt)
        );
    }
}