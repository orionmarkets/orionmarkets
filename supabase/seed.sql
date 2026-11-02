-- =============================================================================
-- ORION PROTOCOL: LOCAL DEVELOPMENT FIXTURE
--
-- Illustrative markets and vaults so the UI has something to render on localhost.
-- The numbers are NOT real: never load this file into a testnet or mainnet database.
-- There, the indexer (pnpm rh:indexer:sync / pons:indexer:sync) writes the real rows.
-- Applied by `pnpm localnet:up`. Only the five catalog assets are seeded.
-- =============================================================================

TRUNCATE TABLE auto_protect_configs, activity_logs, user_positions, vaults, markets CASCADE;

INSERT INTO markets (
    slug, network, asset_symbol, name, category, collateral_token, debt_token, pair_address,
    mark_price, max_ltv, liquidation_ltv, max_leverage, supply_apy, borrow_apr,
    total_supply_usd, total_borrow_usd, available_liquidity_usd, risk_tier, status
) VALUES
('tsla-usdg-testnet', 'TESTNET', 'TSLA', 'Tesla / USDG', 'Equities', 'TSLA', 'USDG', '0x45ca70e8f78c14773338d9c1a771c3887ede1a1b', 215.80, 50.0, 60.0, 2.0, 7.20, 10.10, 810000.00, 500000.00, 310000.00, 'Tier B', 'NORMAL'),
('amzn-usdg-testnet', 'TESTNET', 'AMZN', 'Amazon.com / USDG', 'Equities', 'AMZN', 'USDG', '0x0000000000000000000000000000000000000000', 185.30, 60.0, 70.0, 2.5, 5.10, 7.80, 750000.00, 380000.00, 370000.00, 'Tier A', 'NORMAL'),
('pltr-usdg-testnet', 'TESTNET', 'PLTR', 'Palantir / USDG', 'Equities', 'PLTR', 'USDG', '0x0000000000000000000000000000000000000000', 150.40, 50.0, 60.0, 2.0, 6.40, 9.30, 540000.00, 290000.00, 250000.00, 'Tier B', 'NORMAL'),
('nvda-usdg-testnet', 'TESTNET', 'NVDA', 'NVIDIA / USDG', 'Equities', 'NVDA', 'USDG', '0x0000000000000000000000000000000000000000', 250.00, 60.0, 70.0, 2.5, 5.80, 8.20, 1400000.00, 740000.00, 660000.00, 'Tier A', 'NORMAL'),
('amd-usdg-testnet', 'TESTNET', 'AMD', 'AMD / USDG', 'Equities', 'AMD', 'USDG', '0x0000000000000000000000000000000000000000', 160.20, 55.0, 65.0, 2.0, 6.10, 8.90, 480000.00, 230000.00, 250000.00, 'Tier B', 'NORMAL');

INSERT INTO vaults (
    slug, network, vault_address, name, symbol, asset_symbol,
    apy, tvl_usd, utilization_rate, risk_tier, allocations
) VALUES
(
    'orion-usdg-vault-testnet', 'TESTNET', '0x1111111111111111111111111111111111111111',
    'Orion USDG Yield Vault', 'oUSDG', 'USDG', 7.15, 4850000.00, 78.4, 'Conservative',
    '[{"symbol":"NVDA","weightPercent":30},{"symbol":"TSLA","weightPercent":20},{"symbol":"AMZN","weightPercent":20},{"symbol":"PLTR","weightPercent":10},{"symbol":"AMD","weightPercent":10},{"symbol":"Cash Reserve","weightPercent":10}]'::jsonb
);

-- No demo positions or activity: those come from real wallets and the indexer.
