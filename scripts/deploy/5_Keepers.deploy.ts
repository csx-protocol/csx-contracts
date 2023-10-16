import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Keepers } from '../../typechain-types';
import { ethers } from 'hardhat';

const ORACLE_NODE_ADDRESS = process.env.ORACLE_NODE_ADDRESS || "";

const deployKeepers = async (hre: HardhatRuntimeEnvironment): Promise<Keepers> => {
  const network = await ethers.provider.getNetwork();
  // get the address deployer
  const [deployer] = await ethers.getSigners();

  const COUNCIL_ADDRESS = network.name === "hardhat" ? deployer: process.env.COUNCIL_ADDRESS || "";

  const Keepers = await hre.ethers.getContractFactory("Keepers");
  const keepers: any = await Keepers.deploy(COUNCIL_ADDRESS, ORACLE_NODE_ADDRESS);
  await keepers.waitForDeployment();
  return keepers;
};

export default deployKeepers;
