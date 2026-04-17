#!/usr/bin/env bash
# Generate secrets for .env
# Usage: ./scripts/generate-secrets.sh > .env.secrets
set -euo pipefail

cat <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 32)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
LANGFUSE_SECRET=$(openssl rand -hex 32)
LANGFUSE_SALT=$(openssl rand -hex 32)
MINIO_PASSWORD=$(openssl rand -hex 32)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
AGENT_API_KEY=$(openssl rand -hex 32)
GRAFANA_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
EOF
