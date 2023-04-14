const Users = artifacts.require("Users");
const Keepers = artifacts.require("Keepers");

module.exports = async function (deployer) {
  await deployer.deploy(Users, Keepers.address);
};
