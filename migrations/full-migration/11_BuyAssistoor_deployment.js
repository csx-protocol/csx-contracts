const BuyAssistoor = artifacts.require("BuyAssistoor");
const WETH9Mock = artifacts.require("WETH9Mock");

module.exports = async function (deployer, network) {
  if (network === 'ganache') {
    await deployer.deploy(BuyAssistoor, WETH9Mock.address);
  } else {
    const wethAddress = '';
    await deployer.deploy(BuyAssistoor, wethAddress);
  }
  
};
