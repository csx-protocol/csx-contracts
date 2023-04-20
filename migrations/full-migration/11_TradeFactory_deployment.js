const TradeFactory = artifacts.require("CSXTradeFactory");
const Keepers = artifacts.require("Keepers");
const Users = artifacts.require("Users");
const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");
const ReferralRegistry = artifacts.require("ReferralRegistry");
const StakedCSX = artifacts.require("StakedCSX");

//mock
const Web3 = require('web3');

const USDCToken = artifacts.require("USDCToken");
const USDTToken = artifacts.require("USDTToken");
const WETH9Mock = artifacts.require("WETH9Mock");

module.exports = async function (deployer, network, accounts) {
  console.log('network', network);
  if (network === 'ganache') {
    const weth = WETH9Mock.address;
    const usdc = USDCToken.address;
    const usdt = USDTToken.address;
    await deployer.deploy(TradeFactory, Keepers.address, Users.address, TradeFactoryBaseStorage.address, '2', { weth, usdc, usdt }, ReferralRegistry.address, StakedCSX.address);

    // MOCK DATA
    const web3 = new Web3(deployer.provider);

    // Send Ether to another account
    // Replace these values with the desired sender and recipient addresses
    console.log('Current Account for Sending Ether to regular wallet', accounts[0]);
    const [sender] = await web3.eth.getAccounts();
    const UserTest = web3.utils.toChecksumAddress('0x4E48D90085B3CDE260f91b2863718bc28282dF8f');
    const OracleTest = web3.utils.toChecksumAddress('0xD9dDCdD3100630ac357f63fB9353f576fD3C9533');
    // Set the amount of Ether you want to send (in wei)
    const etherToSend = web3.utils.toWei('1', 'ether');

    // Estimate the gas required for the transaction
    const gasEstimate = await web3.eth.estimateGas({
      from: sender,
      to: UserTest,
      value: etherToSend
    });

    // Send the Ether
    await web3.eth.sendTransaction({
      from: sender,
      to: UserTest,
      value: etherToSend,
      gas: gasEstimate
    });

    await web3.eth.sendTransaction({
      from: sender,
      to: OracleTest,
      value: etherToSend,
      gas: gasEstimate
    });

  } else {
    const weth = 'addyHere';
    const usdc = 'addyHere';
    const usdt = 'addyHere';
    await deployer.deploy(TradeFactory, Keepers.address, Users.address, TradeFactoryBaseStorage.address, '2', { weth, usdc, usdt }, ReferralRegistry.address, StakedCSX.address);
  }

  const tradeFactory = await TradeFactory.at(TradeFactory.address);
  const users = await Users.at(Users.address);

  const setFactoryAddressOnUsersContract = await users.setFactoryAddress(TradeFactory.address);
  console.log('users: setFactoryAddressOnUsersContract complete');

  const tradeFactoryBaseStorage = await TradeFactoryBaseStorage.at(TradeFactoryBaseStorage.address);
  const setInitOnTradeFactoryBaseStorage = await tradeFactoryBaseStorage.init(TradeFactory.address);
  console.log('tradeFactoryBaseStorage: setInitOnTradeFactoryBaseStorage complete');

  const setInitOnReferralRegistry = await ReferralRegistry.at(ReferralRegistry.address);
  const setInitOnReferralRegistryComplete = await setInitOnReferralRegistry.initFactory(TradeFactory.address);
  console.log('ReferralRegistry: setInitOnReferralRegistryComplete complete');
};
