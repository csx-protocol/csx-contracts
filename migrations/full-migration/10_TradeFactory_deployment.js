const TradeFactory = artifacts.require("CSXTradeFactory");
const Keepers = artifacts.require("Keepers");
const Users = artifacts.require("Users");
const TradeFactoryBaseStorage = artifacts.require("TradeFactoryBaseStorage");

//mock
const Web3 = require('web3');

module.exports = async function (deployer, accounts) {
  await deployer.deploy(TradeFactory, Keepers.address, Users.address, TradeFactoryBaseStorage.address);

  const tradeFactory = await TradeFactory.at(TradeFactory.address);
  const users = await Users.at(Users.address);

  const setFactoryAddressOnUsersContract = await users.setFactoryAddress(TradeFactory.address);
  console.log('setFactoryAddressOnUsersContract complete');

  const tradeFactoryBaseStorage = await TradeFactoryBaseStorage.at(TradeFactoryBaseStorage.address);
  const setInitOnTradeFactoryBaseStorage = await tradeFactoryBaseStorage.init(TradeFactory.address);
  console.log('setInitOnTradeFactoryBaseStorage complete');

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

  console.log(">>>RUNNING MOCK-DATA...");

  const _tradeUrl = {
    partner: '225482466',
    token: 'EP2Wgs2R'
  }

  //   struct Sticker {
  //     string name;
  //     string material;
  //     uint8 slot;
  //     string imageLink;
  // }

  const stickers = [
    [{
      name: 'Heroic (Glitter) | Antwerp 2022',
      material: 'antwerp2022/hero_glitter',
      slot: 0,
      imageLink: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXQ9QVcJY8gulRcQljHQva9hZ-BARJ8IBZYib2pIhN01uH3fTxQ69n4wtCKxfOhY-6JxzsAsJcliLyXooqt2AS3-0NqazyhJY7EcFI4N1rVr0_-n7kARJEYLg'
    }],
    [],
    [],
    [],
    [],
    [],
    [],
  ]

  // 5 15 30 75 150 500 2500
  const prices = ['2977130000000000', '8933480000000000', '17864780000000000', '44661960000000000', '89323910000000000', '297776550000000000', '1489077140000000000'];
  const names = ['R8 Revolver | Bone Mask (Field-Tested)', 'Negev | Bulkhead (Minimal Wear)', 'Negev | Army Sheen (Minimal Wear)', 'MAC-10 | Nuclear Garden (Field-Tested)', 'Galil AR | Rocket Pop (Factory New)', 'StatTrak™ AK-47 | Slate (Factory New)', '★ Driver Gloves | Rezan the Red (Minimal Wear)']
  const weaponTypes = ['R8 Revolver', 'Negev', 'Negev', 'MAC-10', 'Galil AR', 'AK-47', 'Driver Gloves'];
  const imgs = ['https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_revolver_sp_tape_light_large.c8f9124ff70ca2a6e8867920cd39e4fb7308ac87.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_hy_ducts_yellow_light_large.9d9335325a4a696ec6c2ef704ec1d4b3112c8c87.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_am_army_shine_light_large.884085f4a13b786f0ac7234d616ff01a848f28d5.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_mac10_am_nuclear_skulls3_mac10_light_large.467b325065522e5248247cf125bec257cdb66902.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_galilar_cu_galilar_particles_light_large.8732f64d53dbc9b0c732641655d4f99124d8cacc.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_professional_light_large.d09d623d0a725c63e8a3905f66bba41ba2ed59e8.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/slick_gloves_slick_rezan_light_large.642934831085e8715a7e8072614f71f9fc0f205e.png']
  const inspctLink = ['steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28591758742D769815130885352460', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28492787574D16143929557675144168', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28433491397D9821478250864647424', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315956209D14460612990892731053', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315874929D12397849034060993453', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28229768155D11574396181669127541', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A27955299910D14756333338738051571']
  // const floatInfo = [
  //   {
  //     value: '0.35223010182380676',
  //     min: '0.06',
  //     max: '0.8'
  //   },
  //   {
  //     value: '0.08516129851341248',
  //     min: '0',
  //     max: '0.5'
  //   },
  //   {
  //     value: '0.09403269737958908',
  //     min: '0.07',
  //     max: '0.15'
  //   },
  //   {
  //     value: '0.2573419511318207',
  //     min: '0.15',
  //     max: '0.38'
  //   },
  //   {
  //     value: '0.057323157787323',
  //     min: '0',
  //     max: '0.07'
  //   },
  //   {
  //     value: '0.055094581097364426',
  //     min: '0',
  //     max: '1'
  //   },
  //   {
  //     value: '0.10778621584177017',
  //     min: '0.06',
  //     max: '0.8'
  //   },
  // ]

  /**
   * struct SkinInfo {
    string floatValues; // "[0.00, 0.00, 0.000000]" (max, min, value)
    uint256 paintSeed; // ranging from 1 to 1000, determines the unique pattern of a skin, such as the placement of the artwork, wear, and color distribution.
    uint256 paintIndex; // Paint index is a fixed value for each skin and does not change across different instances of the same skin. Ex. the AWP Dragon Lore has a paint index of 344. 
   }
   */

  const skinInfo = [
    {
      floatValues: '[0.8, 0.06, 0.35223010182380676]',
      paintSeed: '8',
      paintIndex: '27'
    },
    {
      floatValues: '[0.5, 0, 0.08516129851341248]',
      paintSeed: '317',
      paintIndex: '783'
    },
    {
      floatValues: '[0.15, 0.07, 0.09403269737958908]',
      paintSeed: '274',
      paintIndex: '298'
    },
    {
      floatValues: '[0.38, 0.15, 0.2573419511318207]',
      paintSeed: '848',
      paintIndex: '372'
    },
    {
      floatValues: '[0.07, 0, 0.057323157787323]',
      paintSeed: '256',
      paintIndex: '478'
    },
    {
      floatValues: '[1, 0, 0.055094581097364426]',
      paintSeed: '859',
      paintIndex: '1035'
    },
    {
      floatValues: '[0.8, 0.06, 0.10778621584177017]',
      paintSeed: '556',
      paintIndex: '10069'
    },
  ]

  //const result = await tradeFactory.createListingContract(names[0], _tradeUrl, '112', inspctLink[0], imgs[0], prices[0], floatInfo[0], stickers[0]);
  // console.log('>>>COMPLETED',result);

  for (let i = 0; i < prices.length; i++) {
    const result = await tradeFactory.createListingContract(names[i], _tradeUrl, '112' + i, inspctLink[i], imgs[i], prices[i], skinInfo[i], stickers[i], weaponTypes[i]);
    console.log('>>>COMPLETED ' + (i + 1) + " out of " + prices.length);
  }
};
