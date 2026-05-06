# Key Vault secret schema

The Bicep templates expect these named secrets in the same Key Vault. Seed with `az keyvault secret set` before first `azd deploy`.

| Secret name | Required | Purpose | Suggested generation |
| --- | --- | --- | --- |
| `hope-api-secret` | always | HMAC-SHA256 shared secret used by all three apps for request signing | `openssl rand -hex 32` |
| `auth-secret` | always | NextAuth JWT/session cookie encryption key | `openssl rand -base64 32` |
| `email-server-host` | only if `nodemailer` is the active dashboard auth provider | SMTP host (e.g. `smtp.sendgrid.net`) | n/a |
| `email-server-port` | only if `nodemailer` is enabled | SMTP port (typically `587`) | n/a |
| `email-server-user` | only if `nodemailer` is enabled | SMTP username | n/a |
| `email-server-password` | only if `nodemailer` is enabled | SMTP password / API key | n/a |
| `email-from` | only if `nodemailer` is enabled | From address shown on magic-link emails | n/a |

## Seeding example

```bash
KV=hope-dev-kv
az keyvault secret set --vault-name $KV --name hope-api-secret --value "$(openssl rand -hex 32)"
az keyvault secret set --vault-name $KV --name auth-secret --value "$(openssl rand -base64 32)"
```

## Rotation

`hope-api-secret` rotation is a coordinated three-app revision:

1. Generate new secret + write to Key Vault as a new version.
2. Trigger a revision rollout on dropout-api first (it can serve traffic with either secret while clients catch up).
3. Trigger comment-api revision.
4. Trigger dashboard revision last (it does the signing — once it picks up the new secret, the new HMAC value is what hits the backends).

Container Apps automatically rolls revisions when `keyVaultUrl` secret references resolve a new version, but in practice you want to control the order — hold the dashboard rollout until the backends are confirmed.
