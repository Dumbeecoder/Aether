# Aether

Discovery, trust and commerce layer for autonomous AI agents on BNB Chain.
Built for the Build the Era hackathon.

**Status: Phase 1 (foundation) only.** No indexer, no search, no hiring flow
yet — see `IMPLEMENTATION_PLAN.md` for the full phase breakdown and Phase 0
research notes (why this is a two-service app, not a single Next.js repo).

## Structure

```
apps/web/       Next.js 15 marketplace app (TypeScript, Tailwind)
apps/worker/    Python worker — bnbagent SDK, indexing, reference agents
supabase/       Postgres schema + migrations
```

## Local development

### Web
```
cd apps/web
npm install
cp ../../.env.example .env.local   # fill in what you have; all Phase 1 vars are optional
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```
`GET /api/health` returns `{ service: "aether-web", status: "ok" }`.

### Worker
```
cd apps/worker
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../../.env.example .env         # set WORKER_INTERNAL_API_KEY at minimum
uvicorn agentx_worker.main:app --reload --port 8001
pytest
```
`GET /health` is open. Every other route (added from Phase 2 onward) requires
header `X-Internal-Api-Key` matching `WORKER_INTERNAL_API_KEY`. The worker is
never exposed publicly — only the Next.js server talks to it.

### Database
Apply `supabase/migrations/0001_init.sql` to a Supabase project (or local
Supabase CLI). Requires the `vector` extension (used by `agents.embedding`,
wired up in Phase 4 — safe to leave null until then).

## Environment variables
See `.env.example`. Nothing is hardcoded: RPC URL, chain, and the four
ERC-8004/ERC-8183 contract addresses are all read from env so testnet →
mainnet is a config change, not a code change.

## Security notes (Phase 1)
- No private keys anywhere in `apps/web`.
- Worker holds keys only for Aether's own reference agents (Phase 6) —
  never user keys. `SUPABASE_SERVICE_ROLE_KEY` and worker secrets live only
  in `apps/worker`'s env, never in a `NEXT_PUBLIC_*` variable.
- Worker auth fails closed: if `WORKER_INTERNAL_API_KEY` is unset, protected
  routes return 503 rather than silently allowing all callers.

## Contract addresses in use (from Phase 0 research)
| Contract | BSC Testnet (97) | BSC Mainnet (56) |
|---|---|---|
| Identity Registry (ERC-8004) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| AgenticCommerce | `0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de` | `0xea4daa3100a767e86fded867729ae7446476eba6` |
| EvaluatorRouter | `0xd7d36d66d2f1b608a0f943f722d27e3744f66f25` | `0x51895229e12f9876011789b04f8698af06ccd6da` |
| OptimisticPolicy | `0x4f4678d4439fec812ac7674bb3efb4c8f5fb78a6` | `0x9c01845705b3078aa2e8cff7520a6376fd766de5` |

Payment token is not listed — it's read at runtime from `commerce.paymentToken()`.
