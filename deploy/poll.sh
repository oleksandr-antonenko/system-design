#!/usr/bin/env bash
# Runs every 30 s from system-design-deploy.timer as the app user.
# Asks GitHub where the `production` branch points and starts a release
# when it moved. Uses `git ls-remote`: no token, no REST rate limit.
set -euo pipefail

APP="${APP_DIR:-$HOME/apps/system-design}"
REPO_URL="${REPO_URL:-https://github.com/oleksandr-antonenko/system-design.git}"
STATE="$APP/state"

mkdir -p "$STATE"
target="$(git ls-remote "$REPO_URL" refs/heads/production | cut -f1)"

if [ -z "$target" ]; then
  echo "production branch not found at $REPO_URL"
  exit 0
fi
if [ "$target" = "$(cat "$STATE/deployed" 2>/dev/null || true)" ]; then
  exit 0
fi
if grep -qx "$target" "$STATE/failed" 2>/dev/null; then
  exit 0
fi

exec flock --nonblock "$STATE/deploy.lock" "$HOME/bin/release.sh"
