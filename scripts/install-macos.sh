#!/usr/bin/env bash
set -euo pipefail

NAME="com.wuchao.kimi-thinking-proxy"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/${NAME}.plist"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "${NODE_BIN}" ]]; then
  echo "node not found in PATH"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${ROOT_DIR}/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/${NAME}.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/${NAME}.error.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/${NAME}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$(id -u)/${NAME}"

echo "Installed ${NAME}"
echo "Proxy URL: http://127.0.0.1:8787/v1/messages"
echo "Logs:"
echo "  $HOME/Library/Logs/${NAME}.log"
echo "  $HOME/Library/Logs/${NAME}.error.log"
