const Keepers = artifacts.require("Keepers");
module.exports = async function (deployer) {
  const COUNCIL_ADDRESS = "0x60B72FE1749Bb825B09984ceDA299a076b467190";
  const ORACLE_NODE_ADDRESS = "0xD9dDCdD3100630ac357f63fB9353f576fD3C9533"

  deployer.deploy(Keepers, COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
};
