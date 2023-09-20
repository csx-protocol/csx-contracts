import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployContract = async (
  hre: HardhatRuntimeEnvironment, 
  csxTokenAddress: string
): Promise<[string, string, string, string]> => {  
  const { network } = hre;

  let wethAddress: string;
  let usdcAddress: string;
  let usdtAddress: string;

  if (network.name === 'ganache' || network.name === 'hardhat') {
    const WETH9Mock = await hre.ethers.getContractFactory("WETH9Mock");
    const weth9Mock: any = await WETH9Mock.deploy();
    await weth9Mock.waitForDeployment();

    const USDCToken = await hre.ethers.getContractFactory("USDCToken");
    const usdcToken: any = await USDCToken.deploy();
    await usdcToken.waitForDeployment();

    const USDTToken = await hre.ethers.getContractFactory("USDTToken");
    const usdtToken: any = await USDTToken.deploy();
    await usdtToken.waitForDeployment();    

    wethAddress = weth9Mock.target;
    usdcAddress = usdcToken.target;
    usdtAddress = usdtToken.target;
  } else {
    // Production Network Deployment
    wethAddress = "0x..";  // Replace with actual address
    usdcAddress = "0x..";  // Replace with actual address
    usdtAddress = "0x..";  // Replace with actual address
  }

  const Keepers = await hre.ethers.getContractFactory("Keepers");
  const keepers: any = await Keepers.deploy(process.env.COUNCIL_ADDRESS!, process.env.ORACLE_NODE_ADDRESS!);
  await keepers.waitForDeployment();

  const StakedCSX = await hre.ethers.getContractFactory("StakedCSX");
  const stakedCSX: any = await StakedCSX.deploy(csxTokenAddress, wethAddress, usdcAddress, usdtAddress, keepers.target);
  await stakedCSX.waitForDeployment();

  return [stakedCSX.target, wethAddress, usdcAddress, usdtAddress];
};

export default deployContract;