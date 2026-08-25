-- Phase 5: ERC-8183 job hiring. This table is a read cache of on-chain
-- state for Aether's own dashboard/task views — the chain itself remains
-- the source of truth. Every row is written only after the API route
-- (app/api/jobs/route.ts) independently reads the job back from the chain
-- and confirms it matches what the client claimed; nothing here is ever
-- trusted from client input alone.

create type job_status as enum ('open', 'funded', 'submitted', 'completed', 'rejected', 'expired');

create table onchain_jobs (
  id uuid primary key default uuid_generate_v4(),
  chain_id int not null,
  job_id numeric not null,               -- on-chain uint256 job id
  commerce_address text not null,
  client_wallet text not null,           -- the hiring user's own wallet — never a key we hold
  provider_agent_id uuid references agents(id),
  provider_wallet text not null,
  description text,
  budget numeric,                        -- in payment-token base units, set once setBudget is confirmed
  payment_token text,                    -- read from commerce.paymentToken() at creation time, never assumed
  expired_at timestamptz,
  status job_status not null default 'open',
  created_tx_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  unique (chain_id, job_id, commerce_address)
);

create index onchain_jobs_client_idx on onchain_jobs (client_wallet);
create index onchain_jobs_provider_idx on onchain_jobs (provider_agent_id);
create index onchain_jobs_status_idx on onchain_jobs (status);
