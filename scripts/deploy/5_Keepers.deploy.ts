import { HardhatRuntimeEnvironment } from 'hardhat/types';

const COUNCIL_ADDRESS = process.env.COUNCIL_ADDRESS || "";
const ORACLE_NODE_ADDRESS = process.env.ORACLE_NODE_ADDRESS || "";

const deployKeepers = async (hre: HardhatRuntimeEnvironment): Promise<string> => {
  const Keepers = await hre.ethers.getContractFactory("Keepers");
  const keepers: any = await Keepers.deploy(COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
  await keepers.waitForDeployment();
  return keepers.target;
};

export default deployKeepers;
