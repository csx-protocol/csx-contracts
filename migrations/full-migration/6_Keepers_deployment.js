const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer) {
  const COUNCIL_ADDRESS = "0xdAf6e48bd6AD16D8773A887E32cC54375Fc58300";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
};
