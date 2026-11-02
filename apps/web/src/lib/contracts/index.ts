import addresses from './addresses.json';
import PonsLeverageRegistryArtifact from './PonsLeverageRegistry.json';
import PonsOracleRouterArtifact from './PonsOracleRouter.json';
import LeveragePositionManagerArtifact from './LeveragePositionManager.json';
import TestnetERC20Artifact from './TestnetERC20.json';

/** `addresses.json` is the anvil deployment: valid on this chain only. */
export const LOCALNET_CHAIN_ID = 31337;
export const CONTRACT_ADDRESSES = addresses;

export const PonsLeverageRegistryABI = PonsLeverageRegistryArtifact.abi;
export const PonsOracleRouterABI = PonsOracleRouterArtifact.abi;
export const LeveragePositionManagerABI = LeveragePositionManagerArtifact.abi;
export const ERC20ABI = TestnetERC20Artifact.abi;
