# Hope Move integration guide

For platform engineers integrating the two backing services into the Hope Move platform. The dashboard in this repo is a research/UX test surface, not part of the integration path — feel free to ignore it.

Two services. Independent. Stateless from the platform's perspective.

| Service | Repo | Default port | Purpose |
| --- | --- | --- | --- |
| **engagement_ml** | [`engagement_ml`](https://github.com/michaelajao/engagement_ml) | 8000 | Dropout-risk prediction. Random Forest + Platt calibration + TreeSHAP. |
| **comment_generation** | [`comment_generation`](https://github.com/michaelajao/comment_generation) | 8001 | Persona-conditioned reply drafting (3 drafts per call). Holds memory of past posts + HITL log. |

---

## 1. Authentication

Different services, different posture — by design. Each works in two modes.

| Service | Production | Local/smoke |
| --- | --- | --- |
| engagement_ml | `X-API-Key: $HOPE_RISK_API_KEY` header | omit header when `HOPE_API_AUTH=disabled` |
| comment_generation | `X-HMAC-Signature: hex(HMAC-SHA256(raw_body, $HOPE_API_SECRET))` header | omit header when `HOPE_API_AUTH=disabled` |

Both refuse all writes without auth in production mode. Reads (`/health`, `/version`, `/model/info`) are always open.

### HMAC example (bash)

```bash
SECRET="..."
BODY='{"participant_id":101731,"cohort_id":1680,...}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://comment-api.../generate \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIG" \
  -d "$BODY"
```

The signature is over the **raw request body bytes** — no whitespace mutation, no key reordering. If you serialize JSON to disk and then re-read it, sign the bytes you actually send.

---

## 2. engagement_ml — risk scoring

### When to call

Per participant, **weekly** (or whenever the platform's scoring cadence triggers). Not per-event. The model's feature builder aggregates 6 weeks of event history into a single score; calling it more often than weekly wastes compute and produces noisy week-over-week values.

### `POST /predict` — one participant

```json
{
  "participant_id": "101731",
  "effective_start": "2026-02-11T00:00:00Z",
  "events": [
    { "timestamp": "2026-02-12T07:09:08.477Z", "event_type": "login" },
    { "timestamp": "2026-02-12T12:09:48.087Z",
      "event_type": "activity",
      "activity_type": "Emotions",
      "words_written": 1,
      "description": "Scared;Irritable;Determined;Debilitated" }
  ],
  "cohort_size": 51,
  "cohort_facilitator_density": 0.33,
  "programme_length_days": 42,
  "score_at_day": 42
}
```

**Field notes**
- `effective_start` — cohort start (platform-defined), not the participant's first event
- `timestamp` — **must include a tz designator** (`Z` or `+HH:MM`). Naive datetimes are rejected
- Events outside `[effective_start, effective_start + score_at_day)` are rejected, not silently dropped
- `event_type` is one of: `activity`, `login`, `page_visit`, `bookmark`, `discussion_post`, `facilitator_comment`
- `score_at_day` is the trained horizon. Use the supported set: `{7, 14, 21, 28, 35, 42}`. Values > 42 are anchored at 42 and disclosed in the response
- `cohort_facilitator_density` is the proportion of cohort members who received any facilitator comment in the score window. Platform computes this directly from its facilitator-comment table

### Response

```json
{
  "participant_id": "101731",
  "dropout_probability": 0.039,
  "raw_probability": 0.041,
  "risk_tier": "low",
  "risk_level": "low",
  "dropout_risk": 0.039,
  "threshold_used": 0.529,
  "threshold_low": 0.162,
  "threshold_high": 0.511,
  "model_version": "random_forest_T42@5579a582da15",
  "horizon_used": 42,
  "programme_length_days": 42,
  "score_at_day": 42,
  "anchored_to_days": "0..41",
  "contributing_factors": [
    "Many page visits",
    "Many active days",
    "Broad activity range"
  ],
  "contributing_factor_weights": [0.519, 0.290, 0.190],
  "recommended_actions": [
    "Acknowledge their engagement with a short note",
    "Invite them to share their goal with the cohort"
  ],
  "note": null
}
```

The dashboard-friendly aliases `dropout_risk` + `risk_level` carry the same values as the native `dropout_probability` + `risk_tier`. Use whichever fits your UI.

### `POST /batch` — many participants in one call

```json
{
  "participants": [
    { "participant_id": "...", "effective_start": "...", "events": [...], ... },
    { "participant_id": "...", "effective_start": "...", "events": [...], ... }
  ]
}
```

Max 2,000 participants per call. Returns `{ total, high, medium, low, predictions: [...] }`. Use for cohort-wide weekly rescoring.

### `GET /model/info`

Auditability — returns the trained horizons, calibration thresholds, training period, test counts. Stable across requests within a deploy.

---

## 3. comment_generation — drafting + memory + HITL

Three integration surfaces. They work together but can be wired independently.

### 3.1 `POST /generate` — produce 3 reply drafts

Called whenever a participant posts. Returns three drafts in three personas (Empathetic / Action-oriented / Goal-oriented). The facilitator reviews, optionally edits, sends one.

```json
{
  "participant_id": 101731,
  "cohort_id": 1680,
  "module_id": 337,
  "week_number": 4,
  "activity_id": 12345,
  "activity_type": "Gratitude",
  "post_text": "For Spring 🥰 I've had 2 wonderful days so far being able to get outside, it's lifted my mood.",
  "display_name": "Kristy",
  "engagement": {
    "dropout_risk": 0.039,
    "risk_level": "low",
    "days_since_last_login": 1,
    "current_inactive_streak": 0,
    "cum_activity_count": 12,
    "engagement_slope": 0.3,
    "wrote_first_week_binary": 1
  }
}
```

The `engagement` block is optional but worth passing — it's how the SLM gets risk-aware (urgency tone shifts on high-risk; celebrate-progress tone on low-risk). Source it from the most recent `/predict` response.

**Response (truncated)**

```json
{
  "draft_set_id": "f7e8...",
  "drafts": [
    { "draft_id": "...", "persona": "Empathetic", "label": "Warm personal check-in", "body": "..." },
    { "draft_id": "...", "persona": "Action-oriented", "label": "Small next-step nudge", "body": "..." },
    { "draft_id": "...", "persona": "Goal-oriented", "label": "Goal-focused support", "body": "..." }
  ],
  "memory_used": true,
  "engagement_used": true,
  "model_version": "qwen3-4b-hope-only-lora@abc123",
  "generated_at": "2026-05-26T10:00:00Z"
}
```

Capture `draft_set_id` and each `draft_id` — they're the keys used by the HITL endpoints below.

### 3.2 Memory — `POST /memory/post` and `POST /memory/reply`

Comment-gen retrieves the participant's past posts + the facilitator's prior replies, folds them into the system prompt, and uses them as context for the next draft. Setting `memory_used=true` in the response means retrieval fired.

**Wire one of these per platform event** so the memory store stays in sync:

- Participant submits a new post → `POST /memory/post`
- Facilitator publishes a reply → `POST /memory/reply`

The platform is the **source of truth** for both. Comment-gen's memory is a cache rebuildable from the platform's events.

```bash
# Participant post
curl -X POST https://comment-api.../memory/post \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIG" \
  -d '{
    "activity_id": 12345,
    "participant_id": 101731,
    "cohort_id": 1680,
    "module_id": 337,
    "activity_type": "Gratitude",
    "text": "For Spring 🥰 I have had 2 wonderful days so far...",
    "recorded_at": "2026-03-05T14:36:13Z",
    "source": "platform_webhook"
  }'

# Facilitator reply
curl -X POST https://comment-api.../memory/reply \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIG" \
  -d '{
    "comment_id": 99999,
    "activity_id": 12345,
    "participant_id": 101731,
    "cohort_id": 1680,
    "facilitator_id": "fac-027",
    "text": "Such a lovely thing to be grateful for. Where did you go?",
    "recorded_at": "2026-03-05T15:10:00Z",
    "source": "platform_webhook"
  }'
```

Idempotency: comment-gen dedupes by `(role, activity_id)` and `(role, comment_id)`. Replaying the same event is safe — the response returns `{ "status": "deduped" }`.

`source` is a tag for auditing; the values mean:
- `platform_webhook` — live platform event (the production case)
- `platform_backfill` — historical rebuild from a CSV export
- `json_reconcile` — periodic reconciliation against the platform's JSON API
- `hitl` — written from the facilitator's send action (see 3.3)

### 3.3 HITL — `POST /thumb` and `POST /event`

The facilitator's reaction to a generated draft is captured for offline KTO/DPO training. The platform UI calls these directly from the facilitator's action buttons.

```bash
# Up/down vote on a single draft
curl -X POST .../thumb -d '{
  "draft_id": "...",
  "label": "up",
  "facilitator_id": "fac-027"
}'

# Decision on the draft set (accept / edit / reject / flag)
curl -X POST .../event -d '{
  "draft_set_id": "...",
  "chosen_draft_id": "...",
  "action": "edit",
  "sent_text": "Such a lovely thing to be grateful for — where did you go for your walk?",
  "facilitator_id": "fac-027"
}'
```

**Action constraints (enforced by the schema)**

| `action` | Required | Forbidden |
| --- | --- | --- |
| `accept` | `sent_text` (verbatim of the chosen draft) | — |
| `edit` | `sent_text` (the edited version actually sent) | — |
| `reject` | — | `sent_text` must be null |
| `flag` | `flag_reason` (free text) | — |

On `accept` / `edit`, comment-gen **automatically writes the sent text into memory as a facilitator reply** (the HITL fast path) — you do not need to send a separate `/memory/reply` call for sends that originated from `/generate`. Only call `/memory/reply` for replies the facilitator wrote outside the draft flow.

---

## 4. Recommended integration sequence

For each participant post in the platform:

1. **Write to memory** — `POST /memory/post` (fire-and-forget). Keeps comment-gen current.
2. **Generate drafts** — `POST /generate` with the post text + the participant's most recent `engagement` fingerprint. Show the three drafts in the facilitator UI.
3. **Capture HITL** — when the facilitator acts: `POST /thumb` for votes, `POST /event` for the final decision. Comment-gen handles the memory write-back on accept/edit.

For the weekly risk view (cohort dashboard / facilitator triage list):

1. **Score the cohort** — `POST /batch` with one `ParticipantHistory` per participant. Display the returned `risk_level` + `contributing_factors` + `recommended_actions`.
2. **Cache for ~1 day** — risk scores don't change between events. The dashboard caches by participant_id + score-at-day at TanStack-Query level.

---

## 5. Deployment notes

Both services are stateless apart from comment-gen's SQLite memory store (`outputs/memory.sqlite`) + HITL log (`outputs/hitl.sqlite`). Mount these on a persistent volume in production; otherwise data resets on container restart.

engagement_ml ships its model bundle (~50 MB, all `winner_T{T}.pkl` files) inside the container image — no model-fetch step at startup. comment-gen downloads the configured LoRA adapter at startup via `HF_TOKEN`; cold start is 60–90 s on a fresh container, 2–5 s subsequently.

### Required env vars

| Var | Service | Purpose |
| --- | --- | --- |
| `HOPE_API_AUTH` | both | `enabled` (prod) or `disabled` (local smoke) |
| `HOPE_RISK_API_KEY` | engagement_ml | 32-byte hex API key for X-API-Key auth |
| `HOPE_API_SECRET` | comment-gen | 32-byte hex secret for HMAC auth |
| `HF_TOKEN` | comment-gen | HF read token; only needed if the configured adapter is in a private repo |
| `HOPE_GEN_MODEL_ID` | comment-gen | Which fine-tuned adapter to load. Default: `michaelajao/qwen3-4b-hope-only-lora` |
| `HOPE_DROPOUT_URL` | comment-gen | Optional. URL of engagement_ml's `/predict` for the engagement-aware prompt path. Set to your risk-API base URL |

---

## 6. Quick reference — full endpoint list

**engagement_ml** (`localhost:8000`)
- `GET /health`
- `GET /model/info`
- `POST /predict` (one participant)
- `POST /batch` (many participants)

**comment_generation** (`localhost:8001`)
- `GET /health`
- `GET /version`
- `GET /metrics` (Prometheus)
- `GET /memory/{participant_id}` (debug; read most recent N memory rows)
- `POST /generate`
- `POST /memory/post`
- `POST /memory/reply`
- `POST /memory/batch`
- `DELETE /memory/post/{activity_id}`
- `POST /thumb`
- `POST /event`

Pydantic schemas are the source of truth — see [`comment_generation/service/models.py`](../comment_generation/service/models.py) and [`engagement_ml/deploy/api/schemas.py`](../engagement_ml/deploy/api/schemas.py).
