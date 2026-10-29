#!/usr/bin/env bash
# Deploys whatever the `production` branch points to.
#
# Builds the commit next to the running version, backs up the SQLite
# databases, switches the `current` link, restarts the web service and waits
# for /api/health to report the new version. If it does not, the previous
# version comes back and the commit is remembered as failed, so it is not
# rebuilt until `production` moves again.
#
# Called by poll.sh under flock. A version already built (manual rollback)
# is switched to without rebuilding.
set -euo pipefail

APP="${APP_DIR:-$HOME/apps/system-design}"
REPO_URL="${REPO_URL:-https://github.com/oleksandr-antonenko/system-design.git}"
PORT="${PORT:-3620}"
KEEP_RELEASES=5
KEEP_BACKUPS=10
SERVICE=system-design-web
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$APP"/{releases,data,backups,logs,state} "$UNIT_DIR" "$HOME/bin"
exec > >(tee -a "$APP/logs/deploy.log") 2>&1

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

log() { echo "[$(date -Is)] $*"; }

if [ ! -f "$APP/.env" ]; then
  log "✗ no .env at $APP/.env — deploy stopped, running version unchanged"
  exit 1
fi

SRC="$APP/src.git"
if [ ! -d "$SRC" ]; then
  git init --quiet --bare "$SRC"
fi
git -C "$SRC" fetch --quiet --depth 1 --force "$REPO_URL" \
  "+refs/heads/production:refs/heads/production"
sha="$(git -C "$SRC" rev-parse refs/heads/production)"
short="${sha:0:7}"

existing="$(find "$APP/releases" -mindepth 1 -maxdepth 1 -type d -name "*-$short" -exec test -f '{}/.built' ';' -print | sort | tail -n 1)"
if [ -n "$existing" ]; then
  REL="$existing"
  log "▸ $short already built, switching to $(basename "$REL")"
else
  REL="$APP/releases/$(date +%Y%m%d-%H%M%S)-$short"
  log "▸ building $short in $(basename "$REL")"
  mkdir -p "$REL"
  git -C "$SRC" archive "$sha" | tar -x -C "$REL"
  printf 'APP_VERSION=%s\n' "$short" > "$REL/.release.env"
  (
    cd "$REL"
    pnpm install --frozen-lockfile --reporter=append-only
    pnpm build
  )
  touch "$REL/.built"
fi

for db in "$APP"/data/*.db; do
  [ -e "$db" ] || continue
  name="$(basename "$db" .db)"
  sqlite3 "$db" ".backup '$APP/backups/$name-$(date +%Y%m%d-%H%M%S)-$short.db'"
  log "  backup of $name.db"
done

PREV="$(readlink -f "$APP/current" 2>/dev/null || true)"

install_units() {
  cp "$1/deploy/$SERVICE.service" "$1/deploy/system-design-deploy.service" \
    "$1/deploy/system-design-deploy.timer" "$UNIT_DIR/"
  systemctl --user daemon-reload
}

switch_to() {
  ln -sfn "$1" "$APP/current.new"
  mv -T "$APP/current.new" "$APP/current"
  install_units "$1"
  systemctl --user restart "$SERVICE"
}

serves_version() {
  curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null |
    grep -q "\"version\":\"$1\""
}

switch_to "$REL"

ok=""
for _ in $(seq 1 30); do
  if serves_version "$short"; then ok=1; break; fi
  sleep 2
done

if [ -z "$ok" ]; then
  log "✗ $short did not come up — rolling back"
  tail -n 30 "$APP/logs/web.log" || true
  echo "$sha" >> "$APP/state/failed"
  if [ -n "$PREV" ] && [ -d "$PREV" ] && [ "$PREV" != "$REL" ]; then
    switch_to "$PREV"
    log "  back on $(basename "$PREV")"
  fi
  exit 1
fi

echo "$sha" > "$APP/state/deployed"
cp "$REL/deploy/poll.sh" "$REL/deploy/release.sh" "$HOME/bin/"
chmod +x "$HOME/bin/poll.sh" "$HOME/bin/release.sh"
log "✓ live: $short ($(basename "$REL"))"

current="$(readlink -f "$APP/current")"
find "$APP/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
  sort -rn | tail -n +$((KEEP_RELEASES + 1)) | cut -d' ' -f2- |
  while read -r old; do
    [ "$old" = "$current" ] || rm -rf "$old"
  done
find "$APP/backups" -maxdepth 1 -type f -name '*.db' -printf '%T@ %p\n' |
  sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- |
  xargs -r rm -f
