#!/usr/bin/env bash
# Nightly Postgres backup for Axon production. Dumps the primary database
# (axon), gzips it, and uploads to Cloudflare R2 via rclone. Retains the
# last 30 days in the R2 bucket. Cron entry: `15 3 * * *` (see
# infra/oracle-vm/setup.sh).
#
# Required env:
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (defaults: postgres, set, axon)
#   RCLONE_REMOTE  (e.g. "r2") — configured in /root/.config/rclone/rclone.conf
#   R2_BUCKET      (e.g. "axon-backups")
#
# Optional env:
#   BACKUP_DIR      default /opt/axon/backups
#   RETENTION_DAYS  default 30
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-axon}"
BACKUP_DIR="${BACKUP_DIR:-/opt/axon/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-axon-backups}"

TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
OUT="${BACKUP_DIR}/axon-${POSTGRES_DB}-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping ${POSTGRES_DB} -> ${OUT}"
# pg_dump runs against the compose postgres container.
docker compose -f /opt/axon/infra/docker/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" \
  | gzip -9 > "${OUT}"

SIZE=$(du -h "${OUT}" | awk '{print $1}')
echo "[backup] local dump size: ${SIZE}"

echo "[backup] uploading to ${RCLONE_REMOTE}:${R2_BUCKET}/"
rclone copy "${OUT}" "${RCLONE_REMOTE}:${R2_BUCKET}/" --s3-no-check-bucket

echo "[backup] pruning local dumps older than 7 days"
find "${BACKUP_DIR}" -name 'axon-*.sql.gz' -mtime +7 -delete

echo "[backup] pruning R2 dumps older than ${RETENTION_DAYS} days"
rclone delete --min-age "${RETENTION_DAYS}d" "${RCLONE_REMOTE}:${R2_BUCKET}/"

echo "[backup] done"
