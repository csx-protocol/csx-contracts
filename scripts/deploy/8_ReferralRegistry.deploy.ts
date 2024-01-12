import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ReferralRegistry } from "../../typechain-types";

const deployReferralRegistry = async (
  hre: HardhatRuntimeEnvironment,
  _keepers: string,
  _weth: string,
  _usdc: string,
  _usdt: string
): Promise<ReferralRegistry> => {
  const ReferralRegistry = await hre.ethers.getContractFactory(
    "ReferralRegistry"
  );
  const referralRegistry: ReferralRegistry = await ReferralRegistry.deploy(
    _keepers,
    _weth,
    _usdc,
    _usdt
  );
  await referralRegistry.waitForDeployment();
  return referralRegistry;
};

export default deployReferralRegistry;
