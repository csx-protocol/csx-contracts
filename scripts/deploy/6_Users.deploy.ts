import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Users } from '../../typechain-types';

const deployUsers = async (hre: HardhatRuntimeEnvironment, keepersAddress: string): Promise<Users> => {
  const Users = await hre.ethers.getContractFactory("Users");
  const users: any = await Users.deploy(keepersAddress);
  await users.waitForDeployment();
  return users;
};

export default deployUsers;
