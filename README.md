# hope-dashboard

Facilitator-facing dashboard for the Hope Programme AI Facilitator Assistant.

Talks to two backends:

- `comment_generation` FastAPI on `:8001` — three-persona draft generation,
  participant memory store, HITL signal capture.
- `dropout_ml_v2` FastAPI on `:8000` — weekly dropout-risk scoring and
  engagement features.

## Stack

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4
- TanStack Query v5 for server state, Zustand for client UI state
- NextAuth v5 (magic-link) for facilitator auth
- shadcn/ui components (added on demand when the panels are built)
- `openapi-typescript` to derive types from `../comment_generation/docs/openapi.yaml`

## Getting started

```bash
cp .env.example .env.local        # fill in HOPE_API_SECRET, AUTH_SECRET, etc.
npm install
npm run gen:types                 # regenerate types from the OpenAPI spec
npm run dev                       # http://localhost:3000
```

The two backends must be running for `/cohorts/...` pages to load real data:

```bash
# in comment_generation/
HOPE_API_AUTH=disabled uvicorn service.main:app --port 8001

# in dropout_ml_v2/deploy/
uvicorn api.main:app --port 8000
```

For local development without auth, set `HOPE_API_AUTH=disabled` on the
backend and leave `HOPE_API_SECRET` blank in `.env.local`.

## Repo layout

```
src/
  app/                  # App Router pages
  components/           # shared UI components
  lib/
    api/
      client.ts         # generic HMAC-aware fetch wrapper
      commentGen.ts     # typed client for :8001
      dropout.ts        # typed client for :8000
      types.ts          # auto-generated from comment_generation/docs/openapi.yaml
    auth/
      sign.ts           # server-only HMAC-SHA256 signer
```

## Updating the API contract

The OpenAPI spec is owned by `comment_generation/docs/openapi.yaml`. After
any change there, regenerate the types:

```bash
npm run gen:types
```

Commit the regenerated `src/lib/api/types.ts` so the dashboard build stays
deterministic.

## Demo target

The end-to-end demo uses cohort `IIH-COH12-110226` (id 1680) in module
`People living with IIH 2025 - V1` (id 337).
