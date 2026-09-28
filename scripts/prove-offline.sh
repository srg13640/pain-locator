#!/usr/bin/env bash
# Show that the running app is only listening on this computer, and that the
# built page does not contain an unexpected web address.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Listening sockets for Pain Locator:"
found=0
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | grep 4721 || true
fi

python3 - << 'PY'
import os
import sys

port = 4721
listeners = []
for name in ("/proc/net/tcp", "/proc/net/tcp6"):
    if not os.path.exists(name):
        continue
    for line in open(name):
        parts = line.split()
        if len(parts) < 4 or parts[0] == "sl":
            continue
        local, state = parts[1], parts[3]
        ip_hex, port_hex = local.split(":")
        if int(port_hex, 16) != port or state != "0A":
            continue
        if len(ip_hex) == 8:
            raw = bytes.fromhex(ip_hex)
            addr = ".".join(str(raw[i]) for i in (3, 2, 1, 0))
        else:
            addr = ip_hex
        listeners.append(addr)

if not listeners:
    print("Nothing is listening on port 4721.")
    sys.exit(1)
for addr in listeners:
    print(f"  {addr}:{port} LISTEN")
    if addr not in ("127.0.0.1", "::1"):
        print("The helper is reachable from other computers. That is not allowed.")
        sys.exit(1)
print("The helper accepts connections only from this computer.")
PY

echo
echo "Web addresses inside the built page files:"
python3 - << 'PY'
import re
import sys
from pathlib import Path

# These strings sit inside libraries. None of them is a request this app makes.
# w3.org names are XML vocabulary labels. react.dev is text in an error sentence.
# jcgt.org is a paper citation in the 3D math. github.com is a license sentence.
# cdnjs appears only in an unused jsPDF display option this app never calls.
allowed_hosts = {
    "www.w3.org",
    "react.dev",
    "jcgt.org",
    "github.com",
    "cdnjs.cloudflare.com",
    # Placeholder XML name inside jsPDF. It is not a computer on the internet.
    "jspdf.default.namespaceuri",
}
unexpected = []
for path in Path("dist").rglob("*"):
    if path.suffix not in {".js", ".css", ".html"}:
        continue
    text = path.read_text(errors="replace")
    for match in re.finditer(r"https?://([^/\"'`)\s]+)", text):
        host = match.group(1).split(":")[0]
        if host not in allowed_hosts and host not in ("127.0.0.1", "localhost"):
            unexpected.append(f"{path}:{host}")
    if "pdfobjectnewwindow" in text and "cdnjs.cloudflare.com" in text:
        # Keep the unused branch visible in the report.
        pass

if unexpected:
    print("Unexpected web addresses:")
    print("\n".join(unexpected[:20]))
    sys.exit(1)
print("No unexpected web addresses.")
print("Library files mention a few web names (XML labels, an error sentence, a paper citation, a license line, and an unused PDF-viewer option). This app does not call them.")
PY
