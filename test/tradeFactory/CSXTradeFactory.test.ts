import { expect } from "chai";
import { ethers } from "hardhat";
import { PaymentTokensStruct } from "../../typechain-types/contracts/TradeFactory/CSXTradeFactory";
import { InitParamsStruct } from "../../typechain-types/contracts/CSX/StakedCSX";

describe("TradeFactory", function () {
  let tradeFactory: any;
  let deployer: any;
  let user1: any;
  let user2: any;
  let csx: any;
  let weth: any;
  let usdc: any;
  let usdt: any;
  let scsx: any;
  let keepers: any;
  let users: any;
  let buyAssistoor: any;
  let tradeFactoryBaseStorage: any;
  let referralRegistryInstance: any;
  let council: any;
  let keeperNodeAddress: any;

  const _tradeUrl = {
    partner: "225482466",
    token: "EP2Wgs2R",
  };
  const stickers = [
    [
      {
        name: "Heroic (Glitter) | Antwerp 2022",
        material: "antwerp2022/hero_glitter",
        slot: 0,
        imageLink:
          "https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXQ9QVcJY8gulRcQljHQva9hZ-BARJ8IBZYib2pIhN01uH3fTxQ69n4wtCKxfOhY-6JxzsAsJcliLyXooqt2AS3-0NqazyhJY7EcFI4N1rVr0_-n7kARJEYLg",
      },
    ],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ];
  const priceTypes = ["0", "0", "1", "0", "0", "2", "0", "0"];
  const prices = [
    "2977130000000000",
    "8933480000000000",
    "27800000",
    "44661960000000000",
    "89323910000000000",
    "457000000",
    "1489077140000000000",
    "1489077140000000000",
  ];
  const names = [
    "R8 Revolver | Bone Mask (Field-Tested)",
    "Negev | Bulkhead (Minimal Wear)",
    "Negev | Army Sheen (Minimal Wear)",
    "MAC-10 | Nuclear Garden (Field-Tested)",
    "Galil AR | Rocket Pop (Factory New)",
    "StatTrak™ AK-47 | Slate (Factory New)",
    "★ Driver Gloves | Rezan the Red (Minimal Wear)",
    "test",
  ];
  const weaponTypes = [
    "R8 Revolver",
    "Negev",
    "Negev",
    "MAC-10",
    "Galil AR",
    "AK-47",
    "Driver Gloves",
    "test",
  ];
  const imgs = [
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_revolver_sp_tape_light_large.c8f9124ff70ca2a6e8867920cd39e4fb7308ac87.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_hy_ducts_yellow_light_large.9d9335325a4a696ec6c2ef704ec1d4b3112c8c87.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_negev_am_army_shine_light_large.884085f4a13b786f0ac7234d616ff01a848f28d5.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_mac10_am_nuclear_skulls3_mac10_light_large.467b325065522e5248247cf125bec257cdb66902.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_galilar_cu_galilar_particles_light_large.8732f64d53dbc9b0c732641655d4f99124d8cacc.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/weapon_ak47_gs_ak47_professional_light_large.d09d623d0a725c63e8a3905f66bba41ba2ed59e8.png",
    "https://media.steampowered.com/apps/730/icons/econ/default_generated/slick_gloves_slick_rezan_light_large.642934831085e8715a7e8072614f71f9fc0f205e.png",
    "test",
  ];
  const inspctLink = [
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28591758742D769815130885352460",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28492787574D16143929557675144168",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28433491397D9821478250864647424",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315956209D14460612990892731053",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28315874929D12397849034060993453",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A28229768155D11574396181669127541",
    "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198185748194A27955299910D14756333338738051571",
    "test",
  ];
  const skinInfo = [
    {
      floatValues: "[0.8, 0.06, 0.35223010182380676]",
      paintSeed: "8",
      paintIndex: "27",
    },
    {
      floatValues: "[0.5, 0, 0.08516129851341248]",
      paintSeed: "317",
      paintIndex: "783",
    },
    {
      floatValues: "[0.15, 0.07, 0.09403269737958908]",
      paintSeed: "274",
      paintIndex: "298",
    },
    {
      floatValues: "[0.38, 0.15, 0.2573419511318207]",
      paintSeed: "848",
      paintIndex: "372",
    },
    {
      floatValues: "[0.07, 0, 0.057323157787323]",
      paintSeed: "256",
      paintIndex: "478",
    },
    {
      floatValues: "[1, 0, 0.055094581097364426]",
      paintSeed: "859",
      paintIndex: "1035",
    },
    {
      floatValues: "[0.8, 0.06, 0.10778621584177017]",
      paintSeed: "556",
      paintIndex: "10069",
    },
    {
      floatValues: "[0.8, 0.06, 0.10778621584177017]",
      paintSeed: "556",
      paintIndex: "10069",
    },
  ];
  const assetIds = [
    "GG1",
    "28492787574",
    "GG2",
    "28315956209",
    "28315874929",
    "28229768155",
    "27955299910",
    "123321",
  ];

  beforeEach(async function () {
    [deployer, council, keeperNodeAddress, user1, user2] =
      await ethers.getSigners();

    const CSXToken = await ethers.getContractFactory("CSXToken");
    csx = await CSXToken.deploy();
    await csx.waitForDeployment();

    const WETH9Mock = await ethers.getContractFactory("WETH9Mock");
    weth = await WETH9Mock.deploy();
    await weth.waitForDeployment();

    const USDCToken = await ethers.getContractFactory("USDCToken");
    usdc = await USDCToken.deploy();
    await usdc.waitForDeployment();

    const USDTToken = await ethers.getContractFactory("USDTToken");
    usdt = await USDTToken.deploy();
    await usdt.waitForDeployment();

    const Keepers = await ethers.getContractFactory("Keepers");
    keepers = await Keepers.deploy(
      await council.getAddress(),
      await keeperNodeAddress.getAddress()
    );
    await keepers.waitForDeployment();

    const StakedCSX = await ethers.getContractFactory("StakedCSX");
    const stakedInitParams = {
      KEEPERS_INTERFACE: keepers.target,
      TOKEN_CSX: csx.target,
      TOKEN_WETH: weth.target,
      TOKEN_USDC: usdc.target,
      TOKEN_USDT: usdt.target,
    } as InitParamsStruct;
    scsx = await StakedCSX.deploy(stakedInitParams);
    await scsx.waitForDeployment();

    const ReferralRegistry = await ethers.getContractFactory(
      "ReferralRegistry"
    );
    referralRegistryInstance = await ReferralRegistry.deploy(keepers.target, weth.target, usdc.target, usdt.target);
    await referralRegistryInstance.waitForDeployment();

    const Users = await ethers.getContractFactory("Users");
    users = await Users.deploy(keepers.target);
    await users.waitForDeployment();

    const BuyAssistoor = await ethers.getContractFactory("BuyAssistoor");
    buyAssistoor = await BuyAssistoor.deploy(weth.target);
    await buyAssistoor.waitForDeployment();

    const TradeFactoryBaseStorage = await ethers.getContractFactory(
      "TradeFactoryBaseStorage"
    );
    tradeFactoryBaseStorage = await TradeFactoryBaseStorage.deploy(
      keepers.target,
      users.target
    );
    await tradeFactoryBaseStorage.waitForDeployment();

    const TradeFactory = await ethers.getContractFactory("CSXTradeFactory");
    tradeFactory = await TradeFactory.deploy(
      keepers.target,
      users.target,
      tradeFactoryBaseStorage.target,
      "26",
      {
        weth: weth.target,
        usdc: usdc.target,
        usdt: usdt.target,
      } as PaymentTokensStruct,
      referralRegistryInstance.target,
      scsx.target,
      buyAssistoor.target
    );
    await tradeFactory.waitForDeployment();

    await referralRegistryInstance.connect(council).changeContracts(tradeFactory.target, keepers.target);
    await users.connect(council).changeContracts(tradeFactory.target, keepers.target);

    await tradeFactoryBaseStorage.connect(council).init(tradeFactory.target);
  });

  describe("Initialization", function () {
    it("should create test listings that return correct data", async function () {
      // Create the listing contracts
      for (let i = 0; i < prices.length; i++) {
        const params = {
          itemMarketName: names[i],
          tradeUrl: _tradeUrl,
          assetId: assetIds[i],
          inspectLink: inspctLink[i],
          itemImageUrl: imgs[i],
          weiPrice: prices[i],
          skinInfo: skinInfo[i],
          stickers: stickers[i],
          weaponType: weaponTypes[i],
          priceType: priceTypes[i],
        };
        await tradeFactory.connect(deployer).createListingContract(params);
      }

      // Get the total number of listing contracts
      const totalListings = await tradeFactory.totalContracts();

      // Check if the total number of listing contracts matches the length of prices array
      expect(totalListings).to.equal(
        prices.length,
        "The total number of listing contracts should match the length of prices array"
      );

      // Check if each contract was created with the correct data
      for (let i = 0; i < prices.length; i++) {
        const listing = await tradeFactory.getTradeDetailsByIndex(i);

        const _tradeDetailsByAddress = await tradeFactory.getTradeDetailsByAddress(listing.contractAddress);

        const _tradeIndexesByStatus = await tradeFactory.getTradeIndexesByStatus(0, 0, totalListings);

        expect(_tradeIndexesByStatus.length).to.equal(
          prices.length,
          `The total number of listing contracts should match the length of prices array`
        );

        expect(_tradeDetailsByAddress.itemMarketName).to.equal(
          names[i],
          `The itemMarketName for listing ${i} should match`
        );       

        expect(listing.itemMarketName).to.equal(
          names[i],
          `The itemMarketName for listing ${i} should match`
        );
        expect(listing.sellerTradeUrl.partner).to.equal(
          _tradeUrl.partner,
          `The tradeUrl partner for listing ${i} should match`
        );
        expect(listing.sellerTradeUrl.token).to.equal(
          _tradeUrl.token,
          `The tradeUrl token for listing ${i} should match`
        );
        expect(listing.assetId).to.equal(
          assetIds[i],
          `The assetId for listing ${i} should match`
        );
        expect(listing.inspectLink).to.equal(
          inspctLink[i],
          `The inspectLink for listing ${i} should match`
        );
        expect(listing.itemImageUrl).to.equal(
          imgs[i],
          `The itemImageUrl for listing ${i} should match`
        );
        expect(listing.weiPrice).to.equal(
          prices[i],
          `The weiPrice for listing ${i} should match`
        );
        expect(listing.skinInfo.floatValues).to.equal(
          skinInfo[i].floatValues,
          `The skinInfo floatValues for listing ${i} should match`
        );
        expect(listing.skinInfo.paintSeed).to.equal(
          skinInfo[i].paintSeed,
          `The skinInfo paintSeed for listing ${i} should match`
        );
        expect(listing.skinInfo.paintIndex).to.equal(
          skinInfo[i].paintIndex,
          `The skinInfo paintIndex for listing ${i} should match`
        );
        expect(listing.stickers.length).to.equal(
          stickers[i].length,
          `The stickers length for listing ${i} should match`
        );
        expect(listing.weaponType).to.equal(
          weaponTypes[i],
          `The weaponType for listing ${i} should match`
        );
        expect(listing.priceType).to.equal(
          priceTypes[i],
          `The priceType for listing ${i} should match`
        );

        for (let j = 0; j < stickers[i].length; j++) {
          expect(listing.stickers[j].name).to.equal(
            stickers[i][j].name,
            `The sticker name for listing ${i} should match`
          );
          expect(listing.stickers[j].material).to.equal(
            stickers[i][j].material,
            `The sticker material for listing ${i} should match`
          );
          expect(listing.stickers[j].slot).to.equal(
            stickers[i][j].slot,
            `The sticker slot for listing ${i} should match`
          );
          expect(listing.stickers[j].imageLink).to.equal(
            stickers[i][j].imageLink,
            `The sticker imageLink for listing ${i} should match`
          );
        }
        expect(listing.status).to.equal(
          0,
          `The status for listing ${i} should be ForSale`
        );
        expect(listing.seller).to.equal(
          await deployer.getAddress(),
          `The seller for listing ${i} should be the deployer`
        );
        expect(listing.buyer).to.equal(
          `0x${"0".repeat(40)}`,
          `The buyer for listing ${i} should be the zero address`
        );
        expect(listing.buyerTradeUrl.partner).to.equal(
          "",
          `The buyerTradeUrl partner for listing ${i} should be empty`
        );
        expect(listing.buyerTradeUrl.token).to.equal(
          "",
          `The buyerTradeUrl token for listing ${i} should be empty`
        );
        expect(listing.buyerTradeUrl.token).to.equal(
          "",
          `The buyerTradeUrl token for listing ${i} should be empty`
        );
      }
    });
  });

  describe("Base Fee Operations", function () {
    it("should change the base fee", async function () {
      const newBaseFee = "8";
      const oldBaseFee = "26";
      await tradeFactory.connect(council).changeBaseFee(newBaseFee);
      expect(await tradeFactory.baseFee()).to.equal(newBaseFee);
      await tradeFactory.connect(council).changeBaseFee(oldBaseFee);
      await expect(
        tradeFactory.connect(council).changeBaseFee("1001")
      ).to.be.revertedWithCustomError(tradeFactory, "BaseFeeGreaterThan100Percent");      
    });

    it("should not allow unauthorized user to change the base fee", async function () {
      const newBaseFee = "7";
      await expect(
        tradeFactory.connect(user2).changeBaseFee(newBaseFee)
      ).to.be.revertedWithCustomError(tradeFactory, "NotCouncil");
    });
  });

  // describe("Asset ID Operations", function () {
  //     const assetId = "uniqueAssetId";
  //     const assetId2 = "GG1";

  //     it("should check that an asset is not already listed", async function () {
  //         const hasListed = await tradeFactory.hasAlreadyListedItem(assetId, await user1.getAddress());
  //         expect(hasListed).to.be.false;
  //     });

  //     it("should check that an asset is already listed", async function () {
  //         const params = {
  //             itemMarketName: names[0],
  //             tradeUrl: _tradeUrl,
  //             assetId: assetIds[0],
  //             inspectLink: inspctLink[0],
  //             itemImageUrl: imgs[0],
  //             weiPrice: prices[0],
  //             skinInfo: skinInfo[0],
  //             stickers: stickers[0],
  //             weaponType: weaponTypes[0],
  //             priceType: priceTypes[0]
  //         };
  //         await tradeFactory.connect(deployer).createListingContract(params);
  //         const hasListed = await tradeFactory.hasAlreadyListedItem(assetId2, await deployer.getAddress());
  //         expect(hasListed).to.be.true;
  //     });
  // });
});
