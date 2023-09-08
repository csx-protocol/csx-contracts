import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployBuyAssistoor = async (hre: HardhatRuntimeEnvironment, wethAddress: string): Promise<string> => {
  const BuyAssistoor = await hre.ethers.getContractFactory("BuyAssistoor");
  const buyAssistoor:any = await BuyAssistoor.deploy(wethAddress);
  await buyAssistoor.waitForDeployment();
  return buyAssistoor.target;
};

export default deployBuyAssistoor;
