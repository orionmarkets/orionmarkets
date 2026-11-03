-- =============================================================================
-- ORION PROTOCOL: MAINNET CATALOG ROW (Robinhood Chain 4663)
--
-- The Earn page lists rows of the `vaults` table for the active network, and no service writes that table,
-- so mainnet needs this one row. Run it once in the MAINNET Supabase project (SQL editor), after the
-- migrations in supabase/migrations. Never run supabase/seed.sql there: its numbers are illustrative.
--
-- apy, tvl_usd and utilization_rate start at 0 on purpose: nothing has been deposited yet, and the row
-- must not show figures the chain does not back. Update them from real vault data once deposits exist.
-- vault_address is the OrionVault proxy in packages/contracts/deployments/mainnet-4663.json, passed in by psql
-- (the statement fails without it, so no address that is not ORION's can be written):
--   psql "$MAINNET_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -v vault_address="$(node -p 'require("./packages/contracts/deployments/mainnet-4663.json").addresses.vault')" \
--     -f supabase/mainnet-catalog.sql
-- =============================================================================

INSERT INTO vaults (
    slug, network, vault_address, name, symbol, asset_symbol,
    apy, tvl_usd, utilization_rate, risk_tier, allocations
) VALUES (
    'orion-usdg-vault-mainnet', 'MAINNET', :'vault_address',
    'Orion USDG Yield Vault', 'oUSDG', 'USDG', 0, 0, 0, 'Conservative', '[]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    vault_address = EXCLUDED.vault_address,
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    asset_symbol = EXCLUDED.asset_symbol,
    updated_at = NOW();
