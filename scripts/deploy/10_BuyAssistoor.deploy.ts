import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BuyAssistoor } from '../../typechain-types';

const deployBuyAssistoor = async (hre: HardhatRuntimeEnvironment, wethAddress: string): Promise<BuyAssistoor> => {
  const BuyAssistoor = await hre.ethers.getContractFactory("BuyAssistoor");
  const buyAssistoor:any = await BuyAssistoor.deploy(wethAddress);
  await buyAssistoor.waitForDeployment();
  return buyAssistoor;
};

export default deployBuyAssistoor;
