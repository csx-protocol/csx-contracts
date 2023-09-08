import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployEscrowedCSX = async (hre: HardhatRuntimeEnvironment, csxTokenAddress: string): Promise<string> => {
  const EscrowedCSX = await hre.ethers.getContractFactory("EscrowedCSX");
  const escrowedCSX: any = await EscrowedCSX.deploy(csxTokenAddress);
  await escrowedCSX.waitForDeployment();
  return escrowedCSX.target;
};

export default deployEscrowedCSX;
