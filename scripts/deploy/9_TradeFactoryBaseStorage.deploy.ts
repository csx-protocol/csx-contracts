import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployTradeFactoryBaseStorage = async (
  hre: HardhatRuntimeEnvironment,
  keepersAddress: string,
  usersAddress: string
): Promise<string> => {
  const TradeFactoryBaseStorage = await hre.ethers.getContractFactory("TradeFactoryBaseStorage");
  const tradeFactoryBaseStorage: any = await TradeFactoryBaseStorage.deploy(keepersAddress, usersAddress);
  await tradeFactoryBaseStorage.waitForDeployment();
  return tradeFactoryBaseStorage.target;
};

export default deployTradeFactoryBaseStorage;
