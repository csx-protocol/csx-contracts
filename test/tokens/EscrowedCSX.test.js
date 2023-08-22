const EscrowedCSX = artifacts.require("EscrowedCSX");
const CSXToken = artifacts.require("CSXToken");
const VestedCSX = artifacts.require("VestedCSX");

contract("EscrowedCSX", (accounts) => {
    const [deployer, user1] = accounts;

    let csxToken;
    let escrowedCSX;
    let vestedCSX;

    beforeEach(async () => {
        csxToken = await CSXToken.new();
        escrowedCSX = await EscrowedCSX.new(csxToken.address);
    });

    describe("Initialization", () => {
        it('should not allow non-deployers to initialize', async () => {
            const isInitializedBefore = await escrowedCSX.isInitialized();
            assert.isFalse(isInitializedBefore, "The contract is already initialized");

            const contractDeployer = deployer;
            assert.notEqual(contractDeployer, user1, "user1 is the deployer. Use a different account.");

            // Create a new VestedCSX instance for this test
            vestedCSX = await VestedCSX.new(
                escrowedCSX.address,
                user1,  // random address for StakedCSX
                user1,  // random address for WETH
                user1,  // random address for USDC
                csxToken.address,
                user1   // random address for USDT
            );

            try {
                await escrowedCSX.init(vestedCSX.address, { from: user1 });
                assert.fail('Expected revert not received');
            } catch (error) {
                const revertFound = error.message.search('Only deployer can initialize') >= 0;
                assert(revertFound, `Expected "Only deployer can initialize", but got ${error} instead`);
            }
        });

        it("should allow the deployer to initialize with the VestedCSX token", async () => {
            vestedCSX = await VestedCSX.new(
                escrowedCSX.address,
                user1,  // random address for StakedCSX
                user1,  // random address for WETH
                user1,  // random address for USDC
                csxToken.address,
                user1   // random address for USDT
            );
            await escrowedCSX.init(vestedCSX.address);
            const vestedCSXAddress = await escrowedCSX.vestedCSX();
            assert.equal(vestedCSXAddress, vestedCSX.address, "Vesting token not set correctly");
        });
    });

    describe("Minting escrowed tokens", () => {
        beforeEach(async () => {
            vestedCSX = await VestedCSX.new(
                escrowedCSX.address,
                user1,  // random address for StakedCSX
                user1,  // random address for WETH
                user1,  // random address for USDC
                csxToken.address,
                user1   // random address for USDT
            );
            await escrowedCSX.init(vestedCSX.address);
        });

        it("should allow users to mint escrowed tokens", async () => {
            const mintAmount = web3.utils.toWei("100", "ether");

            await csxToken.transfer(user1, mintAmount);
            await csxToken.approve(escrowedCSX.address, mintAmount, { from: user1 });

            await escrowedCSX.mintEscrow(mintAmount, { from: user1 });

            // Validate that the user has the correct balance of escrowed tokens
            const balance = await escrowedCSX.balanceOf(user1);
            assert.equal(balance.toString(), mintAmount, "Incorrect balance after minting");

            // Validate that the CSX balance of the user has been reduced
            const csxBalance = await csxToken.balanceOf(user1);
            assert.equal(csxBalance.toString(), "0", "Incorrect CSX balance after minting");

            // Validate that the CSX balance of the vestedCSX contract has increased
            const csxBalanceVestedCSX = await csxToken.balanceOf(vestedCSX.address);
            assert.equal(csxBalanceVestedCSX.toString(), mintAmount, "Incorrect CSX balance in VestedCSX contract after minting");
        });
    });
});
