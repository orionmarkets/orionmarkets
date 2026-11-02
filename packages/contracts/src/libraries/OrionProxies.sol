// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrionMarketRegistry} from "../registry/OrionMarketRegistry.sol";
import {OrionPair} from "../core/OrionPair.sol";
import {OrionRouter} from "../routers/OrionRouter.sol";
import {LeverageRouter} from "../routers/LeverageRouter.sol";
import {ShortRouter} from "../routers/ShortRouter.sol";
import {AutoProtectModule} from "../modules/AutoProtectModule.sol";
import {OrionVault} from "../vaults/OrionVault.sol";
import {VerifiedFeedOracle} from "../oracle/VerifiedFeedOracle.sol";
import {MarginRouter} from "../trading/MarginRouter.sol";

/// @title OrionProxies
/// @notice Deploys each Orion contract as an implementation plus an ERC1967 UUPS proxy that is
/// initialized in the same transaction, so no proxy is ever left uninitialized.
/// @dev The `*At` variants take an existing implementation, letting several proxies share one.
library OrionProxies {
    function _proxy(address implementation, bytes memory init) private returns (address) {
        return address(new ERC1967Proxy(implementation, init));
    }

    function registry(address owner) internal returns (OrionMarketRegistry) {
        return OrionMarketRegistry(
            _proxy(address(new OrionMarketRegistry()), abi.encodeCall(OrionMarketRegistry.initialize, (owner)))
        );
    }

    function lendingRouter(address owner) internal returns (OrionRouter) {
        return OrionRouter(_proxy(address(new OrionRouter()), abi.encodeCall(OrionRouter.initialize, (owner))));
    }

    function leverageRouter(address owner) internal returns (LeverageRouter) {
        return LeverageRouter(_proxy(address(new LeverageRouter()), abi.encodeCall(LeverageRouter.initialize, (owner))));
    }

    function shortRouter(address owner) internal returns (ShortRouter) {
        return ShortRouter(_proxy(address(new ShortRouter()), abi.encodeCall(ShortRouter.initialize, (owner))));
    }

    function autoProtect(address owner) internal returns (AutoProtectModule) {
        return AutoProtectModule(
            _proxy(address(new AutoProtectModule()), abi.encodeCall(AutoProtectModule.initialize, (owner)))
        );
    }

    function vault(
        IERC20 asset,
        string memory name,
        string memory symbol,
        string memory slug,
        string memory riskTier,
        address owner
    ) internal returns (OrionVault) {
        return OrionVault(
            _proxy(
                address(new OrionVault()),
                abi.encodeCall(OrionVault.initialize, (asset, name, symbol, slug, riskTier, owner))
            )
        );
    }

    function oracle(
        address owner,
        uint256 expectedChainId,
        address sequencer,
        uint256 gracePeriod,
        VerifiedFeedOracle.FeedInput[] memory inputs
    ) internal returns (VerifiedFeedOracle) {
        return oracleAt(address(new VerifiedFeedOracle()), owner, expectedChainId, sequencer, gracePeriod, inputs);
    }

    function oracleAt(
        address implementation,
        address owner,
        uint256 expectedChainId,
        address sequencer,
        uint256 gracePeriod,
        VerifiedFeedOracle.FeedInput[] memory inputs
    ) internal returns (VerifiedFeedOracle) {
        return VerifiedFeedOracle(
            _proxy(
                implementation,
                abi.encodeCall(VerifiedFeedOracle.initialize, (owner, expectedChainId, sequencer, gracePeriod, inputs))
            )
        );
    }

    function pair(
        bytes32 marketId,
        address collateral,
        address debt,
        address priceOracle,
        address marketRegistry,
        address owner
    ) internal returns (OrionPair) {
        return pairAt(address(new OrionPair()), marketId, collateral, debt, priceOracle, marketRegistry, owner);
    }

    function pairAt(
        address implementation,
        bytes32 marketId,
        address collateral,
        address debt,
        address priceOracle,
        address marketRegistry,
        address owner
    ) internal returns (OrionPair) {
        return OrionPair(
            _proxy(
                implementation,
                abi.encodeCall(
                    OrionPair.initialize, (marketId, collateral, debt, priceOracle, marketRegistry, owner)
                )
            )
        );
    }

    function marginRouter(
        address stock,
        address stable,
        address longPair,
        address shortPair,
        address pool,
        address owner
    ) internal returns (MarginRouter) {
        return MarginRouter(
            _proxy(
                address(new MarginRouter()),
                abi.encodeCall(MarginRouter.initialize, (stock, stable, longPair, shortPair, pool, owner))
            )
        );
    }
}
