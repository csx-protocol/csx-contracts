import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ReferralRegistry } from '../../typechain-types';

const deployReferralRegistry = async (hre: HardhatRuntimeEnvironment): Promise<ReferralRegistry> => {
  const ReferralRegistry = await hre.ethers.getContractFactory("ReferralRegistry");
  const referralRegistry:any = await ReferralRegistry.deploy();
  await referralRegistry.waitForDeployment();
  return referralRegistry;
};

export default deployReferralRegistry;
