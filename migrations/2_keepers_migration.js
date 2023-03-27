const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer, accounts) {
  //0xeA311A78F8F3Ba204808cE56c56be677f6A6ae74
  // 0x4E48D90085B3CDE260f91b2863718bc28282dF8f
  const COUNCIL_ADDRESS = "0x6d4153f67d5220Bc632229ec41d158de08f6D010";
  const KEEPER_NODE = "0xD9bD633CcB57584764Ad050b90f7dBfF350c701F"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, KEEPER_NODE);

};
