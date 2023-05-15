// const NetValueCalculator = artifacts.require("NetValueCalculator");

// contract("NetValueCalculator", (accounts) => {
//   let netValueCalculator;

//   beforeEach(async () => {
//     netValueCalculator = await NetValueCalculator.new();
//   });

//   describe("calculateNetValue()", () => {
//     it("should correctly calculate net values when the buyer is affiliated", async () => {
//       const fullItemPrice = 1000;
//       const isBuyerAffiliated = true;
//       const baseFeePercent = 2;
//       const discountRatio = 10;

//       const result = await netValueCalculator.calculateNetValue.call(
//         fullItemPrice,
//         isBuyerAffiliated,
//         baseFeePercent,
//         discountRatio
//       );

//       const buyerNetPrice = result[0].toNumber();
//       const sellerNetProceeds = result[1].toNumber();
//       const affiliatorNetReward = result[2].toNumber();
//       const tokenHoldersNetReward = result[3].toNumber();

//       assert.equal(buyerNetPrice, 998, "Incorrect buyer net price");
//       assert.equal(sellerNetProceeds, 980, "Incorrect seller net proceeds");
//       assert.equal(affiliatorNetReward, 8, "Incorrect affiliator net reward");
//       assert.equal(tokenHoldersNetReward, 10, "Incorrect token holders net reward");
//     });

//     it("should correctly calculate net values when the buyer is not affiliated", async () => {
//       const fullItemPrice = 1000;
//       const isBuyerAffiliated = false;
//       const baseFeePercent = 2;
//       const discountRatio = 10;

//       const result = await netValueCalculator.calculateNetValue.call(
//         fullItemPrice,
//         isBuyerAffiliated,
//         baseFeePercent,
//         discountRatio
//       );

//       const buyerNetPrice = result[0].toNumber();
//       const sellerNetProceeds = result[1].toNumber();
//       const affiliatorNetReward = result[2].toNumber();
//       const tokenHoldersNetReward = result[3].toNumber();

//       assert.equal(buyerNetPrice, 1000, "Incorrect buyer net price");
//       assert.equal(sellerNetProceeds, 980, "Incorrect seller net proceeds");
//       assert.equal(affiliatorNetReward, 0, "Incorrect affiliator net reward");
//       assert.equal(tokenHoldersNetReward, 20, "Incorrect token holders net reward");
//     });
//   });
// });
