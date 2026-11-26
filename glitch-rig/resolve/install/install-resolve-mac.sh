#!/bin/bash
# Installs the Glitch Rig fuses and Edit-page templates for DaVinci Resolve (macOS,
# current user). Run:  bash glitch-rig/resolve/install/install-resolve-mac.sh
# then restart Resolve.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion"

mkdir -p "$DEST/Fuses" "$DEST/Templates/Edit/Effects" "$DEST/Templates/Edit/Transitions" "$DEST/Templates/Edit/Titles"
rm -rf "$DEST/Fuses/GlitchRig" \
       "$DEST/Templates/Edit/Effects/Glitch Rig" \
       "$DEST/Templates/Edit/Transitions/Glitch Rig" \
       "$DEST/Templates/Edit/Titles/Glitch Rig"
cp -R "$SRC/Fuses/GlitchRig" "$DEST/Fuses/"
cp -R "$SRC/Templates/Edit/Effects/Glitch Rig" "$DEST/Templates/Edit/Effects/"
cp -R "$SRC/Templates/Edit/Transitions/Glitch Rig" "$DEST/Templates/Edit/Transitions/"
cp -R "$SRC/Templates/Edit/Titles/Glitch Rig" "$DEST/Templates/Edit/Titles/"
echo "Installed to: $DEST"
echo "Restart DaVinci Resolve, then look for \"Glitch Rig\" in the Effects library."
