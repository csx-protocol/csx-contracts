import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { EscrowedCSX } from '../../typechain-types';

const deployEscrowedCSX = async (hre: HardhatRuntimeEnvironment, csxTokenAddress: string): Promise<EscrowedCSX> => {
  const EscrowedCSX = await hre.ethers.getContractFactory("EscrowedCSX");
  const escrowedCSX: any = await EscrowedCSX.deploy(csxTokenAddress);
  await escrowedCSX.waitForDeployment();
  return escrowedCSX;
};

export default deployEscrowedCSX;
