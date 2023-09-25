import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TradeFactoryBaseStorage } from '../../typechain-types';

const deployTradeFactoryBaseStorage = async (
  hre: HardhatRuntimeEnvironment,
  keepersAddress: string,
  usersAddress: string
): Promise<TradeFactoryBaseStorage> => {
  const TradeFactoryBaseStorage = await hre.ethers.getContractFactory("TradeFactoryBaseStorage");
  const tradeFactoryBaseStorage: any = await TradeFactoryBaseStorage.deploy(keepersAddress, usersAddress);
  await tradeFactoryBaseStorage.waitForDeployment();
  return tradeFactoryBaseStorage;
};

export default deployTradeFactoryBaseStorage;
