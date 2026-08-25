-- Seed the 8 demo agents shown on the Aether homepage as real rows.
--
-- Why this exists: the homepage falls back to hardcoded demo data
-- (apps/web/lib/seedAgents.ts) whenever listAgents() finds nothing in
-- Supabase, purely so the homepage isn't empty before the ERC-8004 indexer
-- has run. But that fallback data was never written to the database, so
-- "Hire agent" / "Compare" / clicking into a passport on those cards led
-- to real routes querying real (empty) tables — a dead end.
--
-- This script inserts the same 8 agents as ACTUAL rows, explicitly marked
-- data_source = 'seeded' so the existing provenance system keeps showing
-- the "Seeded (demo)" / "Demo data" labels everywhere it already does
-- (AgentListCard, PassportHero, TrustPanel). Nothing about this pretends
-- to be a real on-chain agent — it just makes the demo agents real enough
-- that every button actually resolves to something.
--
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query),
-- or via the CLI: supabase db execute -f scripts/seed/seed_demo_agents.sql
--
-- Safe to re-run: every insert is keyed on `slug`, which is unique, and
-- uses ON CONFLICT DO NOTHING so re-running this script doesn't duplicate
-- rows or clobber data if you've since edited these agents by hand.

begin;

-- 1. Sentinel LiqGuard
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9001', 97, '0x1111111111111111111111111111111111aaa1', 'Sentinel LiqGuard',
    'sentinel-liq-guard',
    'Watches lending positions across Venus and PancakeSwap and alerts before health factor breaches a set threshold.',
    'agent_provided', 'risk', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 4218, 4152, 66, 98.4, 0.34, now() - interval '2 minutes' from a;

with a as (select id from agents where slug = 'sentinel-liq-guard')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Health factor monitoring','Liquidation alerts','Multi-wallet tracking']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'sentinel-liq-guard')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, p, 'agent_provided' from a, unnest(array['Venus','PancakeSwap']) as p
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = p
);

with a as (select id from agents where slug = 'sentinel-liq-guard')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/sentinel-liq-guard/health', 'health', 'online', 'online', 340, now() - interval '2 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 2. Yield Router Alpha
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9002', 97, '0x1111111111111111111111111111111111aaa2', 'Yield Router Alpha',
    'yield-router-alpha',
    'Rebalances stablecoin deposits across the highest-APY vaults it''s whitelisted for, reporting every move on-chain.',
    'agent_provided', 'yield', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 2903, 2790, 113, 96.1, 0.51, now() - interval '14 minutes' from a;

with a as (select id from agents where slug = 'yield-router-alpha')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['APY comparison','Auto-compounding','Gas-aware rebalancing']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'yield-router-alpha')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, p, 'agent_provided' from a, unnest(array['PancakeSwap','Venus']) as p
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = p
);

with a as (select id from agents where slug = 'yield-router-alpha')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/yield-router-alpha/health', 'health', 'online', 'online', 510, now() - interval '14 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 3. PancakeFlow
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9003', 97, '0x1111111111111111111111111111111111aaa3', 'PancakeFlow',
    'pancake-flow',
    'Executes multi-hop PancakeSwap trades with slippage guards and a pre-flight simulation before every swap.',
    'agent_provided', 'pancakeswap', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 6710, 6524, 186, 97.2, 0.28, now() - interval '6 minutes' from a;

with a as (select id from agents where slug = 'pancake-flow')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Multi-hop routing','Slippage protection','Trade simulation']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'pancake-flow')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, 'PancakeSwap', 'agent_provided' from a
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = 'PancakeSwap'
);

with a as (select id from agents where slug = 'pancake-flow')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/pancake-flow/health', 'health', 'online', 'online', 280, now() - interval '6 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 4. WalletWatch
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9004', 97, '0x1111111111111111111111111111111111aaa4', 'WalletWatch',
    'wallet-watch',
    'Streams real-time balance and approval-change alerts for any wallet you point it at, across BNB Chain tokens.',
    'agent_provided', 'monitoring', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 8340, 8266, 74, 99.1, 0.19, now() - interval '41 minutes' from a;

with a as (select id from agents where slug = 'wallet-watch')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Balance alerts','Approval monitoring','Anomaly detection']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'wallet-watch')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, 'BEP-20', 'agent_provided' from a
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = 'BEP-20'
);

with a as (select id from agents where slug = 'wallet-watch')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/wallet-watch/health', 'health', 'online', 'online', 190, now() - interval '41 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 5. Arb Scout
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9005', 97, '0x1111111111111111111111111111111111aaa5', 'Arb Scout',
    'arb-scout',
    'Scans DEX pools for price divergence and surfaces arbitrage opportunities above a configurable profit floor.',
    'agent_provided', 'trading', 'unverified', true, false, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 1542, 1409, 133, 91.4, 0.62, now() - interval '1 hour' from a;

with a as (select id from agents where slug = 'arb-scout')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Price divergence scanning','Profit estimation','Route comparison']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'arb-scout')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, p, 'agent_provided' from a, unnest(array['PancakeSwap','Biswap']) as p
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = p
);

with a as (select id from agents where slug = 'arb-scout')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/arb-scout/health', 'health', 'degraded', 'degraded', 620, now() - interval '1 hour' from a
on conflict (agent_id, endpoint) do nothing;

-- 6. AuditLens
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9006', 97, '0x1111111111111111111111111111111111aaa6', 'AuditLens',
    'audit-lens',
    'Runs static checks against a contract address and flags common vulnerability patterns before you interact with it.',
    'agent_provided', 'risk', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 3105, 3072, 33, 98.9, 0.89, now() - interval '22 minutes' from a;

with a as (select id from agents where slug = 'audit-lens')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Static analysis','Ownership checks','Honeypot detection']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'audit-lens')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, p, 'agent_provided' from a, unnest(array['BEP-20','BEP-721']) as p
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = p
);

with a as (select id from agents where slug = 'audit-lens')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/audit-lens/health', 'health', 'online', 'online', 890, now() - interval '22 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 7. GasSense
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9007', 97, '0x1111111111111111111111111111111111aaa7', 'GasSense',
    'gas-sense',
    'Predicts short-term gas price movement on BNB Chain and times transaction submission to the cheapest window.',
    'agent_provided', 'monitoring', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 5920, 5312, 608, 89.7, 0.21, now() - interval '3 minutes' from a;

with a as (select id from agents where slug = 'gas-sense')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Gas forecasting','Transaction timing','Cost reporting']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'gas-sense')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, 'BEP-20', 'agent_provided' from a
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = 'BEP-20'
);

with a as (select id from agents where slug = 'gas-sense')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/gas-sense/health', 'health', 'online', 'online', 210, now() - interval '3 minutes' from a
on conflict (agent_id, endpoint) do nothing;

-- 8. VaultCompound
with a as (
  insert into agents (agent_id, chain_id, wallet_address, name, slug, description,
    description_provenance, category, status, identity_verified, endpoint_verified,
    performance_verified, data_source)
  values ('9008', 97, '0x1111111111111111111111111111111111aaa8', 'VaultCompound',
    'vault-compound',
    'Auto-harvests and re-stakes farming rewards on a schedule you set, netting out gas cost before it compounds.',
    'agent_provided', 'yield', 'online', true, true, true, 'seeded')
  on conflict (slug) do nothing
  returning id
)
insert into agent_performance (agent_id, total_tasks, successful_tasks, failed_tasks, success_rate, average_execution_time, last_active)
select id, 2210, 2095, 115, 94.8, 0.46, now() - interval '9 minutes' from a;

with a as (select id from agents where slug = 'vault-compound')
insert into agent_capabilities (agent_id, capability, provenance)
select id, cap, 'agent_provided' from a, unnest(array['Auto-harvest','Reward compounding','Gas-cost netting']) as cap
on conflict (agent_id, capability) do nothing;

with a as (select id from agents where slug = 'vault-compound')
insert into agent_protocols (agent_id, protocol, provenance)
select a.id, 'PancakeSwap', 'agent_provided' from a
where not exists (
  select 1 from agent_protocols existing where existing.agent_id = a.id and existing.protocol = 'PancakeSwap'
);

with a as (select id from agents where slug = 'vault-compound')
insert into agent_endpoints (agent_id, endpoint, endpoint_type, status, health_status, response_time_ms, last_checked)
select id, 'https://demo.aether.local/agents/vault-compound/health', 'health', 'online', 'online', 460, now() - interval '9 minutes' from a
on conflict (agent_id, endpoint) do nothing;

commit;

-- Sanity check — should return 8 rows once this has run successfully.
select slug, name, category, data_source from agents where data_source = 'seeded' order by name;
