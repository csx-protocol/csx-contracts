import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { CSXToken } from '../../typechain-types';

const name = "CSXToken";

const deployCSXToken = async (hre: HardhatRuntimeEnvironment): Promise<CSXToken> => {
  const Token = await hre.ethers.getContractFactory(name);
  const token:any = await Token.deploy();
  await token.waitForDeployment();
  return token;
};

export default deployCSXToken;
