const ReferralRegistry = artifacts.require("ReferralRegistry");

module.exports = async function (deployer) {
  await deployer.deploy(ReferralRegistry);
};
