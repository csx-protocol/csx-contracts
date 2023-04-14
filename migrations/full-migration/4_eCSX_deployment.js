const EscrowedCSX = artifacts.require("EscrowedCSX");
const CSXToken = artifacts.require("CSXToken");

module.exports = async function (deployer) {
  await deployer.deploy(EscrowedCSX, CSXToken.address);
};
