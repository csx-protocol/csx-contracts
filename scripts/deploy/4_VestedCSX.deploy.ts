import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployVestedCSX = async (
  hre: HardhatRuntimeEnvironment,
  escrowedCSXAddress: string,
  stakedCSXAddress: string,
  wethAddress: string,
  usdcAddress: string,
  csxTokenAddress: string,
  usdtAddress: string
): Promise<string> => {
  const VestedCSX = await hre.ethers.getContractFactory("VestedCSX");
  const vestedCSX: any = await VestedCSX.deploy(
    escrowedCSXAddress,
    stakedCSXAddress,
    wethAddress,
    usdcAddress,
    csxTokenAddress,
    usdtAddress
  );
  await vestedCSX.waitForDeployment();
  return vestedCSX.target;
};

export default deployVestedCSX;
