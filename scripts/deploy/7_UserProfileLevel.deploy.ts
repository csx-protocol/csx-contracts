import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployUserProfileLevel = async (hre: HardhatRuntimeEnvironment, csxTokenAddress: string): Promise<string> => {
  const UserProfileLevel = await hre.ethers.getContractFactory("UserProfileLevel");
  const userProfileLevel: any = await UserProfileLevel.deploy(csxTokenAddress);
  await userProfileLevel.waitForDeployment();
  return userProfileLevel.target;
};

export default deployUserProfileLevel;
