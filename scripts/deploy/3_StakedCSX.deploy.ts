import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { StakedCSX } from '../../typechain-types';

const deployStakedCSX = async (
  hre: HardhatRuntimeEnvironment, 
  csxTokenAddress: string,
  keepersAddress: string
): Promise<[StakedCSX, string, string, string]> => {  
  const { network } = hre;

  let wethAddress: string;
  let usdcAddress: string;
  let usdtAddress: string;

  if (
    network.name === 'ganache' || 
    network.name === 'hardhat' || 
    network.name === 'localhost' ||
    network.name === 'goerli') {
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
    wethAddress = "0x..";  // TODO: Replace with actual address
    usdcAddress = "0x..";  // TODO: Replace with actual address
    usdtAddress = "0x..";  // TODO: Replace with actual address
  }

  const StakedCSX = await hre.ethers.getContractFactory("StakedCSX");
  const stakedCSX: any = await StakedCSX.deploy(csxTokenAddress, wethAddress, usdcAddress, usdtAddress, keepersAddress);
  await stakedCSX.waitForDeployment();

  return [stakedCSX, wethAddress, usdcAddress, usdtAddress];
};

export default deployStakedCSX;