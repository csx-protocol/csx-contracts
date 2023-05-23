const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer) {
  const COUNCIL_ADDRESS = "0x66D16Dbe0833BEf7138382041b46a71Dc57814dD";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
};
