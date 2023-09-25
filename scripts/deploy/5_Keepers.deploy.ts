import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Keepers } from '../../typechain-types';

const COUNCIL_ADDRESS = process.env.COUNCIL_ADDRESS || "";
const ORACLE_NODE_ADDRESS = process.env.ORACLE_NODE_ADDRESS || "";

const deployKeepers = async (hre: HardhatRuntimeEnvironment): Promise<Keepers> => {
  const Keepers = await hre.ethers.getContractFactory("Keepers");
  const keepers: any = await Keepers.deploy(COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
  await keepers.waitForDeployment();
  return keepers;
};

export default deployKeepers;
