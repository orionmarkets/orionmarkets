#!/usr/bin/env bash
# Installs and starts the mainnet watcher as a systemd user service (survives logouts and reboots).
# Run this yourself:  bash scripts/ops/install-watch-service.sh
# Optional settings go in ~/.config/orion-watch.env, for example:
#   WATCH_WEBHOOK_URL=https://hooks.slack.com/services/...
#   WATCH_MIN_OWNER_ETH=0.0005
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cp "$ROOT/scripts/ops/orion-watch.service" "$UNIT_DIR/orion-watch.service"
systemctl --user daemon-reload
systemctl --user enable --now orion-watch.service
loginctl enable-linger "$USER" || echo "Could not enable linger; the service will stop when you log out."
sleep 5
systemctl --user --no-pager status orion-watch.service | head -8
echo "Logs: journalctl --user -u orion-watch -f"
