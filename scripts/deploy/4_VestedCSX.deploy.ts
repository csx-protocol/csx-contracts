import { HardhatRuntimeEnvironment } from "hardhat/types";
import { VestedCSX } from "../../typechain-types";

const deployVestedCSX = async (
  hre: HardhatRuntimeEnvironment,
  escrowedCSXAddress: string,
  stakedCSXAddress: string,
  wethAddress: string,
  usdcAddress: string,
  csxTokenAddress: string,
  usdtAddress: string
): Promise<VestedCSX> => {
  const VestedCSX = await hre.ethers.getContractFactory("VestedCSX");
  const vestedCSX: VestedCSX = await VestedCSX.deploy(
    escrowedCSXAddress,
    stakedCSXAddress,
    wethAddress,
    usdcAddress,
    csxTokenAddress,
    usdtAddress
  );
  await vestedCSX.waitForDeployment();
  return vestedCSX;
};

export default deployVestedCSX;
