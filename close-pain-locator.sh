#!/usr/bin/env bash
# Stops the private page. Your saved notes are not deleted.
set -euo pipefail
PID_FILE="$HOME/PainLocator/server.pid"
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Pain Locator is closed. Your notes are still in $HOME/PainLocator"
else
  echo "Pain Locator was not running. Your notes, if any, are in $HOME/PainLocator"
fi
