const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer) {
  const COUNCIL_ADDRESS = "0x06BEE609f7d0819324704cA06290eb21Cee9Eb14";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
};
