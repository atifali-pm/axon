# Cloudflare Tunnel setup

Step-by-step to route `app.yourdomain.xyz`, `api.*`, `langfuse.*`, `grafana.*`, `admin.*` to your Oracle VM without opening any inbound ports.

## 1. Create a tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**.

- Tunnel name: `axon-prod`
- Save the **tunnel token** (long base64 string).

## 2. Add CNAME routes

Under the tunnel → **Public Hostnames**, add one entry per subdomain. All route to the same internal service (Caddy):

| Subdomain | Type | URL |
|---|---|---|
| `app` | HTTP | `caddy:80` |
| `api` | HTTP | `caddy:80` |
| `langfuse` | HTTP | `caddy:80` |
| `grafana` | HTTP | `caddy:80` |
| `admin` | HTTP | `caddy:80` |

Cloudflare auto-creates the DNS CNAMEs in your zone.

## 3. Paste the token into the VM's `.env`

```bash
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...   # the token from step 1
```

## 4. Bring up the prod stack

```bash
cd /opt/axon
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

The `cloudflared` container registers the tunnel and starts proxying. Each subdomain is live over HTTPS (TLS terminates at Cloudflare's edge) within ~30 seconds.

## 5. Verify

```bash
curl -sS https://api.yourdomain.xyz/health
# => {"ok":true,"service":"api"}

curl -sS https://app.yourdomain.xyz
# => HTML for the Axon landing page
```

No ports are exposed on the VM's public IP — `ufw status` should show only SSH open inbound.

## Notes

- Tunnel token is credentials. Rotate via Zero Trust dashboard on any compromise.
- Cloudflare provides free unlimited tunnel bandwidth on the Free plan.
- If you want Cloudflare Access (SSO in front of `admin.*`, `grafana.*`), add an Access application in Zero Trust.
