#!/usr/bin/env bash
# Reinstall a locally built Orca fork .deb and relaunch the GUI; safe to run from an Orca terminal.
#
# Usage: scripts/reinstall-orca-fork.sh [--restart-daemon] [path/to/orca-ide_<ver>_amd64.deb]
#        scripts/reinstall-orca-fork.sh --quit
#   default .deb: the newest dist/orca-ide_*_amd64.deb next to this script's repo.
#   --quit: only quit the Orca GUI (no install, no relaunch). Terminals keep running: the PTY
#   daemon stays up while it has sessions (daemon-server.ts isIdle), and the next GUI start
#   re-attaches them. Without --quit the GUI is quit the same way before the install.
#
# The PTY daemon (daemon-entry.js on ~/.config/orca/daemon/daemon-v<N>.sock) is detached
# from the GUI and survives an app relaunch, so it keeps running the OLD version's code
# (its version is "appVersion" in daemon-v<N>.pid, and ORCA_APP_VERSION in a pane's env).
# Only fixes in src/main/daemon need --restart-daemon.
# WARNING: --restart-daemon kills every running terminal (shells, agents) in every workspace,
# including the one this script runs in; the relaunch then happens from a detached scope.
#
# Run from an Orca terminal, the pane lives in the daemon's systemd scope, which Orca stops
# when the daemon dies; so the GUI is relaunched into its own app-orca-* scope with the pane's
# ORCA_* variables stripped, and sudo asks for the password before the window closes.
set -euo pipefail

log="${XDG_CACHE_HOME:-$HOME/.cache}/orca-reinstall.log"
self="$(readlink -f "$0")"

gui_pids() { # GUI main process: /opt/Orca/orca-ide without --type= or an app.asar.unpacked script
  local pid cmd
  for pid in $(pgrep -f '^/opt/Orca/orca-ide' || true); do
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    if [[ -n "$cmd" && "$cmd" != *--type=* && "$cmd" != *app.asar.unpacked* ]]; then echo "$pid"; fi
  done
}
daemon_pids() { pgrep -f 'daemon-entry\.js --socket .*/daemon-v[0-9]+\.sock' || true; }

wait_gone() { # wait_gone <label> <pid>...; returns 1 after 30 s
  local label="$1"; shift
  local pid alive
  for _ in $(seq 60); do
    alive=0
    for pid in "$@"; do kill -0 "$pid" 2>/dev/null && alive=1; done
    (( alive )) || return 0
    sleep 0.5
  done
  echo "$label did not exit within 30s" >&2
  return 1
}

launch() {
  local strip=() v
  for v in $(compgen -e | grep '^ORCA_' || true); do strip+=(-u "$v"); done
  cd "$HOME"
  if command -v systemd-run >/dev/null && systemd-run --user --scope --collect --quiet \
      --unit "app-orca-probe-$$" -- true 2>/dev/null; then
    setsid nohup env "${strip[@]}" systemd-run --user --scope --collect --quiet \
      --unit "app-orca-$(date +%s%N)" -- /opt/Orca/orca-ide >/dev/null 2>&1 < /dev/null &
  else
    setsid nohup env "${strip[@]}" /opt/Orca/orca-ide >/dev/null 2>&1 < /dev/null &
  fi
  echo "relaunched Orca; installed: $(dpkg -s orca-ide | sed -n 's/^Version: //p')"
}

stop_daemon() {
  local dpids
  dpids="$(daemon_pids)"
  [[ -n "$dpids" ]] || return 0
  echo "stopping PTY daemon (pid $dpids) - this ends all running terminals"
  kill -TERM $dpids
  wait_gone "PTY daemon" $dpids || kill -KILL $dpids 2>/dev/null || true
}

# Internal: the detached second half of --restart-daemon when started from an Orca pane.
if [[ "${1:-}" == "--finish-restart" ]]; then
  stop_daemon
  launch
  exit 0
fi

# --quit: close the window, keep the terminals (the daemon and its panes are untouched).
if [[ "${1:-}" == "--quit" ]]; then
  pids="$(gui_pids)"
  [[ -n "$pids" ]] || { echo "Orca GUI is not running"; exit 0; }
  echo "quitting Orca GUI (pid $pids); terminals keep running in the PTY daemon"
  kill -TERM $pids
  wait_gone "Orca GUI" $pids || { echo "a quit-confirmation dialog? still running" >&2; exit 1; }
  dpids="$(daemon_pids)"
  [[ -n "$dpids" ]] && echo "PTY daemon still runs (pid $dpids); start /opt/Orca/orca-ide to re-attach" \
    || echo "no PTY daemon found: no terminals were running"
  exit 0
fi

restart_daemon=0
if [[ "${1:-}" == "--restart-daemon" ]]; then restart_daemon=1; shift; fi
repo="$(cd "$(dirname "$0")/.." && pwd)"
deb="${1:-$(ls -t "$repo"/dist/orca-ide_*_amd64.deb 2>/dev/null | head -1)}"
[[ -f "$deb" ]] || { echo "no .deb found (pass a path)" >&2; exit 1; }
echo "installing: $deb"

# Ask now: once the window is gone, an Orca pane can't show a password prompt.
sudo -v

pids="$(gui_pids)"
if [[ -n "$pids" ]]; then
  echo "quitting Orca GUI (pid $pids)"
  kill -TERM $pids # Electron's normal quit path, like Ctrl+Q
  wait_gone "Orca GUI" $pids || { echo "a quit-confirmation dialog? aborting" >&2; exit 1; }
fi

relaunched=0
trap '(( relaunched )) || { echo "install failed; relaunching the old Orca" >&2; launch; }' EXIT

sudo -n dpkg -i "$deb"

if (( restart_daemon )) && [[ -n "${ORCA_PANE_KEY:-}${ORCA_TERMINAL_HANDLE:-}" ]]; then
  echo "this terminal closes with the daemon; progress goes to $log"
  setsid nohup systemd-run --user --scope --collect --quiet --unit "orca-reinstall-$(date +%s)" \
    -- "$self" --finish-restart >>"$log" 2>&1 < /dev/null &
  relaunched=1
  exit 0
fi

(( restart_daemon )) && stop_daemon
launch
relaunched=1
if (( ! restart_daemon )); then
  grep -ho '"appVersion":"[^"]*"' ~/.config/orca/daemon/daemon-v*.pid 2>/dev/null \
    | sed 's/^/PTY daemon still runs: /' || true
fi
