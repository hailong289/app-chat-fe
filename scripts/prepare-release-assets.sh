#!/usr/bin/env bash
# Collect Tauri bundle artifacts into stable filenames for GitHub Releases.
set -euo pipefail

BUNDLES_DIR="${1:-bundles}"
OUT_DIR="${2:-release}"

mkdir -p "$OUT_DIR"

find_installer() {
  local ext="$1"
  find "$BUNDLES_DIR" -type f -name "*.${ext}" 2>/dev/null | sort | head -1
}

MSI=$(find_installer msi)
DMG=$(find_installer dmg)
DEB=$(find_installer deb)

if [[ -n "$MSI" ]]; then
  cp "$MSI" "$OUT_DIR/IChat-Windows.msi"
  echo "✓ Windows: $MSI → IChat-Windows.msi"
else
  echo "::warning::Windows .msi not found under $BUNDLES_DIR"
fi

if [[ -n "$DMG" ]]; then
  cp "$DMG" "$OUT_DIR/IChat-macOS.dmg"
  echo "✓ macOS: $DMG → IChat-macOS.dmg"
else
  echo "::warning::macOS .dmg not found under $BUNDLES_DIR"
fi

if [[ -n "$DEB" ]]; then
  cp "$DEB" "$OUT_DIR/IChat-Linux.deb"
  echo "✓ Linux: $DEB → IChat-Linux.deb"
else
  echo "::warning::Linux .deb not found under $BUNDLES_DIR"
fi

if [[ -z "$(ls -A "$OUT_DIR" 2>/dev/null)" ]]; then
  echo "::error::No release assets found"
  find "$BUNDLES_DIR" -type f 2>/dev/null | head -50 || true
  exit 1
fi

ls -la "$OUT_DIR"
