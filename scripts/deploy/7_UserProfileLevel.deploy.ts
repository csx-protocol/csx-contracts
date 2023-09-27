import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { UserProfileLevel } from '../../typechain-types';

const deployUserProfileLevel = async (hre: HardhatRuntimeEnvironment, csxTokenAddress: string, usersContractAddress: string): Promise<UserProfileLevel> => {
  const UserProfileLevel = await hre.ethers.getContractFactory("UserProfileLevel");
  const userProfileLevel: any = await UserProfileLevel.deploy(csxTokenAddress, usersContractAddress);
  await userProfileLevel.waitForDeployment();
  return userProfileLevel;
};

export default deployUserProfileLevel;
