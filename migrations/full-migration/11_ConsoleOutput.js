
const CSXToken = artifacts.require("CSXToken");
const StakedCSX = artifacts.require("StakedCSX");

const EscrowedCSX = artifacts.require("EscrowedCSX");
const VestedCSX = artifacts.require("VestedCSX");

const Keepers = artifacts.require("Keepers");
const Users = artifacts.require("Users");
const UserProfileLevel = artifacts.require("UserProfileLevel");

const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");
const TradeFactory = artifacts.require("CSXTradeFactory");

module.exports = async function (deployer, network) {
    console.log('NETWORK: ', network);
    console.log("CSXToken               ", CSXToken.address);
    console.log("StakedCSX              ", StakedCSX.address);
    if (network == 'ganache') {
        const USDCToken = artifacts.require("USDCToken");
        const USDTToken = artifacts.require("USDTToken");
        const WETH9Mock = artifacts.require("WETH9Mock");
        console.log("USDC                   ", USDCToken.address);
        console.log("USDT                   ", USDTToken.address);
        console.log("WETH                   ", WETH9Mock.address);
    }    
    console.log("EscrowedCSX            ", EscrowedCSX.address);
    console.log("VestedCSX              ", VestedCSX.address);
    console.log("Keepers                ", Keepers.address);
    console.log("Users                  ", Users.address);
    console.log("UserProfileLevel       ", UserProfileLevel.address);
    console.log("TradeFactoryBaseStorage", TradeFactoryBaseStorage.address);
    console.log("TradeFactory           ", TradeFactory.address);
}