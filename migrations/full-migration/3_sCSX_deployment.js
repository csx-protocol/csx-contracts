const StakedCSX = artifacts.require("StakedCSX");
const USDCToken = artifacts.require("USDCToken");
const USDTToken = artifacts.require("USDTToken");
const WETH9Mock = artifacts.require("WETH9Mock");

const CSXToken = artifacts.require("CSXToken");
module.exports = async function (deployer, network) {

  if (network === 'ganache') {
    console.log("Deploying Mock Stables and WETH9");
    await deployer.deploy(WETH9Mock);
    await deployer.deploy(USDCToken);
    await deployer.deploy(USDTToken);
    await deployer.deploy(StakedCSX, CSXToken.address, WETH9Mock.address, USDCToken.address, USDTToken.address);
  } else {
    const USDC_ADDRESS = "0x..";
    const USDT_ADDRESS = "0x..";
    const WETH_ADDRESS = "0x..";
    await deployer.deploy(StakedCSX, CSXToken.address, WETH_ADDRESS, USDC_ADDRESS, USDT_ADDRESS);
  }


};
