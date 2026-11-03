// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VerifiedFeedOracle} from "../src/oracle/VerifiedFeedOracle.sol";
import {IPonsFactory} from "../src/ponsperp/IPonsFactory.sol";
import {PonsV4TwapOracle} from "../src/ponsperp/PonsV4TwapOracle.sol";
import {PonsLiquidityVault} from "../src/ponsperp/PonsLiquidityVault.sol";
import {PonsPerpManager} from "../src/ponsperp/PonsPerpManager.sol";

/// @notice Runs against Robinhood Chain mainnet state with ORION contracts deployed on the fork. Skipped unless
/// PONS_FORK_RPC is set; the ORION token test also needs ORION_PONS_TOKEN (the ORION token's Pons address):
/// PONS_FORK_RPC=https://rpc.mainnet.chain.robinhood.com forge test --match-contract PonsPerpMainnetFork
contract PonsPerpMainnetForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant PONS_HOOK = 0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044;
    address constant ETH_USD_FEED = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant OWNER = 0xd09D9c87ECfe008B4D6D3cEbeAd25103c16d9a7C;
    address constant GRADUATED = 0x7dbf38976f6D3b9c529e7D9484A71898B409eE6a; // ZZZ, a third-party graduated Pons token

    address orionToken;
    VerifiedFeedOracle feedOracle;
    PonsV4TwapOracle oracle;
    PonsLiquidityVault vault;
    PonsPerpManager manager;

    function setUp() public {
        string memory rpc = vm.envOr("PONS_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        orionToken = vm.envOr("ORION_PONS_TOKEN", address(0));

        // ORION's own feed oracle on the fork, priced from the Chainlink ETH / USD feed.
        VerifiedFeedOracle.FeedInput[] memory feeds = new VerifiedFeedOracle.FeedInput[](1);
        feeds[0] = VerifiedFeedOracle.FeedInput(WETH, ETH_USD_FEED, "ETH / USD", 26 hours, 100e18, 100_000e18, false);
        feedOracle = VerifiedFeedOracle(
            address(
                new ERC1967Proxy(
                    address(new VerifiedFeedOracle()),
                    abi.encodeCall(VerifiedFeedOracle.initialize, (OWNER, block.chainid, address(0), 0, feeds))
                )
            )
        );

        oracle = PonsV4TwapOracle(
            address(
                new ERC1967Proxy(
                    address(new PonsV4TwapOracle()),
                    abi.encodeCall(
                        PonsV4TwapOracle.initialize, (OWNER, POOL_MANAGER, PONS_FACTORY, PONS_HOOK, address(feedOracle), WETH)
                    )
                )
            )
        );
        vault = PonsLiquidityVault(
            address(
                new ERC1967Proxy(
                    address(new PonsLiquidityVault()),
                    abi.encodeCall(PonsLiquidityVault.initialize, (IERC20(USDG), "Orion Pons LP", "lpPONS", OWNER))
                )
            )
        );
        manager = PonsPerpManager(
            address(
                new ERC1967Proxy(
                    address(new PonsPerpManager()),
                    abi.encodeCall(PonsPerpManager.initialize, (OWNER, USDG, address(oracle), address(vault), PONS_FACTORY))
                )
            )
        );
        vm.startPrank(OWNER);
        vault.setManager(address(manager));
        oracle.listAsset(GRADUATED);
        if (orionToken != address(0)) oracle.listAsset(orionToken);
        vm.stopPrank();
    }

    function testGraduatedPoolPricesInUsd() public {
        for (uint256 i; i < 9; ++i) {
            oracle.poke(GRADUATED);
            vm.warp(vm.getBlockTimestamp() + 4 minutes);
        }
        (uint256 spot, uint256 twap) = oracle.update(GRADUATED);
        emit log_named_decimal_uint("ZZZ spot USD", spot, 18);
        assertGt(spot, 0);
        assertEq(spot, twap); // the pool did not move on the fork
    }

    function testOrionListedButNotOpenUntilGraduation() public {
        if (orionToken == address(0)) {
            vm.skip(true);
            return;
        }
        IPonsFactory.LaunchedToken memory launch = IPonsFactory(PONS_FACTORY).getLaunchedToken(orionToken);
        (bytes32 poolId,,,,,) = oracle.assets(orionToken);
        assertEq(poolId, keccak256(abi.encode(address(0), orionToken, launch.poolFee, launch.tickSpacing, PONS_HOOK)));
        if (launch.phase == 2) return; // graduated since this test was written
        vm.expectRevert(PonsV4TwapOracle.PoolNotInitialized.selector);
        oracle.poke(orionToken);

        vm.startPrank(OWNER);
        manager.setMarket(orionToken, 20_000, 1_000, 20e6, 100e6);
        manager.setOpeningPaused(false);
        vm.stopPrank();
        vm.expectRevert(PonsPerpManager.NotGraduated.selector);
        manager.openPosition(orionToken, true, 1e6, 20_000);
    }
}
