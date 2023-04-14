const VestedCSX = artifacts.require("VestedCSX");
const EscrowedCSX = artifacts.require("EscrowedCSX");
const StakedCSX = artifacts.require("StakedCSX");
const CSXToken = artifacts.require("CSXToken");


module.exports = async function (deployer, network) {
  if (network === 'ganache') {
    const USDCToken = artifacts.require("USDCToken");
    const USDTToken = artifacts.require("USDTToken");
    const WETH9Mock = artifacts.require("WETH9Mock");
    await deployer.deploy(VestedCSX, EscrowedCSX.address, StakedCSX.address, WETH9Mock.address, USDCToken.address, CSXToken.address, USDTToken.address);
  } else {
    const USDC_ADDRESS = "0x..";
    const USDT_ADDRESS = "0x..";
    const WETH_ADDRESS = "0x..";
    await deployer.deploy(VestedCSX, EscrowedCSX.address, StakedCSX.address, WETH_ADDRESS, USDC_ADDRESS, CSXToken.address, USDT_ADDRESS);
  }

  const escrowedCSX = await EscrowedCSX.deployed();
  const initResult = await escrowedCSX.init(VestedCSX.address);
  console.log('init complete');
};
