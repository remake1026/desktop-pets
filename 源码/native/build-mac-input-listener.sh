#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source_file="$script_dir/MacInputListener.swift"
output_file="$script_dir/MacInputListener"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

# Build one helper for Intel and Apple Silicon, then merge them into a
# Universal binary that electron-builder includes inside the app bundle.
xcrun swiftc -O -target arm64-apple-macos12.0 -framework AppKit "$source_file" \
  -o "$temp_dir/MacInputListener-arm64"
xcrun swiftc -O -target x86_64-apple-macos12.0 -framework AppKit "$source_file" \
  -o "$temp_dir/MacInputListener-x64"
lipo -create "$temp_dir/MacInputListener-arm64" "$temp_dir/MacInputListener-x64" \
  -output "$output_file"
chmod +x "$output_file"
