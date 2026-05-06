# Azure Container Apps deployment scaffolding

Three Container Apps (dashboard, comment-api, dropout-api) sharing one Container Apps Environment, with adapters delivered via Azure Files mount and secrets stored in Key Vault. No actual deploy here — just Bicep + `azd` config that you can validate locally with:

```bash
az bicep build hope-dashboard/deploy/azure/main.bicep
```

## Topology

```
                       https
                         │
                 ┌───────┴───────┐
                 │   dashboard   │  Container App, public ingress :3000
                 │   (Next.js)   │
                 └────┬─────┬────┘
                      │     │  internal http (compose-internal DNS)
       ┌──────────────┘     └──────────────┐
       ▼                                    ▼
┌──────────────┐                   ┌──────────────┐
│ comment-api  │ ←── Azure Files ──│ Storage Acct │  shareName=lora-adapters
│  (FastAPI)   │   read-only       │ /app/models  │
└──────┬───────┘                   └──────────────┘
       │ http /health probe
       ▼
┌──────────────┐
│ dropout-api  │
│  (FastAPI)   │
└──────────────┘
```

## Env-var matrix

| Variable | Source | Notes |
| --- | --- | --- |
| `HOPE_API_SECRET` | Key Vault secret `hope-api-secret` | Shared by all three apps |
| `AUTH_SECRET` | Key Vault secret `auth-secret` | NextAuth — dashboard only |
| `HOPE_API_AUTH` | Plain | `enabled` in prod, `disabled` only for smoke test |
| `HOPE_GEN_MODEL_ID` | Plain | Adapter id; flip without rebuild |
| `HOPE_DROPOUT_URL` | Plain | Internal URL of dropout-api `/health` |
| `HOPE_DASHBOARD_ORIGIN` | Plain | Dashboard FQDN for CORS |
| `HOPE_DROPOUT_PANEL_PATH` | Plain | `/data/dropout_artifacts/cumulative_features_panel.parquet` |
| `COMMENT_GEN_URL` / `DROPOUT_API_URL` | Plain | Internal DNS of the comment-api / dropout-api |
| `AUTH_URL` | Plain | Public dashboard URL |
| `FACILITATOR_EMAILS` | Plain | Comma-separated allowlist |
| SMTP creds | Key Vault | Only when `nodemailer` is the active provider |

## Adapter delivery

Adapters live on an Azure Files share `lora-adapters` mounted read-only into comment-api at `/app/models`. After `azd up` provisions the storage account, upload the adapter directory once:

```bash
az storage file upload-batch \
    --source ./comment_generation/models \
    --destination lora-adapters \
    --account-name <STORAGE_ACCOUNT_NAME>
```

To switch adapters in production: change `HOPE_GEN_MODEL_ID` env var on the comment-api Container App revision and trigger a restart. No rebuild, no re-upload.

## Pre-flight

```bash
az login
az account set --subscription <SUB_ID>
az group create -n hope-rg -l uksouth
az acr create -n <ACR_NAME> -g hope-rg --sku Basic

azd init -e dev   # creates .azure/dev/.env
azd env set ACR_NAME <ACR_NAME>
azd env set HOPE_GEN_MODEL_ID qwen2.5-1.5b-hope-only
```

## Deploy

```bash
azd up           # provisions infra and pushes images
# or:
azd provision    # infra only
azd deploy       # images only
```

## GPU upgrade

To run Qwen3-4B at production latency, change `containerapp-comment-gen.bicep`:

1. Add a GPU workload profile to `main.bicep` `Microsoft.App/managedEnvironments` (e.g. `NC24-A100`).
2. Set the comment-api container's `workloadProfileName` to that profile.
3. Bump `resources.cpu` and `resources.memory`.
4. Flip `HOPE_GEN_MODEL_ID=qwen3-4b-hope-ed25` env var.

Restart the revision; no re-upload of adapters needed if both adapters are on the same Files share.

## Key Vault secrets

Provisioned outside this template (or seed via `az keyvault secret set`):

| Secret | Purpose |
| --- | --- |
| `hope-api-secret` | HMAC shared by all three apps |
| `auth-secret` | NextAuth cookie encryption key |
| `email-server-host` / `email-server-user` / `email-server-password` | Optional; only when `nodemailer` is enabled |

The Container App system-assigned identities need `Key Vault Secrets User` RBAC role on the vault. Grant after deployment:

```bash
for app in hope-dev-dropout-api hope-dev-comment-api hope-dev-dashboard; do
    PRINCIPAL=$(az containerapp identity show -n $app -g hope-rg --query principalId -o tsv)
    az role assignment create \
        --role "Key Vault Secrets User" \
        --assignee $PRINCIPAL \
        --scope $(az keyvault show -n hope-dev-kv --query id -o tsv)
done
```
