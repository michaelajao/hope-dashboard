# Model deployment & usage

Two ML models back the Hope Facilitator system. They are independent — each can run, scale, and version separately.

| Model | Lives in | What it does | Size | Compute |
| --- | --- | --- | --- | --- |
| **Dropout RF** | `dropout_ml_v2/deploy/models/pooled_model.pkl` | Calibrated Random Forest, predicts weekly dropout risk per participant. AUROC 0.894. | 44 MB | CPU only |
| **Comment-gen SLM** | `comment_generation/models/<adapter>/final/` (15 LoRA adapters available) | Small instruction-tuned LM that drafts three persona-conditioned facilitator replies. | 1–4 GB per adapter | CPU works for ≤1.7B; GPU recommended for 4B |

The rest of this doc explains how to choose, store, ship, swap, and re-train each one.

---

## 1. Dropout RF model

### 1.1 What's in the bundle

`pooled_model.pkl` is a joblib dump of:

```python
{
    "model": CalibratedClassifierCV,    # sklearn pipeline
    "feature_cols": list[str],          # 23 features in training order
    "f1_optimal_threshold": float,      # ~0.20
    "recall_pinned_threshold": float,   # ~0.08
    "recall_target": float,             # 0.85
    "paradigm": str,                    # "pooled_random_forest"
}
```

The API loads the bundle at startup ([`dropout_ml_v2/deploy/api/main.py`](../../dropout_ml_v2/deploy/api/main.py)) and uses `feature_cols` from the bundle (not from a separate config) so the schema can never drift.

### 1.2 Local dev

The bundle ships in the repo. Nothing to download, nothing to mount:

```bash
cd dropout_ml_v2
make api          # uvicorn api.main:app on :8000
```

Or via docker:

```bash
cd dropout_ml_v2
docker build -f deploy/Dockerfile -t hope-dropout-api .
docker run -p 8000:8000 -e HOPE_API_AUTH=disabled hope-dropout-api
```

Or via the dashboard's docker-compose:

```bash
docker compose up dropout-api    # from hope-dashboard/
```

### 1.3 Azure deploy

Azure Container Apps, CPU only, system-assigned identity, ingress internal-only (the dashboard calls it over the Container Apps Environment's private DNS):

```bash
cd hope-dashboard/deploy/azure
az bicep build main.bicep        # validate
azd up                            # provisions ACR/CAE/KV/Storage and deploys
```

The bundle is **baked into the container image** — no Files share needed at this size.

### 1.4 Updating the model

When research produces a new bundle:

```bash
# 1. drop the new file in
cp /path/to/new_pooled_model.pkl dropout_ml_v2/deploy/models/pooled_model.pkl

# 2. verify locally
cd dropout_ml_v2
pytest deploy/tests/test_api.py     # smoke
make api                            # eyeball /model/info

# 3. bump version in dropout_ml_v2/deploy/api/main.py (FastAPI version="2.0.0")
# 4. ship
azd deploy --service dropout-api
```

The container restarts and `lifespan` re-reads the bundle. No env-var change needed.

### 1.5 Re-training

Re-training is on the HPC, not the laptop and not Azure:

```bash
cd dropout_ml_v2
make panel TAU=10 PV=1     # rebuild cumulative_features_panel.parquet
make pooled                 # nested-CV training with Optuna
# winner is written to outputs/artifacts/deploy_pooled_random_forest.pkl
cp outputs/artifacts/deploy_pooled_random_forest.pkl deploy/models/pooled_model.pkl
make tests
```

`make pooled` runs a 5-fold GroupKFold by `user_id` with 30 Optuna trials per fold, calibrates with sigmoid, and locks the operating thresholds. Anything the model touches downstream uses these locked thresholds.

### 1.6 Cumulative-features panel

The comment-generation service also reads `dropout_ml_v2/outputs/artifacts/cumulative_features_panel.parquet` to build engagement context for `/generate` calls. The same `make panel` step regenerates this. In production it's mounted into the comment-api container at `/data/dropout_artifacts/`; the path is set by `HOPE_DROPOUT_PANEL_PATH`.

If the panel file is missing, the comment-api silently falls back to "no engagement context" and `engagement_used: false` in the `/generate` response.

---

## 2. Comment-generation SLM

### 2.1 Adapter registry

15 LoRA adapters live under `comment_generation/models/`. The runtime resolves a chosen adapter by **`HOPE_GEN_MODEL_ID`** env var. The full list is in [`service/generation_service.py`](../../comment_generation/service/generation_service.py) under `MODEL_ID_TO_DIR`:

| `HOPE_GEN_MODEL_ID` | Base model | Augmentation | Notes |
| --- | --- | --- | --- |
| `qwen2.5-1.5b-hope-only` | Qwen2.5-1.5B-Instruct | hope-only | **Default.** Best BERTScore + MI-policy. Runs on CPU. |
| `qwen2.5-1.5b-hope-ed25` | Qwen2.5-1.5B-Instruct | hope-ed25 | ED-augmented variant. |
| `qwen3-4b-hope-ed25` | Qwen3-4B | hope-ed25 | Best BLEU/ROUGE-L. Needs GPU for usable latency. |
| `qwen3-4b-hope-only` | Qwen3-4B | hope-only | |
| `qwen3-1.7b-hope-{only,ed25}` | Qwen3-1.7B | both | Mid-size option. |
| `qwen3-0.6b-hope-{only,ed25}` | Qwen3-0.6B | both | Lightest Qwen variant. |
| `smollm2-1.7b-hope-{only,ed25}` | SmolLM2-1.7B-Instruct | both | |
| `smollm2-360m-hope-{only,ed25}` | SmolLM2-360M-Instruct | both | Smallest, fastest, weakest. |
| `gemma-3-1b-hope-{only,ed25}` | Gemma-3-1B-it | both | HF-gated base. |

Pick the adapter at deploy time, swap with a single env-var change, no rebuild.

### 2.2 Adapter file layout

Each adapter is a directory with the standard PEFT layout:

```
models/Qwen--Qwen2.5-1.5B-Instruct_hope-only/final/
├── adapter_config.json     # references the base model name
├── adapter_model.safetensors
├── tokenizer.json
├── tokenizer_config.json
└── special_tokens_map.json
```

The base model weights are pulled from Hugging Face on first load and cached in `HF_HOME` (the docker-compose maps this to a named volume `hf-cache` so cold start is one-time).

### 2.3 Choosing an adapter

| Use case | Pick |
| --- | --- |
| **Production default** (current) | `qwen2.5-1.5b-hope-only` |
| Laptop dev / no GPU | `qwen2.5-1.5b-hope-only` (5–15 s per persona × 3 = 15–45 s cold call) — or use `HOPE_DISABLE_GENERATION=1` to short-circuit to the deterministic stub |
| Azure GPU SKU when paper-grade quality matters | `qwen3-4b-hope-ed25` |
| Offline kiosk (no Hugging Face) | bake the base-model cache into the image (see §2.5) |

All choices are reversible by editing one env var and restarting the container.

### 2.4 Local dev

**Option A — full local generation (slow on CPU, real on GPU):**

```bash
cd hope-dashboard
cp .env.example .env
# edit .env: set HOPE_API_SECRET, leave HOPE_GEN_MODEL_ID at default
docker compose up comment-api
```

First request takes 30–60 s (model download + load). Subsequent calls are 5–15 s on CPU, sub-second on GPU. The `hf-cache` named volume keeps the base weights across restarts.

**Option B — stub generation (instant, deterministic):**

```bash
HOPE_DISABLE_GENERATION=1 docker compose up comment-api
```

Returns the same three drafts every call. Use this when you're working on dashboard UI and don't need real model output.

**Option C — direct uvicorn (HPC, fastest iteration):**

```bash
cd comment_generation
HOPE_API_AUTH=disabled \
HOPE_GEN_MODEL_ID=qwen2.5-1.5b-hope-only \
uvicorn service.main:app --host 0.0.0.0 --port 8001
```

### 2.5 Azure deploy — adapter delivery

Adapters are **mounted from Azure Files**, not baked into the image. Reasons:

- Each adapter is 1–4 GB. Baking into images means 5–20 GB pulls and slow cold starts.
- Swapping adapters is just `HOPE_GEN_MODEL_ID=qwen3-4b-hope-ed25` + revision restart — no rebuild.

The Bicep template provisions an Azure Storage account with a Files share named `lora-adapters`. After `azd up` provisions infra, upload the directory once:

```bash
# from the HPC, where the adapters live
az storage file upload-batch \
    --source ./comment_generation/models \
    --destination lora-adapters \
    --account-name <STORAGE_ACCOUNT_NAME>
```

The comment-api Container App mounts this share read-only at `/app/models`. Any adapter present on the share can be selected by changing `HOPE_GEN_MODEL_ID`.

To upload only the production default and save space:

```bash
az storage file upload-batch \
    --source ./comment_generation/models/Qwen--Qwen2.5-1.5B-Instruct_hope-only \
    --destination lora-adapters/Qwen--Qwen2.5-1.5B-Instruct_hope-only \
    --account-name <STORAGE_ACCOUNT_NAME>
```

The dir name on the share must match the value in `MODEL_ID_TO_DIR` for `HOPE_GEN_MODEL_ID` to resolve.

### 2.6 Swapping the production adapter

Zero-downtime swap on Azure:

```bash
# 1. confirm the new adapter is on the share
az storage file list --account-name <STORAGE_ACCOUNT_NAME> \
    --share-name lora-adapters | grep <new-adapter-dir>

# 2. update the env var on the Container App (creates a new revision)
az containerapp update \
    -n hope-dev-comment-api -g hope-rg \
    --set-env-vars HOPE_GEN_MODEL_ID=qwen3-4b-hope-ed25

# 3. once the new revision is healthy, the old one drains automatically
```

Rollback: re-run the same command with the previous adapter id.

### 2.7 GPU upgrade

The default Bicep ships a CPU comment-api (2 vCPU, 4 GiB) suitable for `qwen2.5-1.5b`. For `qwen3-4b` you want GPU:

1. Add a Consumption-GPU workload profile to the managed environment in [`main.bicep`](azure/main.bicep):
   ```bicep
   workloadProfiles: [
     { name: 'Consumption', workloadProfileType: 'Consumption' }
     { name: 'gpu-a100',    workloadProfileType: 'Consumption-GPU-NC24-A100' }
   ]
   ```
2. In [`modules/containerapp-comment-gen.bicep`](azure/modules/containerapp-comment-gen.bicep), set `workloadProfileName: 'gpu-a100'` and bump resources (e.g. `cpu: json('4.0')`, `memory: '16.0Gi'`).
3. `azd provision` re-applies infra. The base image already has CUDA 12.4 + bitsandbytes 4-bit so no Dockerfile change.
4. Set `HOPE_GEN_MODEL_ID=qwen3-4b-hope-ed25`.

Cost: the GPU profile is meaningfully more expensive than CPU. Consider scaling `minReplicas: 0` with a slow ramp if traffic is bursty.

### 2.8 Re-training a new adapter

On the HPC, with GPU:

```bash
cd comment_generation
# 1. confirm splits are still leakage-clean
pytest tests/test_splits.py

# 2. fine-tune (configs in src/config.py)
python -m src.finetune_qlora \
    --base_model Qwen/Qwen2.5-1.5B-Instruct \
    --augmentation hope-only \
    --epochs 3 --rank 16

# 3. evaluate on multi-ref test
python -m src.evaluate --run-dir outputs/experiments/<new-run>

# 4. compare against the consolidated table
python scripts/consolidate_multiref_results.py
```

If the new adapter wins: copy it under `models/`, add an entry to `MODEL_ID_TO_DIR`, push to the Azure Files share, then swap as in §2.6.

### 2.9 Safety pipeline (always-on)

The model is wrapped by a rule-based safety stack the runtime always applies:

- **Input filter** (`src/safety/input_filter.py`): crisis lexicon. Hard-block categories (self-harm, others-harm, medical emergency) → `/generate` returns acknowledgement-only drafts + `safety_signposting` text. Soft-flag (`crisis_distress`) → generation proceeds but the output filter is stricter.
- **Output filter** (`src/safety/output_filter.py`): runs `mi_scorer.check_policy` on each draft. Hard violations (diagnostic language, medication mention, URLs) trigger one regenerate attempt; if it still fails, the best-of-N draft is returned with violations attached.
- **Signposting** (`src/safety/signposting.py`): UK templates (Samaritans, SHOUT, NHS 111).

You cannot turn the safety pipeline off without editing the route. `HOPE_DISABLE_GENERATION=1` short-circuits *generation*, not safety.

### 2.10 Memory / engagement context

`/generate` enriches the prompt with two optional context blocks:

1. **Memory** — chronological + activity-type-boosted retrieval from `outputs/memory.sqlite`, scoped to `(participant_id, cohort_id)`. Cold-start (zero rows) drops the block silently.
2. **Engagement fingerprint** — one-line summary from `cumulative_features_panel.parquet` for `(participant_id, week_number, module_id)`. Missing rows drop the block silently.

`memory_used` and `engagement_used` are returned in the response so the dashboard can show "personalised" badges only when context was actually injected.

To pre-warm memory for a new cohort: call `POST /memory/post` and `/memory/reply` per historical activity, or run `python scripts/backfill_memory_from_json.py --cohort-id <id>` against the platform export.

---

## 3. Operational matrix

| Concern | Dropout RF | Comment-gen SLM |
| --- | --- | --- |
| Where the artifact lives | Baked in image | Azure Files share |
| Update without rebuild | No (rebuild + redeploy) | Yes (env-var swap) |
| Compute | CPU 0.5 vCPU | CPU 2 vCPU baseline; GPU optional |
| Cold-start latency | <2 s | 30–60 s (download + load) |
| Per-call latency | <100 ms | 5–15 s CPU / <1 s GPU per persona × 3 |
| Critical env vars | `MODEL_PATH`, `HOPE_API_SECRET`, `HOPE_API_AUTH` | `HOPE_GEN_MODEL_ID`, `HOPE_API_SECRET`, `HOPE_API_AUTH`, `HOPE_DROPOUT_URL`, `HOPE_DROPOUT_PANEL_PATH`, `HOPE_DASHBOARD_ORIGIN` |
| Re-training cadence | Quarterly (more if cohort drift) | When the benchmark winner changes |
| Re-training compute | HPC CPU/GPU; nested CV is 30–60 min | HPC GPU; QLoRA fine-tune is 1–4 h per adapter |
| Calibration check | `make tests` (DeLong, Brier, ECE) | Multi-ref BLEU/ROUGE/BERTScore + MI-policy compliance |
