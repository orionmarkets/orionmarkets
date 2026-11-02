// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../src/tokens/TestnetERC20.sol";
import "../src/oracle/CompositeSanityOracle.sol";
import "../src/registry/OrionMarketRegistry.sol";
import "../src/core/OrionPair.sol";
import "../src/libraries/OrionProxies.sol";

/// @dev A 10x market: 94% max LTV, 97% liquidation LTV, 1% liquidation bonus.
contract HighLeverageTest is Test {
    address admin = address(0xAD);
    address alice = address(0xA1);
    address bob = address(0xB2);

    TestnetERC20 stock;
    TestnetERC20 usdg;
    CompositeSanityOracle oracle;
    OrionMarketRegistry registry;
    OrionPair pair;
    bytes32 marketId;

    function setUp() public {
        vm.startPrank(admin);
        stock = new TestnetERC20("Stock", "TSLA", 18, 1_000_000e18, admin);
        usdg = new TestnetERC20("Global Dollar", "USDG", 18, 10_000_000e18, admin);
        oracle = new CompositeSanityOracle(admin);
        oracle.setPrice(address(stock), 250e18);
        oracle.setPrice(address(usdg), 1e18);
        registry = OrionProxies.registry(admin);
        marketId = keccak256(abi.encodePacked("tsla-usdg", address(stock), address(usdg)));
        pair = OrionProxies.pair(marketId, address(stock), address(usdg), address(oracle), address(registry), admin);
        // Launch parameters (5% bonus, 50/65) are replaced by the 10x ones below.
        registry.addMarket(
            "tsla-usdg", address(stock), address(usdg), address(pair), address(oracle),
            OrionMarketRegistry.RiskTier.Experimental, 5000, 6500, 10_000, 1_000_000e18, 1_000_000e18
        );
        registry.updateRiskTier(marketId, OrionMarketRegistry.RiskTier.Experimental, 9400, 9700, 100_000);
        pair.setLiquidationBonus(100);
        usdg.transfer(address(pair), 100_000e18);
        usdg.transfer(bob, 50_000e18);
        stock.transfer(alice, 100e18);
        vm.stopPrank();
    }

    function testBonusStartsAtFivePercentAndOnlyOwnerCanChangeIt() public {
        OrionPair fresh =
            OrionProxies.pair(marketId, address(stock), address(usdg), address(oracle), address(registry), admin);
        assertEq(fresh.liquidationBonusBps(), 500);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, alice));
        pair.setLiquidationBonus(100);
        assertEq(pair.liquidationBonusBps(), 100);
    }

    function testBonusBoundsAndHeadroom() public {
        vm.startPrank(admin);
        vm.expectRevert("Pair: Invalid liquidation bonus");
        pair.setLiquidationBonus(49);
        vm.expectRevert("Pair: Invalid liquidation bonus");
        pair.setLiquidationBonus(1001);
        // 97% * 1.05 > 100%: a 5% bonus cannot be paid from a 97% liquidation LTV.
        vm.expectRevert("Pair: Bonus exceeds LTV headroom");
        pair.setLiquidationBonus(500);
        // 97% * 1.03 = 99.9% still fits; 97% * 1.04 does not.
        pair.setLiquidationBonus(300);
        vm.expectRevert("Pair: Bonus exceeds LTV headroom");
        pair.setLiquidationBonus(400);
        vm.stopPrank();
    }

    /// 10 stock at $250 = $2,500 collateral; 10x opens at ~90% LTV, so $2,260 of debt is within the 94% cap.
    function _openLong(uint256 debt) internal {
        vm.startPrank(alice);
        stock.approve(address(pair), 10e18);
        pair.depositCollateral(10e18);
        pair.borrow(debt);
        vm.stopPrank();
    }

    function testTenXLongOpensAndOverCapReverts() public {
        _openLong(2260e18);
        (, uint256 debt,, uint256 hf) = pair.getPosition(alice);
        assertEq(debt, 2260e18);
        assertGt(hf, 10_000); // 2500 * 97% / 2260 > 1: healthy

        vm.startPrank(alice);
        vm.expectRevert("Pair: Borrow exceeds Max LTV limit");
        pair.borrow(100e18); // 2360 / 2500 = 94.4% > 94%
        vm.stopPrank();
    }

    function testSmallAdverseMoveIsNotLiquidatableButAnEightPercentDropIs() public {
        _openLong(2260e18);
        vm.prank(admin);
        oracle.forcePrice(address(stock), 245e18); // -2%: 2260 / 2450 = 92.2% < 97%
        assertFalse(pair.isLiquidatable(alice));
        vm.prank(admin);
        oracle.forcePrice(address(stock), 230e18); // -8%: 2260 / 2300 = 98.3% > 97%
        assertTrue(pair.isLiquidatable(alice));
    }

    function _liquidate(uint256 repay) internal {
        vm.startPrank(bob);
        usdg.approve(address(pair), repay);
        pair.liquidate(alice, repay);
        vm.stopPrank();
    }

    function testLiquidationAtNinetyEightPercentClearsDebtWithOnePercentBonus() public {
        _openLong(2260e18);
        vm.prank(admin);
        oracle.forcePrice(address(stock), 230e18); // collateral $2,300, debt $2,260 (98.3% LTV)
        uint256 usdgBefore = usdg.balanceOf(bob);
        _liquidate(2260e18);

        (, uint256 debt,,) = pair.getPosition(alice);
        assertEq(debt, 0, "debt fully repaid");
        assertEq(usdgBefore - usdg.balanceOf(bob), 2260e18);
        // Seized: $2,260 * 1.01 = $2,282.60 of stock at $230; the rest stays with the borrower.
        assertApproxEqRel(stock.balanceOf(bob) * 230, 2282.6e18, 1e12);
        (uint256 left,,,) = pair.getPosition(alice);
        assertEq(left, 10e18 - stock.balanceOf(bob));
        assertGt(left, 0);
    }

    function testBeyondOnePercentUnderwaterOnlyTheCollateralBackedDebtIsRepaid() public {
        _openLong(2260e18);
        vm.prank(admin);
        oracle.forcePrice(address(stock), 220e18); // collateral $2,200 < debt $2,260 * 1.01: bad debt of ~$82

        _liquidate(2260e18);

        (uint256 collateral, uint256 debt,,) = pair.getPosition(alice);
        assertEq(collateral, 0, "all collateral seized");
        // Repaid 2200 / 1.01 = 2178.22; the remaining 81.78 is the vault's loss.
        assertApproxEqRel(debt, 2260e18 - uint256(2200e18) * 100 / 101, 1e12);
    }

    function testFuzzLiquidationNeverSeizesMoreThanCollateral(uint256 debtUsd, uint256 price) public {
        debtUsd = bound(debtUsd, 100e18, 2350e18);
        price = bound(price, 150e18, 250e18);
        _openLong(debtUsd);
        vm.prank(admin);
        oracle.forcePrice(address(stock), price);
        if (!pair.isLiquidatable(alice)) return;
        _liquidate(debtUsd);
        assertLe(stock.balanceOf(bob), 10e18);
        assertEq(stock.balanceOf(address(pair)), 10e18 - stock.balanceOf(bob));
    }
}
