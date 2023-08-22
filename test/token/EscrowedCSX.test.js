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
            console.log('contractDeployer', contractDeployer);
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
            const vestingTokenAddress = await escrowedCSX.vestingToken();
            assert.equal(vestingTokenAddress, vestedCSX.address, "Vesting token not set correctly");
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
            
            // Give user1 some CSX tokens and approve the EscrowedCSX contract to spend them
            await csxToken.transfer(user1, mintAmount);
            await csxToken.approve(escrowedCSX.address, mintAmount, { from: user1 });

            await escrowedCSX.mintEscrow(mintAmount, { from: user1 });

            const balance = await escrowedCSX.balanceOf(user1);
            assert.equal(balance.toString(), mintAmount, "Incorrect balance after minting");
        });
    });
});
