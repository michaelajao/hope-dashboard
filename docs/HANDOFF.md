# Hope Dashboard — Handoff & Continuation

Last updated: 2026-05-25 · Branch: `main` · Working dir: `c:\Users\ajaoo\Desktop\hope-dashboard`

## TL;DR

You're building a Next.js 16 facilitator dashboard for the Hope Programme. It surfaces dropout risk (engagement_ml) and three persona-conditioned AI-drafted follow-up messages (comment_generation). Both backends are being moved off Coventry HPC onto **private** Hugging Face Spaces so dev no longer requires VPN.

**Status:** Local dashboard runs and renders; the boss's UI concept is implemented as Tier B polish. The two backend Spaces are still pending deployment, so the dashboard's data panels surface error states until then.

The full design plan lives at `C:\Users\ajaoo\.claude\plans\temporal-conjuring-blum.md` — that's the source of truth for *why* things are shaped the way they are. This file is the *where you are right now* index.

## Quick status

| Track | Status | Notes |
|---|---|---|
| Risk backend choice | Done | engagement_ml (not dropout_ml_v2) |
| engagement_ml API: SHAP + factors + actions | Done | Pushed `666a815` |
| Dashboard contract migration to ParticipantHistory/EventRecord | Done | Pushed `ce08b50` |
| engagement_ml/space/ scaffolding | Done | Pushed `189c62e` |
| comment_generation/space/DEPLOY.md — private posture | Done | Pushed `216b1a4` then `d25ef64` |
| engagement_ml per-horizon + ECE table + reliability PDFs script | Done | Pushed `7908e26` |
| `push_to_hf.py` warn-skip + adapter roster refresh | Done | Pushed `d25ef64` |
| First adapter pushed | Done | `qwen3-0.6b-hope-only-lora` |
| Dashboard upgraded next-auth v1 → v5 | Done | Local commit `863c812` — **not yet pushed** |
| Dashboard boots locally + login works | Done | `npm run dev`, dev-allowlist gate |
| **Dashboard UI polish (Step 9)** | Done | Pushed `d975e46` |
| **Hybrid port from hope·move prototype (Step 10)** | **In progress** | 7 design moves cherry-picked from the standalone prototype in [docs/prototype/](prototype/) |
| Adapter push — gemma + Qwen3-4B | Pending | Run when training finishes |
| `scp` engagement_ml models + cumulative panel to laptop | Pending | Needed before Space deploys |
| Deploy `hope-dropout-api` HF Space | Pending | Free CPU, Private |
| Deploy `hope-comment-gen-api` HF Space | Pending | HF Pro + ZeroGPU, Private |
| End-to-end run against deployed Spaces | Pending | Final smoke + lock-down trio |

## What's done

### Backend / research repos (already pushed to GitHub)

1. **engagement_ml API extension** — TreeSHAP `_load_one()`, rule-based factor fallback, action synthesiser, response aliases (`dropout_risk`, `risk_level`, `contributing_factors`, `recommended_actions`). Commit `666a815`.
2. **engagement_ml Space scaffolding** — `space/Dockerfile`, `space/DEPLOY.md`. Commit `189c62e`.
3. **engagement_ml per-horizon metrics** — `scripts/build_horizon_table.py`: per-T AUROC/PR-AUC/Brier/recall/ECE with 1000-bootstrap CIs + reliability diagram PDFs. Commit `7908e26`. Run on HPC when you want the table appended to `reports/REBUILD_SUMMARY.md`.
4. **comment_generation deploy doc** — private-Space posture, engagement_ml as sister Space (not dropout_ml_v2), correct adapter-push invocation. Commits `216b1a4`, `d25ef64`.
5. **comment_generation `push_to_hf.py`** — DEFAULT_TARGETS refreshed to currently-trained adapters (`Qwen3-0.6B_hope-only`, `Qwen3-4B_hope-only`, `gemma-3-1b-it_hope-only`), `KEEPER_FAMILIES` updated, missing-target warn-and-skip wrapper around `push_one()`. Commit `d25ef64`.

### Dashboard (this repo)

6. **Contract migration** — replaced feature-dict `ParticipantFeatures` with `ParticipantHistory`/`EventRecord` to match engagement_ml's API. Proxy auth translates HMAC (comment-gen) ↔ X-API-Key (engagement_ml). `src/lib/demo-features.ts` removed; `src/lib/demo-events.ts` emits deterministic synthetic event histories per demo participant. Commit `ce08b50`.
7. **next-auth v5 fix** — package.json was wrongly pinned to v1.12.1 (legacy Passport package) which pulled Express into the Edge runtime. Bumped to `^5.0.0-beta.31`, removed orphaned `nodemailer`. Local commit `863c812` — **needs push**.
8. **Login wiring** — `.env.local` `FACILITATOR_EMAILS=ajaoolarinoyemichael@gmail.com,demo@hope.local`. Dev-allowlist provider works on http://localhost:3000.
9. **Step 9 — UI polish to match the boss's concept** (uncommitted, on disk):
   - Header band with HOPE brand stripe, four action-oriented KPI tiles with icons
   - Queue: avatars, friendly status badges (*Needs attention / Check in soon / On track*), "Last active N days" line, search field above filter pills
   - Detail panel: info cards row (Activation / Recommended approach / Wellbeing cue), templated AI summary paragraph, 2×3 metric grid (Last active, Discussion posts ±%, Activity types, Facilitator contact, Engagement trend, Activation level), "Why X is highlighted" + actions + recent activity below
   - Drafts column: persona accent on Empathetic switched to rose, recommended-approach callout under drafts, Follow-up activity card with session-local Add-a-note
   - 9 new files in `src/components/` and `src/lib/`; 11 files edited. `npm run typecheck` + `npm run lint` clean.

## What's left

### Step 10 — Hybrid port from the hope·move prototype (in flight)

A standalone prototype lives at [docs/prototype/](prototype/) (HTML + React + concept PNG, mock-data only). We're cherry-picking 7 design moves while keeping all Step 9 layout + backend wiring. Full sub-step breakdown in the master plan at `C:\Users\ajaoo\.claude\plans\temporal-conjuring-blum.md` (§10). Status:

- **10a** — oklch design tokens (replaces hope-purple/coral) — *in progress*
- **10b** — slim topbar + `hope·move` wordmark + inline stats
- **10c** — quantified driver bars in the risk card (needs engagement_ml to emit |SHAP| magnitudes alongside factor strings)
- **10d** — "What this draft is based on" `<details>` disclosure under each DraftCard
- **10e** — Snooze 7d / Dismiss queue actions, zustand-backed
- **10f** — Merge "Recent activity" + "Add a note" into one card
- **10g** — Live "contacted this session" stat in the topbar

Out of scope: tone switcher (we keep 3 persona cards), removing the AI summary or info-cards row (boss wanted them).

### Immediate next steps (you, on Coventry HPC)

1. **`scp` engagement_ml model bundles + comment-gen panel to laptop:**
   ```powershell
   # On laptop (PowerShell):
   scp '<hpc>:~/Research/engagement_ml/models/*' C:/Users/ajaoo/Desktop/engagement_ml/models/
   scp '<hpc>:~/Research/dropout_ml_v2/outputs/artifacts/cumulative_features_panel.parquet' C:/Users/ajaoo/Desktop/comment_generation/space/data/
   ```
   ~50 MB total. Required before either Space can build.

2. **(Optional, parallel)** Re-run `python scripts/push_to_hf.py --owner michaelajao` on HPC after pulling the patched script — picks up `gemma-3-1b-it_hope-only` and `Qwen3-4B_hope-only` once their training output dirs exist. Skips missing roster entries gracefully.

3. **(Optional, parallel)** `python scripts/build_horizon_table.py` on HPC to regenerate per-horizon table + reliability PDFs into `engagement_ml/reports/`.

### Deploy track (laptop)

4. **Deploy `michaelajao/hope-dropout-api` HF Space** (engagement_ml):
   - Create Space — Docker SDK, free CPU 2 vCPU / 16 GB, **Visibility = Private**
   - Set Space secret `API_KEY` = a fresh 32-byte hex; mirror into `.env.local` as `HOPE_RISK_API_KEY`
   - Push from `c:\Users\ajaoo\Desktop\engagement_ml\space\` per the DEPLOY.md
   - Verify with the dual-auth `curl` (HF token + X-API-Key) + the negative-test trio

5. **Deploy `michaelajao/hope-comment-gen-api` HF Space** (comment_generation):
   - Create Space — Docker SDK, **ZeroGPU** (HF Pro $9/mo flat), **Visibility = Private**, auth ENABLED
   - Set Space variables: `HOPE_API_AUTH=enabled`, `HOPE_GEN_MODEL_ID=michaelajao/qwen3-4b-hope-only-lora` (swap when adapter is ready), `HOPE_DROPOUT_URL=https://michaelajao-hope-dropout-api.hf.space/health`, `HOPE_DASHBOARD_ORIGIN=http://localhost:3000`
   - Set Space secret `HOPE_API_SECRET` = the 32-byte hex from `.env.local` (must match exactly)
   - Push from `c:\Users\ajaoo\Desktop\comment_generation\space\` per its DEPLOY.md
   - Wait 60-90 s for ZeroGPU cold start on first `/generate`

### Dashboard wiring (laptop)

6. **Generate HF read-scoped token** at https://huggingface.co/settings/tokens (scope: `read` on `michaelajao/*`).
7. **Update `.env.local`:**
   ```
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   HOPE_RISK_API_KEY=<the API_KEY you set on the dropout Space>
   # COMMENT_GEN_URL + DROPOUT_API_URL stay pointed at the two *.hf.space hosts
   ```
8. **Restart `npm run dev`**, log in, open `/cohorts/1680`. Queue → batch hits → 6 ranked participants → click → risk gauge + factors + actions + AI summary + metric tiles → Generate → three persona drafts.

### Verification (when both Spaces are up)

9. **End-to-end smoke** — log in, walk the participant flow, confirm `model_version: qwen3-4b-hope-only-lora` (or selected adapter) appears, thumb a draft, accept it, check Space logs for `/thumb` + `/event` + memory fast-path.
10. **Lock-down trio** — `curl` each Space from outside with (a) no HF token (expect HF-gateway 401), (b) HF token but no app secret (expect app 401), (c) HF token + app secret but malformed body (expect 422). All three gates must hold.

### Housekeeping

11. **Commit Step 9** locally and push (along with the pending `863c812`):
    ```powershell
    git add src/app/globals.css src/app/cohorts/[cohortId] src/components src/lib docs/HANDOFF.md
    git commit -m "feat(ui): Tier B polish to match facilitator concept"
    git push
    ```
12. The "Add a note" feature is **session-local only** ([src/lib/store/notesStore.ts](../src/lib/store/notesStore.ts)) because comment-gen's memory schema has no freeform-note role today (only `participant_post` + `facilitator_reply` tied to an `activity_id`). When you want real persistence, add an endpoint to comment_generation (e.g. `POST /memory/note`) and swap the zustand store for a `useMutation` that hits it.

## How to resume locally

One-time:
```powershell
Set-Location c:\Users\ajaoo\Desktop\hope-dashboard
npm install
# .env.local already populated (HOPE_API_SECRET, HOPE_RISK_API_KEY, AUTH_SECRET, FACILITATOR_EMAILS)
```

Each session:
```powershell
npm run dev
# open http://localhost:3000
# paste ajaoolarinoyemichael@gmail.com → Continue
# you land on /cohorts → click the IIH cohort → /cohorts/1680
```

Quality gates (run before pushing):
```powershell
npm run typecheck
npm run lint
```

## Decisions worth remembering

Locked-in decisions (don't relitigate without good reason):

- **Risk backend = engagement_ml** (not dropout_ml_v2). Picked on methodology audit + your own self-comparison doc. dropout_ml_v2 stays around as research scaffold for the τ-sweep / detection-vs-forecast ablation.
- **Privacy posture = private everything.** HF Spaces private, adapter model repos private, no public mirror. Three layers: HF gateway token → app-layer secret (HMAC or X-API-Key) → NextAuth-gated proxy. Browser never sees any of the three credentials.
- **Auth split.** comment-gen = HMAC-SHA256 over body (HOPE_API_SECRET). engagement_ml = X-API-Key bearer (HOPE_RISK_API_KEY). Proxy translates per route.
- **Proxy, not direct.** Server-side `/api/proxy/*` routes inject all credentials. Latency cost is one extra hop; worth it.
- **AI summary = templated, not model-generated.** Deterministic, zero extra API call, always available. See `src/lib/summary.ts`.
- **Outer chrome = platform's job.** The concept's left sidebar / top tabs are skipped — we render only the central content. Dashboard sits inside the host learning platform's shell in production.
- **Compute floor = HF Pro + ZeroGPU** for the Qwen3-4B comment-gen Space ($9/mo flat). Free CPU for the engagement_ml Space.

Open questions still parked:

- Final adapter pick (4B hope-only vs 4B hope-ed25 vs a future 8B Unsloth run). Swap via `HOPE_GEN_MODEL_ID` Space variable — no rebuild required.
- "Re-engaged" KPI placeholder (header tile) — needs a tiny historical-predictions store to compute properly. Currently shows `—` with "tracking starts next week" hint.

## Known gaps & deferred features

These were intentionally cut from Step 9 (you can pick them up later):

- Real avatar uploads (today: deterministic initials-on-color via `src/components/avatar.tsx`)
- Persistent left sidebar / top nav (platform chrome)
- Notification bell / activity center
- Standalone participant profile page (the "View participant profile" hint in the concept is a no-op)
- "Session feedback" / "Goal progress" metric tiles — these aren't in the event schema; will land when the platform feed is wired
- Cross-cohort participant search (queue search is local to the current cohort)
- Model-generated AI summary (currently templated)
- Backend persistence for facilitator notes (currently session-local)

## Key paths

| What | Where |
|---|---|
| Master design plan | `C:\Users\ajaoo\.claude\plans\temporal-conjuring-blum.md` |
| Dashboard repo | `c:\Users\ajaoo\Desktop\hope-dashboard\` |
| engagement_ml repo | `c:\Users\ajaoo\Desktop\engagement_ml\` |
| comment_generation repo | `c:\Users\ajaoo\Desktop\comment_generation\` |
| dropout_ml_v2 (supplementary) | `c:\Users\ajaoo\Desktop\dropout_ml_v2\` |
| Dashboard env | `.env.local` (server-side secrets only — never `NEXT_PUBLIC_*` for HF_TOKEN / HOPE_API_SECRET / HOPE_RISK_API_KEY) |
| Three-panel page | [src/app/cohorts/[cohortId]/page.tsx](../src/app/cohorts/%5BcohortId%5D/page.tsx) |
| Brand tokens | [src/app/globals.css](../src/app/globals.css) (`--color-hope-purple`, `--color-hope-coral`) |
| Shared friendly-status mapping | [src/lib/risk.ts](../src/lib/risk.ts) |
| Pure signal helpers | [src/lib/signals.ts](../src/lib/signals.ts) |
| AI summary template | [src/lib/summary.ts](../src/lib/summary.ts) |
| Auth (NextAuth v5) | [src/auth.ts](../src/auth.ts), [src/middleware.ts](../src/middleware.ts) |
