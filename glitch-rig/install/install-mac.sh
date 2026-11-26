#!/bin/bash
# Installs Glitch Rig as an unsigned CEP extension for the current user (macOS).
# Run:  bash install/install-mac.sh     then restart After Effects / Premiere Pro.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.glitchrig"

# Unsigned panels load only with PlayerDebugMode on (CSXS 10, 11, 12).
for v in 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/CSXS" "$SRC/css" "$SRC/js" "$SRC/jsx" "$SRC/index.html" "$SRC/.debug" "$DEST/"
echo "Installed to: $DEST"
echo "Restart After Effects / Premiere Pro, then open Window > Extensions > Glitch Rig."
