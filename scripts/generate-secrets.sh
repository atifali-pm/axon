#!/usr/bin/env bash
# Fill empty secret values in .env in place.
# Run after `cp .env.example .env`. Safe to re-run; skips keys that already have values.
# Usage: ./scripts/generate-secrets.sh [path-to-env-file]
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found. copy .env.example first: cp .env.example .env" >&2
  exit 1
fi

SECRET_KEYS=(
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  BETTER_AUTH_SECRET
  LANGFUSE_SECRET
  LANGFUSE_SALT
  MINIO_PASSWORD
  N8N_ENCRYPTION_KEY
  AGENT_API_KEY
  GRAFANA_PASSWORD
)

gen_hex() { openssl rand -hex 32; }
gen_alnum() { openssl rand -base64 24 | tr -d '/+=' | head -c 24; }

for key in "${SECRET_KEYS[@]}"; do
  current=$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)
  if [ -n "$current" ]; then
    echo "skip  ${key} (already set)"
    continue
  fi

  case "$key" in
    GRAFANA_PASSWORD) value=$(gen_alnum) ;;
    *) value=$(gen_hex) ;;
  esac

  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    echo "set   ${key}"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    echo "add   ${key}"
  fi
done
