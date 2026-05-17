#!/usr/bin/env bash
set -euo pipefail

NAME="com.wuchao.kimi-thinking-proxy"
PLIST_PATH="$HOME/Library/LaunchAgents/${NAME}.plist"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Uninstalled ${NAME}"
