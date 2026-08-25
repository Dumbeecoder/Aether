# Seeding demo agents into Supabase

`seed_demo_agents.sql` inserts the 8 demo agents shown on the homepage
fallback (`apps/web/lib/seedAgents.ts`) as **real rows** in your Supabase
database — same names, categories, and stats, but now they're queryable,
so "Hire agent," "Compare," and clicking into a passport all actually
resolve instead of dead-ending on an empty `/agents`/`/hire` page.

They're inserted with `data_source = 'seeded'`, so every existing
provenance UI (the "Seeded (demo)" pill on `/agents`, the amber "Seeded —
demo data" banner on the Agent Passport) keeps showing them as demo data,
not real on-chain agents. Nothing about this pretends otherwise.

## How to run it

**Easiest — Supabase Dashboard:**
1. Open your project at https://supabase.com/dashboard
2. Go to **SQL Editor** → **New query**
3. Paste the contents of `seed_demo_agents.sql`
4. Click **Run**
5. The last line returns the 8 inserted rows as a sanity check

**Alternative — Supabase CLI**, if you have it linked to this project:
```bash
supabase db execute -f scripts/seed/seed_demo_agents.sql
```

## Notes

- **Safe to re-run.** Every insert is guarded (either `ON CONFLICT DO
  NOTHING` on a real unique constraint, or a `WHERE NOT EXISTS` check where
  no unique constraint exists) — running it twice won't create duplicates.
- **Requires migrations `0001_init.sql` and `0002_indexer.sql` to already
  be applied** — this script assumes `agent_endpoints.health_status` and
  `.response_time_ms` exist, which only `0002` adds.
- To remove these later: `delete from agents where data_source = 'seeded';`
  (cascades to capabilities/protocols/endpoints/performance via
  `on delete cascade`).
