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

    uint256 public constant MAX_SUPPLY = 100000000 ether;
    uint256 public constant MAX_SUPPLY_USD = 100000000 * 10 ** 6;

    function _initCSXToken() internal virtual {
        csx = new CSXToken("CSX Token", "CSX", MAX_SUPPLY);
    }

    function _initEscrowedCSX() internal virtual {
        eCSX = new EscrowedCSX("EscrowedCSX Token", "eCSX", address(csx));
    }

    function _initUsdc() internal virtual {
        usdc = new USDCToken();
    }

    function _initUSDT() internal virtual {
        usdt = new USDTToken();
    }

    function _initWETH() internal virtual {
        vm.deal(DEPLOYER, MAX_SUPPLY);
        weth = new WETH9Mock();
        weth.deposit{value: MAX_SUPPLY}();
    }

    function _initStakedCSX() internal virtual {
        sCSX = new StakedCSX(
            "StakedCSX Token",
            "sCSX",
            MAX_SUPPLY,
            address(csx),
            address(weth),
            address(usdc),
            address(usdt)
        );
        //
    }

    function _initVestedCSX() internal virtual {
        vCSX = new VestedCSX(
            "Vested CSX",
            "vCSX",
            MAX_SUPPLY,
            address(eCSX),
            address(sCSX),
            address(weth), 
            address(usdc), 
            address(csx), 
            address(usdt)
        );
    }
}