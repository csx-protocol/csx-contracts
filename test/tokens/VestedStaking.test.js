const { time } = require('@openzeppelin/test-helpers');

const StakedCSX = artifacts.require('StakedCSX');
const VestedCSX = artifacts.require('VestedCSX');
const EscrowedCSX = artifacts.require('EscrowedCSX');
const VestedStaking = artifacts.require('VestedStaking');
const CSXToken = artifacts.require('CSXToken');
const USDCToken = artifacts.require('USDCToken');
const USDTToken = artifacts.require('USDTToken');
const WETH9Mock = artifacts.require('WETH9Mock');

contract('VestedStaking', function(accounts) {
  let vestedStaking, stakedCSX, vestedCSX, csx, usdc, usdt, weth;

  const [deployer, vesterAddress,] = accounts;

  const amount = web3.utils.toBN('1000').mul(web3.utils.toBN('1000000000000000000')); // 1000 ether

  beforeEach(async function() {
    csx = await CSXToken.new();
    weth = await WETH9Mock.new();
    usdc = await USDCToken.new();
    usdt = await USDTToken.new();
    stakedCSX = await StakedCSX.new(csx.address, weth.address, usdc.address, usdt.address);
    escrowedCSX = await EscrowedCSX.new(csx.address);

    vestedCSX = await VestedCSX.new(
        escrowedCSX.address,
        stakedCSX.address,
        weth.address,
        usdc.address,
        csx.address,
        usdt.address
    );

    await escrowedCSX.init(vestedCSX.address);

    // Transfer CSX tokens to the vesterAddress user
    await csx.transfer(vesterAddress, amount, { from: deployer });

    // Approve the escrowedCSX to send to the VestedCSX
    await csx.approve(escrowedCSX.address, amount, { from: vesterAddress });

    // Lock the CSX tokens and mint escrowedCSX to the vesterAddress
    await escrowedCSX.mintEscrow(amount, { from: vesterAddress });

    // Approve the VestedCSX to burn escrowedCSX from the vesterAddress
    await escrowedCSX.approve(vestedCSX.address, amount, { from: vesterAddress });

    // Vest the eCSX tokens
    await vestedCSX.vest(amount, { from: vesterAddress });

    // Get the VestedStaking contract address
    const vestedStakingAddress = await vestedCSX.getVestedStakingContractAddress(vesterAddress);
    // Get the VestedStaking contract
    vestedStaking = await VestedStaking.at(vestedStakingAddress);

    // Validate vestedStaking contract
    assert.equal(await vestedStaking.vesterAddress(), vesterAddress, 'Vester address is incorrect');
  });

  it('should deposit CSX tokens into the staking contract', async function() {
    // Validate that the staking contract has the correct balance of CSX tokens
    const vesting = await vestedStaking.vesting();
    assert.equal(vesting.amount.toString(), amount.toString(), 'Vesting amount is incorrect');
    assert.equal(vesting.startTime.toString(), (await web3.eth.getBlock('latest')).timestamp.toString(), 'Vesting start time is incorrect');
  });

  it('should claim rewards from the staking contract', async function() {
    const depositAmount = web3.utils.toBN('1000').mul(web3.utils.toBN('1000000')); // 1000 ether
    // DepositDivident USDT into the staking contract
    await usdt.approve(stakedCSX.address, depositAmount, { from: deployer });
    await stakedCSX.depositDividend(usdt.address, depositAmount, { from: deployer });

    // Validate usdt rewards for vestedStaking Contract
    const claimableAndTime = await vestedStaking.getClaimableAmountAndVestTimeStart();
    const claimableAmount = claimableAndTime[1];

    assert.equal(claimableAmount.toString(), depositAmount.toString(), 'Claimable amount is incorrect');

    // Claim rewards
    await vestedStaking.claimRewards(true, true, true, true, { from: vesterAddress });

    // Validate that the claimed amount is correctly transferred to vesterAddress
    const usdtBalance = await usdt.balanceOf(vesterAddress);
    assert.equal(usdtBalance.toString(), depositAmount.toString(), 'USDT balance is incorrect');
  });

  it('should not allow withdrawal before vesting period ends', async function() {
    try {
      await vestedStaking.withdraw(amount, { from: vesterAddress });
      assert.fail('Expected revert not received');
    } catch (error) {
      assert(error.message.search('Tokens are still locked') >= 0, `Expected "Tokens are still locked", but got ${error} instead`);
    }
  });

  it('should allow withdrawal after vesting period ends', async function() {
    // Increase time
    const extendTime = 24 * 30 * 24 * 60 * 60; // 24 months
    await time.increase(extendTime);

    // Approve
    await vestedCSX.approve(vestedStaking.address, amount, { from: vesterAddress });

    // Withdraw
    await vestedStaking.withdraw(amount, { from: vesterAddress });

    // Validate
    // Check balances and vesting state
    // ...
  });
});
