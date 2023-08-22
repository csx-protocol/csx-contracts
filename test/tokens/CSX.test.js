const CSXToken = artifacts.require("CSXToken");

contract("CSXToken", (accounts) => {
    let csxToken;
    const creator = accounts[0];

    beforeEach(async () => {
        csxToken = await CSXToken.new();
    });

    describe("Token Attributes", () => {
        it("should have the correct name", async () => {
            const name = await csxToken.name();
            assert.equal(name, "CSX Token", "Incorrect token name");
        });

        it("should have the correct symbol", async () => {
            const symbol = await csxToken.symbol();
            assert.equal(symbol, "CSX", "Incorrect token symbol");
        });
    });

    describe("Token Supply", () => {
        it("should have a max supply of 100,000,000 CSX", async () => {
            const maxSupply = await csxToken.maxSupply();
            assert.equal(maxSupply.toString(), web3.utils.toWei("100000000", "ether"), "Incorrect max supply");
        });

        it("should allocate the max supply to the deployer", async () => {
            const balanceOfCreator = await csxToken.balanceOf(creator);
            assert.equal(balanceOfCreator.toString(), web3.utils.toWei("100000000", "ether"), "Incorrect balance for the creator");
        });
    });
});
