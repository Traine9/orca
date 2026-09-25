#!/usr/bin/env bash
# Reinstall a locally built Orca fork .deb and relaunch the GUI.
#
# Usage: scripts/reinstall-orca-fork.sh [--restart-daemon] [path/to/orca-ide_<ver>_amd64.deb]
#   default .deb: the newest dist/orca-ide_*_amd64.deb next to this script's repo.
#
# The PTY daemon (daemon-entry.js on ~/.config/orca/daemon/daemon-v<N>.sock) is detached
# from the GUI and survives an app relaunch, so it keeps running the OLD version's code
# (its version is "appVersion" in daemon-v<N>.pid, and ORCA_APP_VERSION in a pane's env).
# Only fixes in src/main/daemon need --restart-daemon.
# WARNING: --restart-daemon kills every running terminal (shells, agents) in every workspace.
set -euo pipefail

restart_daemon=0
if [[ "${1:-}" == "--restart-daemon" ]]; then restart_daemon=1; shift; fi
repo="$(cd "$(dirname "$0")/.." && pwd)"
deb="${1:-$(ls -t "$repo"/dist/orca-ide_*_amd64.deb 2>/dev/null | head -1)}"
[[ -f "$deb" ]] || { echo "no .deb found (pass a path)" >&2; exit 1; }
echo "installing: $deb"

# GUI main process = /opt/Orca/orca-ide without --type= (Chromium helpers) or an
# app.asar.unpacked entry script (PTY daemon, watcher/scanner child processes).
gui_pids() {
  local pid cmd
  for pid in $(pgrep -f '^/opt/Orca/orca-ide' || true); do
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    if [[ -n "$cmd" && "$cmd" != *--type=* && "$cmd" != *app.asar.unpacked* ]]; then echo "$pid"; fi
  done
}
daemon_pids() { pgrep -f 'daemon-entry\.js --socket .*/daemon-v[0-9]+\.sock' || true; }

wait_gone() { # wait_gone <label> <pid>...
  local label="$1"; shift
  local pid alive
  for _ in $(seq 60); do
    alive=0
    for pid in "$@"; do kill -0 "$pid" 2>/dev/null && alive=1; done
    (( alive )) || return 0
    sleep 0.5
  done
  echo "$label did not exit within 30s (a quit-confirmation dialog?); aborting" >&2
  exit 1
}

pids="$(gui_pids)"
if [[ -n "$pids" ]]; then
  echo "quitting Orca GUI (pid $pids)"
  # SIGTERM runs Electron's normal quit path (before-quit/will-quit), like Ctrl+Q.
  kill -TERM $pids
  wait_gone "Orca GUI" $pids
fi

if (( restart_daemon )); then
  dpids="$(daemon_pids)"
  if [[ -n "$dpids" ]]; then
    echo "stopping PTY daemon (pid $dpids) - this ends all running terminals"
    kill -TERM $dpids
    wait_gone "PTY daemon" $dpids
  fi
fi

sudo dpkg -i "$deb"

setsid nohup /opt/Orca/orca-ide >/dev/null 2>&1 < /dev/null &
echo "relaunched Orca; installed: $(dpkg -s orca-ide | sed -n 's/^Version: //p')"
if (( ! restart_daemon )); then
  grep -ho '"appVersion":"[^"]*"' ~/.config/orca/daemon/daemon-v*.pid 2>/dev/null \
    | sed 's/^/PTY daemon still runs: /' || true
fi
