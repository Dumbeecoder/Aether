-- Aether initial schema
create extension if not exists "uuid-ossp";
create extension if not exists vector;

create type data_source as enum ('onchain', 'seeded');
create type agent_status as enum ('online', 'unverified', 'offline');
create type task_status as enum ('open', 'funded', 'submitted', 'completed', 'rejected', 'expired');

-- Data provenance (spec Section 7 — Trust Layer). Every claim about an agent
-- must be traceable to one of these. Default is the least-trusted tier
-- (unverified_claim); rows only move to a more-trusted tier when something
-- actually did the verification (indexer read the chain, or Aether ran a
-- real check) — never by developer assumption.
create type data_provenance as enum (
  'onchain_fact',      -- read directly from a chain (ERC-8004/ERC-8183 event or state)
  'agentx_verified',    -- Aether independently checked it (endpoint probe, test task, measured metric)
  'agent_provided',     -- submitted by the agent's creator via /submit-agent, not yet checked
  'unverified_claim'    -- default; nothing has verified this yet
);

create table agents (
  id uuid primary key default uuid_generate_v4(),
  agent_id text not null,               -- on-chain ERC-8004 agentId (ERC-721 token id)
  chain_id int not null,                -- 97 = testnet, 56 = mainnet
  wallet_address text not null,
  name text not null,
  slug text not null unique,
  description text,
  description_provenance data_provenance not null default 'agent_provided',
  avatar_url text,
  category text,
  status agent_status not null default 'unverified',
  -- Passport verification facets (spec Section 8) — kept separate because
  -- an agent can be identity-verified without its endpoint or performance
  -- having been checked yet; collapsing these into one `verified` boolean
  -- would let a UI imply more trust than has actually been established.
  identity_verified boolean not null default false,   -- ERC-8004 registration confirmed onchain
  endpoint_verified boolean not null default false,    -- endpoint responded to a live probe
  performance_verified boolean not null default false, -- success rate computed from Aether-observed tasks, not agent's claim
  data_source data_source not null default 'onchain',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, chain_id)
);

create table agent_capabilities (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  capability text not null,
  description text,
  provenance data_provenance not null default 'agent_provided'
);

create table agent_protocols (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  protocol text not null,
  version text,
  provenance data_provenance not null default 'agent_provided'
);

create table agent_endpoints (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  endpoint text not null,
  endpoint_type text not null,
  status text not null default 'unknown',
  last_checked timestamptz
);

create table agent_performance (
  agent_id uuid primary key references agents(id) on delete cascade,
  total_tasks int not null default 0,
  successful_tasks int not null default 0,
  failed_tasks int not null default 0,
  success_rate numeric,
  average_execution_time numeric,
  total_volume numeric not null default 0,
  total_earnings numeric not null default 0,
  last_active timestamptz
);

create table agent_transactions (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  tx_hash text not null,
  chain_id int not null,
  type text not null,
  value numeric,
  timestamp timestamptz not null default now(),
  status text not null
);

create table users (
  id uuid primary key default uuid_generate_v4(),
  wallet_address text not null unique,
  created_at timestamptz not null default now()
);

create table agent_reviews (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid references users(id),
  task_id uuid,
  rating int check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now()
);

create table agent_tasks (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid references users(id),
  task_type text,
  description text,
  status task_status not null default 'open',
  price numeric,
  started_at timestamptz,
  completed_at timestamptz,
  result text,
  tx_hash text
);

alter table agent_reviews
  add constraint agent_reviews_task_fk foreign key (task_id) references agent_tasks(id);

create table hire_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  agent_id uuid references agents(id),
  max_budget numeric not null,
  max_transaction numeric not null,
  expiry timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default uuid_generate_v4(),
  hire_session_id uuid not null references hire_sessions(id) on delete cascade,
  protocol text not null,
  action text not null,
  "limit" numeric
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references agent_tasks(id),
  payer text not null,
  recipient text not null,
  amount numeric not null,
  currency text not null,
  tx_hash text,
  platform_fee numeric
);

create index agents_category_idx on agents (category);
create index agents_chain_idx on agents (chain_id);
create index agent_tasks_status_idx on agent_tasks (status);
