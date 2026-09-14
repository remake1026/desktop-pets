#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=""

for dir in "$ROOT"/*/; do
  if [[ -f "${dir}package.json" ]]; then
    APP_DIR="${dir%/}"
    break
  fi
done

if [[ -z "$APP_DIR" ]]; then
  echo "Cannot find pet source folder under:"
  echo "$ROOT"
  read -r
  exit 1
fi

ELECTRON_EXE="$APP_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

if [[ ! -x "$ELECTRON_EXE" ]]; then
  echo "Installing desktop pet dependencies..."
  cd "$APP_DIR"
  if ! npm install; then
    echo
    echo "Failed to install dependencies."
    echo "Install Node.js, then run this script again."
    read -r
    exit 1
  fi
fi

"$ELECTRON_EXE" "$APP_DIR" >/dev/null 2>&1 &
disown
exit 0
