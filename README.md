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
cp .env.example .env.local        # fill in COMMENT_GEN_URL etc.
npm install
npm run gen:types                 # regenerate types from the OpenAPI spec
npm run dev                       # http://localhost:3000
```

### Pointing at the backend

`COMMENT_GEN_URL` (and `NEXT_PUBLIC_COMMENT_GEN_URL`) decides where the
dashboard sends `/generate` and `/memory/...`. Three valid setups:

| Setup | `COMMENT_GEN_URL` | When |
|---|---|---|
| Backend on same host | `http://localhost:8011` | Both repos running on the same machine. Note: `:8001` is held by JupyterHub on Brosnan HPC, so use `:8011` there. |
| Backend on HPC, dashboard on laptop | `http://<hpc-tunnel-host>:8011` | SSH tunnel or Cloudflare Tunnel. |
| Backend on HF Spaces | `https://michaelajao-hope-comment-gen-api.hf.space` | Production-style. See `comment_generation/space/DEPLOY.md`. |

If running both backends locally:

```bash
# in comment_generation/
HOPE_API_AUTH=disabled \
HOPE_GEN_MODEL_ID=qwen3-4b-hope-only \
uvicorn service.main:app --port 8011

# in dropout_ml_v2/deploy/
uvicorn api.main:app --port 8000
```

### Auth

This dashboard uses NextAuth v5 with the **dev-allowlist Credentials
provider** by default. Set `FACILITATOR_EMAILS=` to a comma-separated
allowlist (empty = allow any email in dev). Magic-link via Nodemailer is
intentionally not wired in this build because it pulls Node-only modules
into the Edge runtime; re-introduce it through the documented Auth.js
Edge/Node split when configuring SMTP for the real workshop.

For local development without HMAC, set `HOPE_API_AUTH=disabled` on the
backend.

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
