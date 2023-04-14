const Users = artifacts.require("Users");
const Keepers = artifacts.require("Keepers");
const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");

module.exports = async function (deployer) {
  await deployer.deploy(TradeFactoryBaseStorage, Keepers.address, Users.address);
};
