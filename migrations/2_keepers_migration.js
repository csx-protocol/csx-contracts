const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer, accounts) {
  //0xeA311A78F8F3Ba204808cE56c56be677f6A6ae74
  // 0x4E48D90085B3CDE260f91b2863718bc28282dF8f
  const COUNCIL_ADDRESS = "0x753F63e83F0c18552d3CDB6Ce7453c4adeC9d095";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);

};
