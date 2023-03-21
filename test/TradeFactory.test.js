const Users = artifacts.require("Users");
const TradeFactory = artifacts.require("TradeFactory");
const Trade = artifacts.require("Trade");

contract("TradeFactory", async accounts => {
    let tradeFactory;
    let users;
    randomKeepersAddress = await web3.eth.accounts.create();

    beforeEach(async () => {
        users = await Users.new(randomKeepersAddress.address);
        tradeFactory = await TradeFactory.new(randomKeepersAddress.address, users.address);
    });

    it("should create a new trade contract", async () => {
        const result = await tradeFactory.createListingContract(
            "itemName",
            "tradeUrl",
            "assetId",
            "inspectLink",
            "itemImageUrl",
            web3.utils.toWei("1", "ether"),
            { from: accounts[0] }
        );
        assert.equal(result.logs.length, 1);
        assert.equal(result.logs[0].event, "TradeContractCreated");
        assert.equal(result.logs[0].args.tradeUrl, "tradeUrl");
    });

    it("should set the trade contract's status to Pending when created", async () => {
        const result = await tradeFactory.createListingContract(
            "itemName",
            "tradeUrl",
            "assetId",
            "inspectLink",
            "itemImageUrl",
            web3.utils.toWei("1", "ether"),
            { from: accounts[0] }
        );
        const tradeAddress = result.logs[0].args.contractAddress;
        const trade = await Trade.at(tradeAddress);
        const status = await trade.status();
        assert.equal(status, 0);
    });

    it("should retrieve all trade contracts by address", async () => {
        const firstTrade = await tradeFactory.createListingContract(
            "itemName1",
            "tradeUrl1",
            "assetId1",
            "inspectLink1",
            "itemImageUrl1",
            web3.utils.toWei("1", "ether"),
            { from: accounts[0] }
        );
        await tradeFactory.createListingContract(
            "itemName2",
            "tradeUrl2",
            "assetId2",
            "inspectLink2",
            "itemImageUrl2",
            web3.utils.toWei("1", "ether"),
            { from: accounts[0] }
        );
        const tradeContracts = await tradeFactory.getAllTradeContractsByAddress(accounts[0]);
        assert.equal(tradeContracts.length, 2, "correct amount?");
        assert.equal(tradeContracts[0], firstTrade.logs[0].args.contractAddress, "contract address correct?");
    });

    /**
     * This test first creates 3 trade contracts using the createListingContract function, 
     * then it calls the getContractsFromTo function with the indices 1 and 2 as arguments, 
     * which should return the second and the third trade contract. 
     * The test then asserts that the length of the returned array is 2, 
     * the itemMarketName of the first returned contract is "itemName2" and the itemMarketName 
     * of the second returned contract is "itemName3", which are the expected results.
     */

    it("should correctly return an array of trade contracts within a given range of indices", async () => {
        await tradeFactory.createListingContract("itemName1", "tradeUrl1", "assetId1", "inspectLink1", "itemImageUrl1", web3.utils.toWei("1", "ether"), { from: accounts[0] });
        await tradeFactory.createListingContract("itemName2", "tradeUrl2", "assetId2", "inspectLink2", "itemImageUrl2", web3.utils.toWei("2", "ether"), { from: accounts[0] });
        await tradeFactory.createListingContract("itemName3", "tradeUrl3", "assetId3", "inspectLink3", "itemImageUrl3", web3.utils.toWei("3", "ether"), { from: accounts[0] });
        const contracts = await tradeFactory.getContractsFromTo(1, 2);
        assert.equal(contracts.length, 2);
        assert.equal(contracts[0].itemMarketName, "itemName2");
        assert.equal(contracts[1].itemMarketName, "itemName3");
    });   

});
