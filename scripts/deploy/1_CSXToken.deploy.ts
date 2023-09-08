import { HardhatRuntimeEnvironment } from 'hardhat/types';

const name = "CSXToken";

const deployCSXToken = async (hre: HardhatRuntimeEnvironment): Promise<string> => {
  const Token = await hre.ethers.getContractFactory(name);
  const token:any = await Token.deploy();
  await token.waitForDeployment();
  return token.target;
};

export default deployCSXToken;
