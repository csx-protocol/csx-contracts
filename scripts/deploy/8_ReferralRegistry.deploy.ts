import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployReferralRegistry = async (hre: HardhatRuntimeEnvironment): Promise<string> => {
  const ReferralRegistry = await hre.ethers.getContractFactory("ReferralRegistry");
  const referralRegistry:any = await ReferralRegistry.deploy();
  await referralRegistry.waitForDeployment();
  return referralRegistry.target;
};

export default deployReferralRegistry;
