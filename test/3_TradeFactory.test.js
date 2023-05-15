// // trade_factory.test.js

// const TradeFactory = artifacts.require("CSXTradeFactory");

// contract("TradeFactory", (accounts) => {
//     let tradeFactory;
//     const owner = accounts[0];

//     before(async () => {
//         tradeFactory = await TradeFactory.deployed();
//     });

//     it("should create test listings that returns correct data", async () => {
//         // Prepare the data (same as in the provided code snippet)
//         const _tradeUrl = {
//             partner: '225482466',
//             token: 'EP2Wgs2R'
//         };
//         const stickers = [
//             [{
//               name: 'Heroic (Glitter) | Antwerp 2022',
//               material: 'antwerp2022/hero_glitter',
//               slot: 0,
//               imageLink: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXQ9QVcJY8gulRcQljHQva9hZ-BARJ8IBZYib2pIhN01uH3fTxQ69n4wtCKxfOhY-6JxzsAsJcliLyXooqt2AS3-0NqazyhJY7EcFI4N1rVr0_-n7kARJEYLg'
//             }],
//             [],
//             [],
//             [],
//             [],
//             [],
//             [],
//         ];
//         const priceTypes = ['0', '0', '1', '0', '0', '2', '0'];
//         const prices = ['2977130000000000', '8933480000000000', '27800000', '44661960000000000', '89323910000000000', '457000000', '1489077140000000000'];
//         const names = ['R8 Revolver | Bone Mask (Field-Tested)', 'Negev | Bulkhead (Minimal Wear)', 'Negev | Army Sheen (Minimal Wear)', 'MAC-10 | Nuclear Garden (Field-Tested)', 'Galil AR | Rocket Pop (Factory New)', 'StatTrak™ AK-47 | Slate (Factory New)', '★ Driver Gloves | Rezan the Red (Minimal Wear)']
//         const weaponTypes = ['R8 Revolver', 'Negev', 'Negev', 'MAC-10', 'Galil AR', 'AK-47', 'Driver Gloves'];
//         const imgs = ['https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_revolver_sp_tape_light_large.c8f9124ff70ca2a6e8867920cd39e4fb7308ac87.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_hy_ducts_yellow_light_large.9d9335325a4a696ec6c2ef704ec1d4b3112c8c87.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_am_army_shine_light_large.884085f4a13b786f0ac7234d616ff01a848f28d5.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_mac10_am_nuclear_skulls3_mac10_light_large.467b325065522e5248247cf125bec257cdb66902.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_galilar_cu_galilar_particles_light_large.8732f64d53dbc9b0c732641655d4f99124d8cacc.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_professional_light_large.d09d623d0a725c63e8a3905f66bba41ba2ed59e8.png', 'https://media.steampowered.com/apps/730/icons/econ/default_generated/slick_gloves_slick_rezan_light_large.642934831085e8715a7e8072614f71f9fc0f205e.png']
//         const inspctLink = ['steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28591758742D769815130885352460', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28492787574D16143929557675144168', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28433491397D9821478250864647424', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315956209D14460612990892731053', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315874929D12397849034060993453', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28229768155D11574396181669127541', 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A27955299910D14756333338738051571']
//         const skinInfo = [
//             {
//               floatValues: '[0.8, 0.06, 0.35223010182380676]',
//               paintSeed: '8',
//               paintIndex: '27'
//             },
//             {
//               floatValues: '[0.5, 0, 0.08516129851341248]',
//               paintSeed: '317',
//               paintIndex: '783'
//             },
//             {
//               floatValues: '[0.15, 0.07, 0.09403269737958908]',
//               paintSeed: '274',
//               paintIndex: '298'
//             },
//             {
//               floatValues: '[0.38, 0.15, 0.2573419511318207]',
//               paintSeed: '848',
//               paintIndex: '372'
//             },
//             {
//               floatValues: '[0.07, 0, 0.057323157787323]',
//               paintSeed: '256',
//               paintIndex: '478'
//             },
//             {
//               floatValues: '[1, 0, 0.055094581097364426]',
//               paintSeed: '859',
//               paintIndex: '1035'
//             },
//             {
//               floatValues: '[0.8, 0.06, 0.10778621584177017]',
//               paintSeed: '556',
//               paintIndex: '10069'
//             },
//         ]

//         // Create the listing contracts
//         for (let i = 0; i < prices.length; i++) {
//             const params = {
//                 itemMarketName: names[i],
//                 tradeUrl: _tradeUrl,
//                 assetId: '112' + i,
//                 inspectLink: inspctLink[i],
//                 itemImageUrl: imgs[i],
//                 weiPrice: prices[i],
//                 skinInfo: skinInfo[i],
//                 stickers: stickers[i],
//                 weaponType: weaponTypes[i],
//                 priceType: priceTypes[i]
//             }
//             await tradeFactory.createListingContract(params);
//         }

//         // Get the total number of listing contracts
//         const totalListings = await tradeFactory.totalContracts();

//         // Check if the total number of listing contracts matches the length of prices array
//         assert.equal(totalListings.toNumber(), prices.length, "The total number of listing contracts should match the length of prices array");

//         // Check if each contract was created with the correct data
//         for (let i = 0; i < prices.length; i++) {
//             const listing = await tradeFactory.getTradeDetailsByIndex(i);
          
//             // Assert that each property of the listing matches the expected value
//             assert.equal(listing.itemMarketName, names[i], `The itemMarketName for listing ${i} should match`);
//             assert.equal(listing.sellerTradeUrl.partner, _tradeUrl.partner, `The tradeUrl partner for listing ${i} should match`);
//             assert.equal(listing.sellerTradeUrl.token, _tradeUrl.token, `The tradeUrl token for listing ${i} should match`);
//             // Add more assertions for other properties...
//         }
//     });
// });
