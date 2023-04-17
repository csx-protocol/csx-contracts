const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer) {
  const COUNCIL_ADDRESS = "0x4005965bCe3F3b8D49e21Bd1455F93b8a140b5df";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
};
