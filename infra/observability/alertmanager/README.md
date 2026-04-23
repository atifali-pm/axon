# Alertmanager + ntfy

Routes Prometheus alerts to your phone via ntfy.sh for free.

## Setup

1. Pick a hard-to-guess topic (ntfy public topics are world-readable):
   ```
   NTFY_URL=https://ntfy.sh/axon-alerts-<your-random-string>
   ```
   Add it to `.env` at the repo root.

2. On your phone, install [ntfy](https://ntfy.sh/) (iOS / Android / web).

3. Subscribe to the same topic. Any alert Prometheus fires now lands as a push notification within seconds.

## What triggers

See `infra/observability/prometheus/alerts.yml` for the full list. Currently:

- `ApiDown` — `up{job="axon-api"} == 0` for 2m (critical)
- `ApiHighErrorRate` — 5xx rate > 5% for 5m (warning)
- `ApiHighLatencyP95` — p95 > 1s for 5m (warning)
- `PostgresDown` / `RedisDown` — exporter scrape fails for 2m (critical)
- `HighMemoryUsage` — node memory > 90% for 10m (warning)

`ApiDown` is inhibitor for the other Api.* alerts (avoids duplicate pages when the whole service is down).

## Testing the pipeline

With the observability stack running:

```bash
# Stop the API to trigger ApiDown
lsof -ti:4000 | xargs -r kill -9

# Wait 2 minutes, then check alertmanager status
curl -sS http://localhost:9093/api/v2/alerts | jq '.[].labels.alertname'
# Expect: "ApiDown"

# Your phone should get a notification within a minute.
```

Restart the API to resolve the alert. `send_resolved: true` is set, so you'll get a second ntfy push when it clears.

## Upgrading to Slack / PagerDuty

`alertmanager.yml` has a single `default` receiver today. Add new receivers and route tree matchers when you need severity splits. Example:

```yaml
route:
  receiver: default
  routes:
    - match:
        severity: critical
      receiver: pagerduty
    - match:
        severity: warning
      receiver: ntfy

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key: ${PAGERDUTY_KEY}
  - name: ntfy
    webhook_configs:
      - url: ${NTFY_URL}
```

## ntfy-specific headers

Alertmanager's generic webhook doesn't let us set ntfy's `Title`, `Priority`, or `Tags` headers, so the notification body is just the raw Alertmanager JSON. If you want nicer formatting, put a tiny HTTP proxy (Caddy template, cloudflare worker, or a Python webhook) between Alertmanager and ntfy that rewrites the payload.
