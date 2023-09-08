import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployUsers = async (hre: HardhatRuntimeEnvironment, keepersAddress: string): Promise<string> => {
  const Users = await hre.ethers.getContractFactory("Users");
  const users: any = await Users.deploy(keepersAddress);
  await users.waitForDeployment();
  return users.target;
};

export default deployUsers;
