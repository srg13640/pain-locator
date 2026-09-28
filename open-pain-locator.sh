#!/usr/bin/env bash
# One double-click (or one command) starts Pain Locator on this computer only.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
URL="http://127.0.0.1:4721/"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. It is the small program that opens this app on your computer."
  echo "Install it from https://nodejs.org and then double-click this file again."
  exit 1
fi

if [ ! -d node_modules ] || [ ! -f dist/index.html ]; then
  echo "First-time setup is installing the app on this computer. This step uses the internet once."
  npm install
  npm run build
fi

mkdir -p "$HOME/PainLocator" "$HOME/Desktop"
if curl -sf -o /dev/null "$URL"; then
  echo "Pain Locator is already open at $URL"
else
  nohup node server/index.mjs >>"$HOME/PainLocator/server.log" 2>&1 &
  echo $! >"$HOME/PainLocator/server.pid"
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sf -o /dev/null "$URL"; then
      break
    fi
    sleep 0.3
  done
fi

cat > "$ROOT/Pain Locator.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Pain Locator
Comment=Mark pain on a 3D body and save a one-page note for a doctor
Exec=$ROOT/open-pain-locator.sh
Path=$ROOT
Icon=$ROOT/public/favicon.svg
Terminal=false
Categories=Utility;
EOF
chmod +x "$ROOT/Pain Locator.desktop" "$ROOT/open-pain-locator.sh"
cp "$ROOT/Pain Locator.desktop" "$HOME/Desktop/Pain Locator.desktop" 2>/dev/null || true

if [ "$(uname -s)" = "Darwin" ] && command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi

echo "Open $URL in your web browser if it did not open by itself."
echo "Your notes are in $HOME/PainLocator"
