const Users = artifacts.require("Users");
const Keepers = artifacts.require("Keepers");

module.exports = async function  (deployer) {
  console.log("KEEPERS ADDy", Keepers.address);
  await deployer.deploy(Users, Keepers.address);
};
