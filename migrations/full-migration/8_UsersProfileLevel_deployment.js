const UserProfileLevel = artifacts.require("UserProfileLevel");
const CSXToken = artifacts.require("CSXToken");

module.exports = async function (deployer) {
  await deployer.deploy(UserProfileLevel, CSXToken.address);
};
