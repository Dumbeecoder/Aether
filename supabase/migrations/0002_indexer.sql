-- Phase 2: ERC-8004 indexer support.
-- Adds on-chain identity columns to agents, richer agent_endpoints columns,
-- an indexer checkpoint table, and an audit-trail table for every decoded
-- registry event (spec Section 16).

alter table agents
  add column if not exists identity_registry text,
  add column if not exists registration_tx_hash text,
  add column if not exists registration_block bigint,
  add column if not exists registration_timestamp timestamptz,
  add column if not exists last_indexed_at timestamptz,
  add column if not exists agent_uri text;

-- Slug already existed in 0001 as part of the unique(slug) column, but Phase 2
-- is the first phase that actually populates it programmatically — no
-- schema change needed there beyond what 0001 already has.

alter table agent_endpoints
  add column if not exists source text not null default 'agent_metadata',  -- 'agent_metadata' | 'agentx_probe'
  add column if not exists response_time_ms integer,
  add column if not exists status_code integer,
  add column if not exists health_status text not null default 'unknown', -- online | degraded | offline | unknown
  add column if not exists last_error text;

-- Natural-key uniqueness for idempotent upserts (spec Section 5).
create unique index if not exists agent_endpoints_agent_endpoint_uq
  on agent_endpoints (agent_id, endpoint);

create unique index if not exists agent_capabilities_agent_capability_uq
  on agent_capabilities (agent_id, capability);

-- Block cursor per (chain, contract) so a crashed indexer resumes instead
-- of re-scanning from genesis or silently skipping a range.
create table if not exists indexer_checkpoints (
  chain_id int not null,
  contract_address text not null,
  last_processed_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

-- Auditable log of every decoded registry event, independent of what the
-- current `agents` row looks like — lets us answer "how did this agent's
-- record come to look like this" after the fact, and is the dedup surface
-- that makes re-running a block range idempotent.
create table if not exists agent_events (
  id uuid primary key default uuid_generate_v4(),
  chain_id int not null,
  contract_address text not null,
  agent_id text not null,
  event_name text not null,
  block_number bigint not null,
  tx_hash text not null,
  log_index int not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (chain_id, tx_hash, log_index)
);

create index if not exists agent_events_agent_idx on agent_events (chain_id, agent_id);
