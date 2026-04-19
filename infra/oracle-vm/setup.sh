#!/usr/bin/env bash
# Axon production VM bootstrap (Oracle Cloud Always Free ARM).
#
# Idempotent. Safe to re-run. Requires sudo. Takes ~5 minutes on a fresh VM.
#
#   curl -LsSf https://raw.githubusercontent.com/<USER>/axon/main/infra/oracle-vm/setup.sh | bash
#   # or copy to VM and run: sudo ./setup.sh
set -euo pipefail

log() { printf "\e[34m[setup]\e[0m %s\n" "$*"; }

# ---- 1. OS packages ----
log "updating apt + installing base tools"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y \
  curl git ufw fail2ban htop vim unzip jq ca-certificates gnupg \
  python3.12 python3.12-venv python3.12-dev

# ---- 2. Docker ----
if ! command -v docker >/dev/null 2>&1; then
  log "installing docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

# ---- 3. Firewall (only SSH public; everything else via Cloudflare Tunnel) ----
log "configuring ufw"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw --force enable

# ---- 4. fail2ban on ssh ----
log "enabling fail2ban"
sudo systemctl enable --now fail2ban || true

# ---- 5. Cloudflared (fallback; normally runs as a compose service) ----
if ! command -v cloudflared >/dev/null 2>&1; then
  log "installing cloudflared binary"
  ARCH=$(dpkg --print-architecture)
  curl -L --output /tmp/cloudflared.deb \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
  sudo dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

# ---- 6. Swap (ARM VMs with 24 GB RAM benefit) ----
if [ ! -f /swapfile ]; then
  log "provisioning 4 GB swap"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# ---- 7. Keep-alive cron (prevents Oracle reclaim of idle Always-Free VMs) ----
CRON="*/30 * * * * curl -s https://www.cloudflare.com > /dev/null"
(crontab -l 2>/dev/null | grep -v 'cloudflare.com' ; echo "$CRON") | crontab -

# ---- 8. Layout ----
sudo mkdir -p /opt/axon /opt/axon/backups
sudo chown "$USER:$USER" /opt/axon /opt/axon/backups

# ---- 9. rclone for R2 backups ----
if ! command -v rclone >/dev/null 2>&1; then
  log "installing rclone"
  curl -fsSL https://rclone.org/install.sh | sudo bash
fi

# ---- 10. Backup cron ----
log "installing backup cron (daily 03:15 UTC)"
(crontab -l 2>/dev/null | grep -v 'backup-db.sh' ; echo "15 3 * * * /opt/axon/scripts/backup-db.sh >> /var/log/axon-backup.log 2>&1") | crontab -

log "setup complete. log out + back in for docker group, then:"
echo "  cd /opt/axon"
echo "  cp .env.example .env && edit .env (DOMAIN, POSTGRES_PASSWORD, CLOUDFLARE_TUNNEL_TOKEN, STRIPE_*, GROQ_API_KEY, ...)"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
