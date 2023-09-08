import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { PaymentTokensStruct } from '../../typechain-types/contracts/TradeFactory/CSXTradeFactory';

const deployCSXTradeFactory = async (
  hre: HardhatRuntimeEnvironment,
  keepersAddress: string,
  usersAddress: string,
  tradeFactoryBaseStorageAddress: string,
  weth: string,
  usdc: string,
  usdt: string,
  referralRegistryAddress: string,
  stakedCSXAddress: string,
  buyAssistoorAddress: string
): Promise<string> => {
  const CSXTradeFactory = await hre.ethers.getContractFactory("CSXTradeFactory");
  
  const csxTradeFactory: any = await CSXTradeFactory.deploy(
    keepersAddress,
    usersAddress,
    tradeFactoryBaseStorageAddress,
    '26',
    {weth, usdc, usdt} as PaymentTokensStruct,
    referralRegistryAddress,
    stakedCSXAddress,
    buyAssistoorAddress
  );

  await csxTradeFactory.waitForDeployment();
  return csxTradeFactory.target;
};

export default deployCSXTradeFactory;
