# API deployment & usage

Two FastAPI services back the Hope Facilitator system. They are independent and can scale separately. The dashboard is the only client today, but the contracts are public so the platform team can also call them.

| Service | Port | Purpose | Auth |
| --- | --- | --- | --- |
| **dropout-api** | 8000 | Predicts weekly dropout risk per participant. SHAP-explainable. | HMAC-SHA256 over body, shared secret `HOPE_API_SECRET`; or NextAuth session cookie (set by the dashboard). |
| **comment-api** | 8001 | Generates 3-persona facilitator drafts; serves participant memory; logs HITL signals. | Same as above. |

Both honour `HOPE_API_AUTH=disabled` to bypass auth in local dev / smoke tests.

---

## 1. Quick start

### 1.1 Local — both services in containers

```bash
cd hope-dashboard
cp .env.example .env
# minimum: set HOPE_API_SECRET to a real value
docker compose up dropout-api comment-api
```

Health-check both:

```bash
curl localhost:8000/health
curl localhost:8001/health
```

Run the smoke E2E:

```bash
bash scripts/smoke_e2e.sh
cat outputs/smoke_summary.md
```

### 1.2 Local — direct uvicorn (HPC, fastest iteration)

```bash
# terminal 1 — dropout-api
cd dropout_ml_v2/deploy
HOPE_API_AUTH=disabled uvicorn api.main:app --host 0.0.0.0 --port 8000

# terminal 2 — comment-api
cd comment_generation
HOPE_API_AUTH=disabled \
HOPE_GEN_MODEL_ID=qwen2.5-1.5b-hope-only \
uvicorn service.main:app --host 0.0.0.0 --port 8001
```

### 1.3 Azure deploy

See [`azure/README.md`](azure/README.md) for the full walk-through. Short version:

```bash
cd hope-dashboard/deploy/azure
az login
az account set --subscription <SUB_ID>
azd init -e dev
azd up
# upload adapters once after provisioning (see MODELS.md §2.5)
```

---

## 2. Authentication model

Every write endpoint requires either:

- `X-HMAC-Signature` header carrying `hex(HMAC-SHA256(raw_body, HOPE_API_SECRET))`, **or**
- a NextAuth `next-auth.session-token` cookie (set by the dashboard's login flow).

Read endpoints (`/health`, `/version`, `/model/info`) are open.

When `HOPE_API_AUTH=disabled`, all auth checks are skipped — useful for `curl`-driven smoke tests, never set in production.

### 2.1 Signing a request manually

```bash
SECRET="dev-secret"
BODY='{"participant_id":1680,"cohort_id":110226,"activity_type":"GoalSetting","post_text":"feeling stuck","display_name":"Sam"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST http://localhost:8001/generate \
    -H "Content-Type: application/json" \
    -H "X-HMAC-Signature: $SIG" \
    -d "$BODY"
```

The dashboard does this automatically via [`src/lib/auth/sign.ts`](../../hope-dashboard/src/lib/auth/sign.ts) inside server-side proxy routes — the secret never reaches the browser.

### 2.2 Rotation

`HOPE_API_SECRET` is in Azure Key Vault. To rotate without downtime:

1. Add a new version of `hope-api-secret` in Key Vault.
2. Restart `dropout-api`. It now accepts the new secret. Old clients break.
3. Restart `comment-api`. Same.
4. Restart `dashboard` last so the signing side flips after both backends are ready.

Or in the simple case where you tolerate a brief 401 window: rotate the secret, then restart all three at once.

---

## 3. Service: dropout-api (port 8000)

Source: [`dropout_ml_v2/deploy/api/main.py`](../../dropout_ml_v2/deploy/api/main.py).

### 3.1 `GET /health`

Liveness probe. No auth.

```json
{
    "status": "healthy",
    "model_loaded": true,
    "shap_available": true,
    "timestamp": "2026-05-06T10:00:00.000000"
}
```

### 3.2 `GET /model/info`

Returns the loaded bundle's metadata: model class, paradigm, feature count, feature list, operating thresholds. No auth.

### 3.3 `POST /predict` (signed)

One-participant scoring.

**Request:**
```json
{
    "participant_id": "user-1234",
    "features": {
        "current_inactive_streak": 9,
        "days_since_last_login": 11,
        "cum_login_count": 3,
        "engagement_slope": -0.4,
        "wrote_first_week_binary": 0,
        "received_comment_first_week_binary": 0
    }
}
```

Missing features default to `0.0`. The authoritative feature list is in `GET /model/info`.

**Response:**
```json
{
    "participant_id": "user-1234",
    "dropout_risk": 0.71,
    "risk_level": "high",
    "contributing_factors": [
        "Inactive for 9 consecutive days",
        "Last login was 11 days ago",
        "No facilitator comment in first 7 days"
    ],
    "recommended_actions": [
        "Schedule 1-to-1 check-in call with participant",
        "Send personalised encouragement message",
        "Send re-engagement email with next session reminder"
    ],
    "scored_at": "2026-05-06T10:00:00.000000"
}
```

`contributing_factors` come from SHAP when the explainer is available, falling back to a deterministic rule-based selector.

`risk_level` is the threshold-bucketed view: `low < 0.20 ≤ medium < 0.50 ≤ high`. Thresholds are set by env (`RISK_THRESHOLD`, `HIGH_RISK_THRESHOLD`) and default to the F1-optimal point from training.

### 3.4 `POST /batch` (signed)

Same scoring for many participants. Sorted by descending `dropout_risk`.

**Request:**
```json
{
    "participants": [
        { "participant_id": "u1", "features": { /* … */ } },
        { "participant_id": "u2", "features": { /* … */ } }
    ]
}
```

**Response:**
```json
{
    "total": 2,
    "high_risk_count": 1,
    "medium_risk_count": 0,
    "low_risk_count": 1,
    "predictions": [ /* … */ ],
    "scored_at": "2026-05-06T10:00:00.000000"
}
```

Used by the dashboard to fill the cohort header KPI tiles and the follow-up queue. Cache for the week (`staleTime: 1 day` in TanStack Query).

### 3.5 Demo mode

If the model bundle is missing at startup, the API serves a stochastic heuristic that mirrors the trained model's signal directions. Useful for demos with no model file present; never let this state reach production. `GET /model/info` returns `{"status": "demo_mode"}` in this case.

### 3.6 Demo / smoke `curl` recipes

```bash
# auth disabled (HOPE_API_AUTH=disabled)
curl -X POST http://localhost:8000/predict \
    -H "Content-Type: application/json" \
    -d '{"participant_id":"demo","features":{"current_inactive_streak":12,"days_since_last_login":14,"cum_login_count":2,"engagement_slope":-0.6}}'
```

---

## 4. Service: comment-api (port 8001)

Source: [`comment_generation/service/main.py`](../../comment_generation/service/main.py). OpenAPI spec at [`comment_generation/docs/openapi.yaml`](../../comment_generation/docs/openapi.yaml).

### 4.1 `GET /health`

```json
{
    "status": "healthy",
    "model_loaded": true,
    "memory_db": "ok",
    "dropout_api": "reachable",
    "timestamp": "2026-05-06T10:00:00+00:00"
}
```

`model_loaded` becomes `true` after the first successful `/generate` call (lazy load). `dropout_api` is a one-shot probe of `HOPE_DROPOUT_URL`.

### 4.2 `GET /version`

```json
{
    "service_version": "0.1.0",
    "model_version": "qwen2.5-1.5b-hope-only",
    "deployed_at": "2026-05-06T10:00:00+00:00",
    "commit_sha": null
}
```

`model_version` reflects whatever `HOPE_GEN_MODEL_ID` resolved to. Match this to the value reported in `/generate` responses.

### 4.3 `POST /generate` (signed)

The hot path. Returns 2–3 persona-conditioned drafts.

**Request (rich, used by the dashboard):**
```json
{
    "participant_id": 1680,
    "cohort_id": 110226,
    "module_id": 337,
    "week_number": 6,
    "activity_id": 99812,
    "activity_type": "GoalSetting",
    "post_text": "I keep meaning to start my walking goal but I lose track.",
    "display_name": "Sam",
    "engagement": {
        "dropout_risk": 0.71,
        "risk_level": "high",
        "current_inactive_streak": 9,
        "days_since_last_login": 11,
        "cum_login_count": 3,
        "engagement_slope": -0.4
    }
}
```

`engagement` is optional. If absent, the service tries to read the same row from `cumulative_features_panel.parquet` itself.

**Request (legacy, used by `dropout_ml_v2`'s Streamlit dashboard):**
```json
{
    "display_name": "Sam",
    "module_id": 337,
    "week_number": 6,
    "dropout_risk": 0.71,
    "current_inactive_streak": 9,
    "wrote_first_week_binary": 0
}
```

The legacy shape is detected automatically and returns the deterministic stub drafts (it carries no `post_text`, so real generation is impossible).

**Response:**
```json
{
    "drafts": [
        {
            "persona": "Empathetic",
            "label": "Warm personal check-in",
            "body": "Hi Sam, it sounds like the week has been pulling you in many directions. What's been making it hardest to come back to the goal?",
            "draft_id": "0c4a2b…",
            "mi_signature": {
                "open_question_ratio": 0.5,
                "reflection_density": 0.5,
                "prescriptive_density": 0.0
            }
        },
        { "persona": "Action-oriented", "label": "Small next-step nudge", /* … */ },
        { "persona": "Goal-oriented",   "label": "Goal-focused support",  /* … */ }
    ],
    "draft_set_id": "f2…",
    "memory_used": true,
    "engagement_used": true,
    "safety_signposting": null,
    "model_version": "qwen2.5-1.5b-hope-only",
    "generated_at": "2026-05-06T10:00:00+00:00"
}
```

Cite `draft_set_id` and `draft_id` on subsequent `/thumb` and `/event` calls so HITL signals join correctly.

**Special cases:**

- `activity_type == "Gratitude"` → 2 drafts (Empathetic + Goal-oriented). Activity-aware prune per HOPE manual.
- Crisis input (e.g. self-harm phrasing) → 2 acknowledgement-only drafts + `safety_signposting` text. `model_version` becomes `safety-block`.
- `HOPE_DISABLE_GENERATION=1` → 3 deterministic stub drafts. `model_version` becomes `stub-disabled`.
- Cold-start memory (no prior posts for `(participant_id, cohort_id)`) → `memory_used: false`, generation still proceeds.
- Missing engagement panel → `engagement_used: false`, generation still proceeds.

### 4.4 `POST /thumb` (signed)

Capture a thumb up/down on a specific shown draft.

**Request:**
```json
{
    "draft_id": "0c4a2b…",
    "label": "up",
    "facilitator_id": "fac-mb"
}
```

**Response:** `{ "status": "ok" }`

Idempotent on `draft_id` — the latest thumb wins. Persisted to `hitl_drafts`.

### 4.5 `POST /event` (signed)

The facilitator's final decision on a draft set. Triggers the **HITL fast-path**: the sent text is also written into `participant_memory` so the next `/generate` call sees it.

**Request:**
```json
{
    "draft_set_id": "f2…",
    "chosen_draft_id": "0c4a2b…",
    "action": "accept",
    "sent_text": "Hi Sam, it sounds like the week has been pulling you in many directions. What's been making it hardest to come back to the goal?",
    "facilitator_id": "fac-mb"
}
```

`action` ∈ `{"accept", "edit", "reject", "flag"}`. `sent_text` is required for accept/edit. `flag_reason` is required for flag. Reject must omit `sent_text`.

**Response:** `{ "status": "ok" }`

Side effects:
- Updates the row in `hitl_drafts`: `was_chosen=1`, `sent_text`, `edit_distance` (normalised Levenshtein), `sent_ts`.
- Inserts an aggregate row in `hitl_events`.
- For accept/edit: writes a `participant_memory` row keyed on `sha1(draft_set_id|chosen_draft_id)` so retries dedupe.

If `chosen_draft_id` is unknown (no prior `/generate` recorded it), returns `404`.

### 4.6 `POST /memory/{post,reply,batch}` (signed)

Webhook endpoints for the platform (or any caller) to keep participant memory fresh.

```bash
# single post arrival
curl -X POST http://localhost:8001/memory/post \
    -H "Content-Type: application/json" \
    -H "X-HMAC-Signature: $SIG" \
    -d '{
        "activity_id": 99812,
        "participant_id": 1680,
        "cohort_id": 110226,
        "module_id": 337,
        "activity_type": "GoalSetting",
        "text": "Today I want to walk for 10 minutes after lunch.",
        "recorded_at": "2026-05-06T09:00:00Z",
        "display_name": "Sam",
        "source": "platform_webhook"
    }'
```

`/memory/post` is idempotent on `activity_id`. `/memory/reply` on `comment_id`. `/memory/batch` accepts a discriminated union of post/reply items for bulk reconciliation.

**Response:** `{ "status": "stored", "memory_id": 57 }` or `{ "status": "deduped", "memory_id": 12 }`.

### 4.7 `GET /memory/{participant_id}` (signed)

Debug listing of recent memory entries. Bounded by `cohort_id` and `limit` query params.

```bash
curl "http://localhost:8001/memory/1680?cohort_id=110226&limit=10" \
    -H "X-HMAC-Signature: $SIG"
```

### 4.8 `DELETE /memory/post/{activity_id}` (signed)

Right-to-erasure. Hard-deletes the post and any associated reply rows.

---

## 5. How the dashboard consumes both APIs

The dashboard never calls the backends from the browser. Every call goes through a server-side proxy under `/api/proxy/*` ([`hope-dashboard/src/app/api/proxy/`](../../hope-dashboard/src/app/api/proxy/)) which:

1. Verifies the user is authenticated via NextAuth.
2. Re-signs the body with `HOPE_API_SECRET` (the secret never reaches the browser).
3. Forwards to the backend at `COMMENT_GEN_URL` / `DROPOUT_API_URL`.
4. Returns the response unchanged.

| Dashboard hook | Proxy route | Backend endpoint | Cache |
| --- | --- | --- | --- |
| `useCohortBatch` | `POST /api/proxy/dropout/batch` | `POST :8000/batch` | 1 day |
| `useParticipantPrediction` | `POST /api/proxy/dropout/predict` | `POST :8000/predict` | 1 day |
| `useMemory` | `GET /api/proxy/memory/[id]` | `GET :8001/memory/{id}` | 5 min |
| `useGenerate` | `POST /api/proxy/generate` | `POST :8001/generate` | none (mutation) |
| `useThumb` | `POST /api/proxy/thumb` | `POST :8001/thumb` | none |
| `useEvent` | `POST /api/proxy/event` | `POST :8001/event` | none, invalidates `useMemory` on success |

The 1-day staleTime on dropout queries matches the model's weekly cadence — dropout scores don't move within a week.

---

## 6. Networking topology on Azure

```
                       https
                         │
                    ┌────┴────┐
                    │ public  │   public ingress, custom domain optional
                    │ routing │
                    └────┬────┘
                         ▼
                ┌────────────────┐
                │   dashboard    │   3 vCPU, 1 GiB
                │   (Next.js)    │
                └────┬───────┬───┘
            internal│       │internal
                    ▼       ▼
          ┌──────────────┐ ┌──────────────┐
          │  comment-api │ │ dropout-api  │
          │   :8001      │ │   :8000      │
          └──────┬───────┘ └──────────────┘
                 │
                 │ Azure Files (read-only)
                 ▼
       ┌──────────────────────┐
       │ Storage Account      │
       │ share: lora-adapters │
       └──────────────────────┘
```

- Only the dashboard has external ingress. Both backends are `external: false` on the Container Apps Environment, so they're only reachable via internal DNS (`http://hope-<env>-comment-api`, `http://hope-<env>-dropout-api`).
- All HMAC secrets are Key Vault references, resolved by the Container App's system-assigned identity (RBAC role `Key Vault Secrets User`).
- Logs flow to a single Log Analytics workspace.

---

## 7. Common operations

### 7.1 Restart a service

```bash
az containerapp revision restart \
    -n hope-dev-comment-api -g hope-rg \
    --revision $(az containerapp revision list -n hope-dev-comment-api -g hope-rg --query '[0].name' -o tsv)
```

### 7.2 Tail logs

```bash
az containerapp logs show -n hope-dev-comment-api -g hope-rg --follow
```

### 7.3 Inspect HITL events locally

```bash
sqlite3 comment_generation/outputs/hitl.sqlite \
    "SELECT ts, action, draft_variant, edit_distance FROM hitl_drafts \
     ORDER BY id DESC LIMIT 20;"
```

### 7.4 Probe contracts after a code change

```bash
bash scripts/smoke_e2e.sh
cat outputs/smoke_summary.md
```

The smoke script exits non-zero if any check fails. Wire it into CI later.

### 7.5 Switch the comment-api adapter

See [`MODELS.md` §2.6](MODELS.md#26-swapping-the-production-adapter).

### 7.6 Roll back a bad deploy

```bash
# list revisions
az containerapp revision list -n hope-dev-comment-api -g hope-rg -o table

# pin traffic to the previous revision
az containerapp ingress traffic set \
    -n hope-dev-comment-api -g hope-rg \
    --revision-weight <previous-revision-name>=100
```

---

## 8. Error reference

| Status | Where | Meaning | Fix |
| --- | --- | --- | --- |
| 401 `X-HMAC-Signature header missing` | Any signed endpoint | Either auth disabled was forgotten, or the dashboard signer isn't running | Set `HOPE_API_AUTH=disabled` for dev, or check the dashboard's server-side proxy is signing |
| 401 `invalid HMAC signature` | Any signed endpoint | Secret mismatch between client and server | `HOPE_API_SECRET` must match exactly across all three apps |
| 404 on `/event` | comment-api | `chosen_draft_id` not in `hitl_drafts` — the originating `/generate` didn't log it (e.g. service restart between generate and event) | Re-issue `/generate` and use the new ids |
| 422 on `/generate` | comment-api | Pydantic validation — missing `post_text`, bad `activity_type` enum | Read the response detail; fix the payload |
| 500 with `HOPE_API_SECRET not configured` | Any | The container has auth enabled but the secret is empty | Set the secret in env / Key Vault |
| Long latency on first `/generate` | comment-api | Cold model load (download + load) | Wait 30–60 s; hit it once during deploy to warm |
| `dropout_api: unreachable` in `/health` | comment-api | DNS/networking — the comment-api can't reach `HOPE_DROPOUT_URL` | Check Container Apps internal DNS; confirm dropout-api revision is healthy |
| `engagement_used: false` always | comment-api | The Files share is missing the parquet, or `HOPE_DROPOUT_PANEL_PATH` is wrong | Re-upload the parquet; confirm path mounted in the container |
| `memory_used: false` for a known participant | comment-api | No `participant_memory` rows for `(participant_id, cohort_id)` | Backfill via `/memory/batch` or run `python scripts/backfill_memory_from_json.py --cohort-id <id>` |

---

## 9. Roadmap (not built yet)

These are documented contracts that don't have implementations on the comment-api side; the dashboard already has typed clients for them and stubs in place:

- `GET /admin/events` (the Audit page expects this for reading recent HITL events server-side).
- `POST /sync/backfill-from-json` is currently a 501 stub; the CLI script is the supported path.
- mTLS hardening between dashboard and backends (currently HMAC + private DNS).
- Replace the dev `Credentials` provider with `nodemailer` magic-link once SMTP is live.
