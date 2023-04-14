const CSXToken = artifacts.require("CSXToken");
module.exports = async function (deployer) {
  deployer.deploy(CSXToken);
};
