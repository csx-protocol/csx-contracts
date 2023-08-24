const { expectRevert } = require("@openzeppelin/test-helpers");

const VestedCSX = artifacts.require('VestedCSX');
const EscrowedCSX = artifacts.require('EscrowedCSX'); 
const CSXToken = artifacts.require('CSXToken'); 
const StakedCSX = artifacts.require("StakedCSX");
const USDCToken = artifacts.require("USDCToken");
const USDTToken = artifacts.require("USDTToken");
const WETH9Mock = artifacts.require("WETH9Mock");

contract('VestedCSX', function(accounts) {
  let vestedCSX;
  let escrowedCSX;
  let csx;
  let stakedCSX;
  let usdc;
  let usdt;
  let weth;

  beforeEach(async function() {
    csx = await CSXToken.new();
    weth = await WETH9Mock.new();
    usdc = await USDCToken.new();
    usdt = await USDTToken.new();

    escrowedCSX = await EscrowedCSX.new(csx.address);

    stakedCSX = await StakedCSX.new(csx.address, weth.address, usdc.address, usdt.address);

    vestedCSX = await VestedCSX.new(
      escrowedCSX.address,
      stakedCSX.address,
      weth.address,
      usdc.address,
      csx.address,
      usdt.address
    );

    await escrowedCSX.init(vestedCSX.address);
  });

  it('should vest amount and create VestedStaking contract', async function() {
    const amount = web3.utils.toBN('1000').mul(web3.utils.toBN('1000000000000000000')); // 1000 ether
    const user = accounts[1];

    // Transfer CSX tokens to the user
    await csx.transfer(user, amount);

    // Approve the escrowedCSX to send to the VestedCSX
    await csx.approve(escrowedCSX.address, amount, { from: user });

    // Lock the CSX tokens and mint escrowedCSX to the user
    await escrowedCSX.mintEscrow(amount, { from: user });

    // Approve the VestedCSX to burn escrowedCSX from the user
    await escrowedCSX.approve(vestedCSX.address, amount, { from: user });

    // Vest the CSX tokens
    await vestedCSX.vest(amount, { from: user });

    // Validate that the vCSX tokens have been minted to the user
    const vCSXBalance = await vestedCSX.balanceOf(user);
    assert.equal(vCSXBalance.toString(), amount.toString(), 'vCSX balance is incorrect');

    // Validate that the VestedStaking contract has been created for the user
    const vestedStakingAddress = await vestedCSX.getVestedStakingContractAddress(user);
    assert.notEqual(vestedStakingAddress, '0x0000000000000000000000000000000000000000', 'VestedStaking contract address is incorrect');

    // Validate that the VestedStaking contract has the correct sCSX balance
    const vestedStakingBalance = await stakedCSX.balanceOf(vestedStakingAddress);
    assert.equal(vestedStakingBalance.toString(), amount.toString(), 'VestedStaking balance is incorrect');  
    
    // Validate that the StakedCSX contract has the correct CSX balance
    const stakedCSXBalance = await csx.balanceOf(stakedCSX.address);
    assert.equal(stakedCSXBalance.toString(), amount.toString(), 'StakedCSX balance is incorrect');
  });

  it('should not allow vesting of zero amount', async function() {
    const user = accounts[1];
    const amount = 0;
    
    await csx.transfer(user, amount);
    await csx.approve(escrowedCSX.address, amount, { from: user });

    await expectRevert(
        escrowedCSX.mintEscrow(amount, { from: user }),
        "Amount must be greater than 0"
    )

    await escrowedCSX.approve(vestedCSX.address, amount, { from: user });

    await expectRevert(
      vestedCSX.vest(amount, { from: user }),
      "Amount must be greater than 0"
    );
  });

  it('should revert transfer of vested tokens', async function() {
    const amount = web3.utils.toBN('1000').mul(web3.utils.toBN('1000000000000000000')); // 1000 ether
    const user = accounts[1];
    const receiver = accounts[2];
  
    // Transfer CSX tokens to the user
    await csx.transfer(user, amount);
  
    // Approve the escrowedCSX to send to the VestedCSX
    await csx.approve(escrowedCSX.address, amount, { from: user });
  
    // Lock the CSX tokens and mint escrowedCSX to the user
    await escrowedCSX.mintEscrow(amount, { from: user });
  
    // Approve the VestedCSX to burn escrowedCSX from the user
    await escrowedCSX.approve(vestedCSX.address, amount, { from: user });
  
    // Vest the CSX tokens
    await vestedCSX.vest(amount, { from: user });
  
    // Attempt to transfer the vested tokens (should fail)
    await expectRevert(
      vestedCSX.transfer(receiver, amount, { from: user }),
      "NonTransferableToken: Token transfers are disabled."
    );
  });
});
