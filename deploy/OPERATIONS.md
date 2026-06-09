# Operations — deploy, models, runbook

How to deploy the two backing services, manage the models they serve, and
operate them day-to-day. The **API contract** is not duplicated here — that
lives in [INTEGRATION.md](../INTEGRATION.md) (wire reference) and the
authoritative [`comment_generation/docs/openapi.yaml`](../../comment_generation/docs/openapi.yaml).
For *why* the system is shaped this way, see [ARCHITECTURE.md](../ARCHITECTURE.md).

| Service | Repo | Port | Auth | Serves |
| --- | --- | --- | --- | --- |
| **engagement_ml** | [`engagement_ml`](https://github.com/michaelajao/engagement_ml) | 8000 | `X-API-Key: $HOPE_RISK_API_KEY` | dropout risk: per-horizon RandomForest + Platt + TreeSHAP |
| **comment_generation** | [`comment_generation`](https://github.com/michaelajao/comment_generation) | 8001 (8011 on Brosnan HPC — `:8001` is held by JupyterHub) | `X-HMAC-Signature` over raw body, key `$HOPE_API_SECRET` | persona reply drafting + memory + HITL |

> Risk backend note: the production risk service is **engagement_ml**, not the
> older `dropout_ml_v2`. The latter remains only as a research scaffold (τ-sweep
> / detection-vs-forecast ablation in the paper); it is not deployed.

Read endpoints (`/health`, `/version`, `/model/info`, `/admin/models`) are
always open. Both services honour `HOPE_API_AUTH=disabled` to bypass app-layer
auth for local smoke tests — never in production. When the services run as
**private HF Spaces**, every request additionally needs
`Authorization: Bearer $HF_TOKEN` (the gateway gate); the dashboard's
server-side proxy injects all three credentials so the browser never sees them.

---

## 1. Deployment paths

Three ways the backends run. The dashboard only follows `COMMENT_GEN_URL` /
`DROPOUT_API_URL`, so switching paths is an env change, not a code change.

| Path | When | Reference |
| --- | --- | --- |
| **HF Space** (Docker SDK, private) | shareable always-on endpoint | [`comment_generation/space/DEPLOY.md`](../../comment_generation/space/DEPLOY.md) — authoritative |
| **HPC + SSH tunnel** | freshest weights, no Space rebuild; demo/dev | [README → "Run against the HPC"](../README.md) |
| **Azure Container Apps** | aspirational; never deployed | [`deploy/azure/README.md`](azure/README.md) |

### HPC (current demo path)

The comment-gen service runs on **Brosnan** (`bronan` SSH alias) on `:8011`,
reading adapters from its `models/` or pulling Hub ids into the HF cache:

```bash
# on bronan
cd ~/Research/comment_generation
HOPE_API_AUTH=disabled \
HOPE_GEN_MODEL_ID=michaelajao/qwen3-4b-hope-forum-clean-lora \
uvicorn service.main:app --host 0.0.0.0 --port 8011

# on the laptop — forward the port, then point COMMENT_GEN_URL at it
ssh -N -L 8011:localhost:8011 bronan
```

---

## 2. Comment-generation models (the SLM)

### 2.1 Roster

The runtime resolves the adapter from `HOPE_GEN_MODEL_ID`. The dashboard's
model picker lists the **published Hub adapters** (`HOSTED_MODELS` in
[`service/generation_service.py`](../../comment_generation/service/generation_service.py),
surfaced by `GET /admin/models`); local on-disk ids in `MODEL_ID_TO_DIR` are
resolvable by env but intentionally hidden from the picker.

| `HOPE_GEN_MODEL_ID` (Hub id) | Picker label | Corpus |
| --- | --- | --- |
| `michaelajao/qwen3-4b-hope-forum-clean-lora` | Qwen3 4B (forum) | **Default.** Production keeper |
| `michaelajao/qwen3-4b-hope-only-v5-lora` | Qwen3 4B (activities) | activity posts only |
| `michaelajao/qwen3-1.7b-hope-forum-clean-lora` | Qwen3 1.7B (forum) | forum + activities |
| `michaelajao/qwen3-0.6b-hope-forum-clean-lora` | Qwen3 0.6B (forum) | economy; runs on CPU |
| `michaelajao/qwen3-8b-hope-forum-clean-lora` | Qwen3 8B (forum) | ⚠️ Hub repo not published — selecting errors |
| `michaelajao/smollm3-3b-hope-only-lora` | SmolLM3 3B (activities) | cross-arch |
| `michaelajao/llama-3.2-3b-instruct-hope-only-lora` | Llama 3.2 3B (activities) | cross-arch |
| `michaelajao/qwen3.5-4b-hope-forum-lora` | Qwen3.5 4B (forum, experimental) | research artifact |
| `michaelajao/gemma-4-e4b-it-hope-forum-lora` | Gemma-4 E4B (forum, experimental) | research artifact; omits `[name]` slot |

`/generate` returns **2–3 persona drafts** for activity posts (Gratitude → 2:
Empathetic + Goal-oriented; others → 3) and **1 warm reply** for `Discussion`
(forum) posts. `activity_type="Emotions"` is rejected (422) — no training signal
post-clean.

### 2.2 Swap the adapter

- **At runtime, per workshop:** the dashboard topbar `ModelPicker` → `POST /admin/model`.
  The Space/process unloads the current adapter and loads the new one (~15–30 s).
  Selection is server-side global state — it affects every concurrent caller.
- **By env:** set `HOPE_GEN_MODEL_ID` and restart (Space factory-reboot, or re-run
  uvicorn on the HPC). Re-pushed weights to an **existing** Hub repo need a restart
  to re-fetch; new repos/ids are picked up on next load. No rebuild for either.

### 2.3 Retrain (HPC, GPU)

```bash
cd comment_generation
pytest tests/test_splits.py                 # confirm splits are leakage-clean
python -m src.finetune_dora --base_model <hf-id> --augmentation hope-forum ...
python -m src.evaluate --run-dir outputs/experiments/<new-run>
python scripts/push_to_hf.py --owner michaelajao --only <id>   # → private Hub repo
# then restart/swap (§2.2). See comment_generation/docs/hf_backup.md.
```

The recipe is DoRA (4-bit nf4 + DoRA), not plain QLoRA. Weights pushed to a repo
— not its name — set the corpus, so several `-hope-only`/`-v5` repo ids now host
forum-trained adapters.

---

## 3. Dropout-risk models (engagement_ml)

Per-horizon RandomForest, one model per trained horizon `T ∈ {7,14,21,28,35,42}`,
each with a Platt calibrator. Bundles total ~50 MB and are baked into the
container image — no fetch at startup.

```
deploy/models/
  winner_T7.pkl  winner_T14.pkl … winner_T42.pkl      # RandomForest per horizon
  platt_T7.pkl   platt_T14.pkl  … platt_T42.pkl        # calibration
  feature_names_T*.json  model_card_T*.json            # audit
```

Validated AUC ~0.94 LOCO. The dashboard's week selector (W1–W6) maps each week to
one horizon; weeks are capped at `min(programmeLengthDays/7, 6)` (no T=49 model).

**Update:** drop new `winner_T{T}.pkl` + `platt_T{T}.pkl` into the mounted
`models/` and restart — bundles load on startup, not per-request. **Retrain** on
the HPC; see [`engagement_ml`](https://github.com/michaelajao/engagement_ml). The
comment-gen engagement-fingerprint prompt path also reads
`cumulative_features_panel.parquet` (path set by `HOPE_DROPOUT_PANEL_PATH`); if
absent, `/generate` returns `engagement_used: false` and proceeds.

---

## 4. Required env vars

| Var | Service | Purpose |
| --- | --- | --- |
| `HOPE_API_AUTH` | both | `enabled` (prod) or `disabled` (local smoke) |
| `HOPE_RISK_API_KEY` | engagement_ml | 32-byte hex `X-API-Key` |
| `HOPE_API_SECRET` | comment-gen | 32-byte hex HMAC secret |
| `HOPE_GEN_MODEL_ID` | comment-gen | adapter to load. Default `michaelajao/qwen3-4b-hope-forum-clean-lora` |
| `HF_TOKEN` | comment-gen | HF read token — needed to `snapshot_download` private adapters and to hit a private Space |
| `HOPE_DROPOUT_URL` | comment-gen | optional; engagement_ml `/health` for the engagement-aware prompt path |
| `HOPE_DROPOUT_PANEL_PATH` | comment-gen | optional; path to `cumulative_features_panel.parquet` |
| `HOPE_DASHBOARD_ORIGIN` | comment-gen | CORS allowlist on `/generate` |

The dashboard's matching `.env.local` keys (`COMMENT_GEN_URL`, `DROPOUT_API_URL`,
`HOPE_API_SECRET`, `HOPE_RISK_API_KEY`, `HF_TOKEN`) must align with whatever the
services run with. See [README → Pointing at the backend](../README.md).

---

## 5. Runbook

### Restart / reload

- **HF Space:** Settings → Factory reboot (reloads adapter + re-reads env).
- **HPC:** stop and re-run the `uvicorn` command (§1).
- **Azure (aspirational):** `az containerapp revision restart -n <app> -g <rg> --revision <name>`.

### Health & smoke

```bash
curl -s http://localhost:8011/health        # comment-gen: {"status":"healthy","model_loaded":true,...}
curl -s http://localhost:8011/version       # {"model_version":"michaelajao/qwen3-4b-hope-forum-clean-lora",...}
curl -s http://localhost:8011/admin/models  # the picker roster (current + options)
curl -s http://localhost:8000/health        # engagement_ml: {"status":"ok","horizons":[7,14,...]}
```

For a signed `/generate` smoke, drive it through the dashboard's
`/api/proxy/generate` route (it signs server-side) rather than hand-rolling HMAC.

### Inspect HITL signals (local)

```bash
sqlite3 comment_generation/outputs/hitl.sqlite \
  "SELECT ts, action, edit_distance FROM hitl_drafts ORDER BY id DESC LIMIT 20;"
```

### Error reference

| Symptom | Cause | Fix |
| --- | --- | --- |
| 401 `invalid HMAC signature` (comment-gen) | `HOPE_API_SECRET` mismatch dashboard ↔ service | align the secret, or run both with `HOPE_API_AUTH=disabled` for dev |
| 401 from a `*.hf.space` host | missing/invalid `HF_TOKEN` (private-Space gateway) | set a read-scoped `HF_TOKEN` |
| 404 on `/event` | `chosen_draft_id` not logged (service restarted between generate and event) | re-issue `/generate`, use the new ids |
| 422 on `/generate` | Pydantic validation — missing `post_text`, bad `activity_type` (e.g. `Emotions`) | fix the payload per the response detail |
| picker swap to "Qwen3 8B (forum)" fails | the 8B Hub repo isn't published | pick another adapter, or push the repo |
| `dropout_api: unreachable` in `/health` | comment-gen can't reach `HOPE_DROPOUT_URL` | only affects engagement enrichment; risk panel reads engagement_ml directly |
| `engagement_used: false` always | panel parquet missing / wrong `HOPE_DROPOUT_PANEL_PATH` | re-vendor the parquet; generation still works |
| `memory_used: false` for a known participant | no memory rows for `(participant_id, cohort_id)` | backfill via `/memory/batch` or the backfill CLI |

---

## 6. Related docs

- [INTEGRATION.md](../INTEGRATION.md) — API wire contract for platform callers
- [ARCHITECTURE.md](../ARCHITECTURE.md) — why the system is shaped this way
- [SELF_HOSTING.md](../SELF_HOSTING.md) — bring the backends in-house (Docker)
- [deploy/azure/](azure/) — aspirational Azure Container Apps scaffolding
- [comment_generation/space/DEPLOY.md](../../comment_generation/space/DEPLOY.md) — HF Space deploy (authoritative)
- [comment_generation/docs/openapi.yaml](../../comment_generation/docs/openapi.yaml) — authoritative OpenAPI spec
