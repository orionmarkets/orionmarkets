#!/usr/bin/env bash
# Replace a manually started publisher with the systemd user service, and keep it running across logouts and reboots.
# Run this yourself:  bash scripts/ops/install-publisher-service.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cp "$ROOT/scripts/ops/orion-publisher.service" "$UNIT_DIR/orion-publisher.service"

# Stop a manual loop first; SIGTERM makes the publisher pause the markets cleanly (the service re-activates them).
pkill -f "scripts/run-publisher-loop.sh" || true
if pgrep -f "scripts/run-rh-publisher.mjs --serve" >/dev/null; then
  pkill -TERM -f "scripts/run-rh-publisher.mjs --serve" || true
  for _ in $(seq 1 40); do pgrep -f "scripts/run-rh-publisher.mjs --serve" >/dev/null || break; sleep 3; done
fi

systemctl --user daemon-reload
systemctl --user enable --now orion-publisher.service
loginctl enable-linger "$USER" || echo "Could not enable linger; the service will stop when you log out."
systemctl --user --no-pager status orion-publisher.service | head -8
echo "Logs: journalctl --user -u orion-publisher -f"
