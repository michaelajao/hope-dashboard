# Self-hosting the Hope Move backends

For when Hope Move wants to bring the two services in-house. Pair this with [INTEGRATION.md](INTEGRATION.md) — that's the wire contract; this is the build-and-run.

You're hosting two independent FastAPI services. They can run on the same VM or separate ones; they only talk to each other if you opt comment-gen into the engagement-aware prompt path (see §3).

| Service | Image base | Compute floor | Compute recommended |
| --- | --- | --- | --- |
| **engagement_ml** | `python:3.11-slim` | 2 vCPU / 1 GB RAM | 2 vCPU / 4 GB RAM |
| **comment_generation** | `python:3.11-slim` + CUDA optional | 1× T4 (16 GB) for Qwen3-4B in 4-bit | 1× A10G or A100 (24 GB+) for fp16 |

engagement_ml is small (Random Forest + Platt + TreeSHAP). comment_generation is the GPU-heavy one — it serves a fine-tuned LLM.

---

## 1. engagement_ml

### 1.1 Get the code + models

```bash
git clone https://github.com/michaelajao/engagement_ml.git
cd engagement_ml

# Download the trained model bundles (30 files, ~50 MB total).
# Six horizons × {winner_T{T}.pkl, platt_T{T}.pkl, feature_medians_T{T}.json,
# feature_names_T{T}.json, model_card_T{T}.json}.
# Bundles are produced by `src/optuna_runner.py`; for the production deploy
# we ship the audited ones — contact the model owner for a signed release.
mkdir -p deploy/models
# scp / object-store / artifact-registry — your call. The directory layout:
ls deploy/models/
# winner_T7.pkl   winner_T14.pkl  winner_T21.pkl
# winner_T28.pkl  winner_T35.pkl  winner_T42.pkl
# platt_T7.pkl    platt_T14.pkl   platt_T21.pkl  ...
# feature_names_T7.json  ...  model_card_T7.json  ...
```

### 1.2 Dockerfile

A minimal one — `engagement_ml` doesn't ship its own yet, but this is the deploy contract.

```dockerfile
FROM python:3.11-slim

# LightGBM needs libgomp1 at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY deploy/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY deploy/api ./api
COPY deploy/models ./models
COPY src ./src
COPY config ./config

ENV MODEL_DIR=/app/models \
    HOPE_API_AUTH=enabled \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 1.3 Run

```bash
docker build -t hope-engagement .
docker run -d --name hope-engagement \
  -p 8000:8000 \
  -e API_KEY="<32-byte hex>" \
  hope-engagement

# Health
curl http://localhost:8000/health
# {"status":"ok","horizons":[7,14,21,28,35,42],"winner_architecture":"random_forest"}
```

### 1.4 Update path

Drop new `winner_T{T}.pkl` + `platt_T{T}.pkl` files into the mounted `models/` volume and restart the container. The service loads bundles on startup, not per-request.

---

## 2. comment_generation

### 2.1 Get the code + adapter

```bash
git clone https://github.com/michaelajao/comment_generation.git
cd comment_generation

# The deployed adapter is published as a private HF model repo.
# To download once (the Space image pulls it on startup; for self-hosted
# you can either bake it into the image or mount it):
huggingface-cli login   # token with read access to michaelajao/*
huggingface-cli download michaelajao/qwen3-4b-hope-only-lora \
  --local-dir models/qwen3-4b-hope-only-lora

# Alternative: keep startup-fetch by passing HF_TOKEN at container run
# time and setting HOPE_GEN_MODEL_ID — the service will snapshot_download
# the adapter the first time `/generate` is called.
```

### 2.2 Dockerfile

Already in the repo: [`comment_generation/space/Dockerfile`](https://github.com/michaelajao/comment_generation/blob/main/space/Dockerfile). Works for self-hosted too. Two run-time decisions:

**For fp16 (cleanest quality, ≥24 GB VRAM)**
```bash
docker run -d --name hope-commentgen \
  -p 8001:8001 \
  --gpus all \
  -e HOPE_API_SECRET="<32-byte hex>" \
  -e HOPE_API_AUTH="enabled" \
  -e HOPE_GEN_MODEL_ID="michaelajao/qwen3-4b-hope-only-lora" \
  -e HF_TOKEN="<read-scoped token>" \
  -v $(pwd)/data/memory:/app/outputs \
  hope-commentgen
```

**For 4-bit (fits on T4 16 GB)** — set in the service config or pass `BNB_4BIT=1` (see `service/settings.py`). Throughput drops ~30 % vs fp16; quality is comparable on this task.

### 2.3 Persistence

Comment-gen writes two SQLite files under `outputs/`:

- `memory.sqlite` — participant-post + facilitator-reply store (rebuildable from the platform's events)
- `hitl.sqlite` — facilitator HITL signals (thumbs + accept/edit/reject/flag). **Not rebuildable** — losing this loses training signal.

Mount `outputs/` on a persistent volume. Backup `hitl.sqlite` daily.

### 2.4 Run + health

```bash
curl http://localhost:8001/health
# {"status":"ok","model_loaded":true,"adapter":"qwen3-4b-hope-only-lora", ...}
```

Cold start: 60–90 s on first call (LoRA load + first compile). Subsequent generates: 2–5 s on GPU, 30–80 s on CPU (don't).

### 2.5 Adapter swap

The fine-tuned LoRA adapter is a runtime variable. To deploy a new fine-tune (e.g. a higher-quality Qwen3-4B retrained on richer HITL data):

1. Push the new adapter to HF as a new private repo
2. Restart comment-gen with `HOPE_GEN_MODEL_ID=michaelajao/<new-repo>`
3. No code change, no model.bin in the image

The candidate adapters live at <https://huggingface.co/michaelajao>; current default is documented in [`comment_generation/space/DEPLOY.md`](https://github.com/michaelajao/comment_generation/blob/main/space/DEPLOY.md).

---

## 3. Wiring them together (optional)

By default the two services are independent. comment-gen can also call engagement_ml's `/predict` mid-prompt to fold the latest risk score into the prompt context, so the LLM's tone is risk-aware even when the platform forgot to pass `engagement` in the request body.

Set on comment-gen:
```bash
HOPE_DROPOUT_URL=http://hope-engagement:8000
```

If you put both behind the same Docker network, comment-gen will auto-fetch risk for every `/generate` call where the request body's `engagement` block is missing. Slight latency tax (~50ms intra-VM). Skip if you'd rather let the platform pass the engagement fingerprint explicitly.

---

## 4. Secrets

Generate fresh on the Hope Move side; do not reuse the dashboard's `.env.local` values.

```bash
openssl rand -hex 32   # HOPE_API_SECRET (comment-gen HMAC)
openssl rand -hex 32   # API_KEY        (engagement_ml X-API-Key)
```

Rotation: deploy the new secret value on both the service and every caller in lockstep — there's no dual-secret grace window in either service today. Plan downtime for the cutover or front the service with a thin auth proxy that supports two acceptable values.

---

## 5. Health, metrics, logs

| What | Where |
| --- | --- |
| Liveness | `GET /health` on both services |
| Model audit | `GET /model/info` on engagement_ml; `GET /version` on comment-gen |
| Prometheus metrics | `GET /metrics` on comment-gen (request latency, generate-time histogram, memory-hit rate) |
| Application logs | stdout — both use uvicorn's structured access log + Python `logging` |

For production: scrape `/metrics` into your Prometheus/Grafana stack; alert on `hope_generate_latency_seconds{quantile="0.95"} > 8`.

---

## 6. What you do NOT need to host

- The `hope-dashboard` Next.js app in this repo — it's the research surface, not production
- Hugging Face — only relevant for adapter downloads on startup; everything else runs locally
- A model registry — engagement_ml ships its bundles with the image; comment-gen uses HF Hub for adapters only

---

## 7. If you need to bring your own model

The interfaces are stable, the implementations are swappable:

- **engagement_ml**: any model that takes a `ParticipantHistory` (see [INTEGRATION.md §2](INTEGRATION.md)) and returns a `PredictResponse` works. To swap, replace `deploy/api/inference.py:_load_one` and `score_one`; keep the FastAPI surface intact
- **comment_generation**: any backend that takes a `RichGenerateRequest` and returns a `GenerateResponse` with 3 drafts works. To swap (e.g. an OpenAI-backed implementation for an internal pilot), replace `service/generation_service.py:GenerationService.generate`; keep the routers + memory layer intact

Pydantic schemas in [`models.py`](https://github.com/michaelajao/comment_generation/blob/main/service/models.py) and [`schemas.py`](https://github.com/michaelajao/engagement_ml/blob/main/deploy/api/schemas.py) are the source of truth.
