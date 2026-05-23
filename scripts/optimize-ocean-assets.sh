#!/usr/bin/env bash
set -euo pipefail

# Ocean Asset Optimization Pipeline
# Run: pnpm optimize:ocean
# Processes all GLB files in static/models/ocean/ through gltf-transform.
#
# Key insight: these models are texture-heavy (4x 2048x2048 PNG per rock = 20MB).
# Resizing textures to appropriate resolution + meshopt compression gives 90%+ reduction.

OCEAN_DIR="static/models/ocean"
BACKUP_DIR="assets/source-models/ocean"
GLTF="pnpm gltf-transform"

mkdir -p "$BACKUP_DIR"

optimize_file() {
  local src="$1"
  local simplify_ratio="$2"
  local tex_size="$3"
  local basename
  basename=$(basename "$src")
  local backup="$BACKUP_DIR/$basename"

  if [ ! -f "$backup" ]; then
    cp "$src" "$backup"
    echo "  Backed up: $basename"
  fi

  local tmp="${src%.glb}.opt.glb"

  echo "  Processing: $basename (simplify: $simplify_ratio, tex: ${tex_size}px)"

  # Pipeline: dedup → flatten → prune → resize textures → simplify → meshopt
  $GLTF dedup "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF flatten "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF prune "$src" "$tmp"
  mv "$tmp" "$src"

  if [ "$tex_size" != "none" ]; then
    $GLTF resize "$src" "$tmp" --width "$tex_size" --height "$tex_size"
    mv "$tmp" "$src"
  fi

  if [ "$simplify_ratio" != "none" ]; then
    $GLTF simplify "$src" "$tmp" --ratio "$simplify_ratio"
    mv "$tmp" "$src"
  fi

  $GLTF meshopt "$src" "$tmp"
  mv "$tmp" "$src"

  # KTX2/UASTC compression (requires KTX-Software installed)
  if command -v ktx &>/dev/null; then
    $GLTF uastc "$src" "$tmp" 2>/dev/null && mv "$tmp" "$src" || true
  fi

  local size_kb
  size_kb=$(du -k "$src" | cut -f1)
  echo "  Done: $basename → ${size_kb}KB"
}

echo "=== Ocean Asset Optimization ==="
echo ""

# Hero rocks — texture-heavy (4x 2048 PNG each, ~20MB)
# 512px is plenty since these are instanced 40x and never viewed up close
echo "[1/5] Hero rocks (tex 512, simplify 0.1)..."
for f in "$OCEAN_DIR"/rock_*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1" "512"
done

# Reef structures — also texture-heavy (~22MB each)
echo "[2/5] Reef structures (tex 512, simplify 0.1)..."
for f in "$OCEAN_DIR"/structures/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1" "512"
done

# Fish — moderate geometry, small textures
echo "[3/5] Fish species (tex 256, simplify 0.5)..."
for f in "$OCEAN_DIR"/pack/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.5" "256"
done

# Small models — already small, just compress
# NOTE: kelp_plant.glb excluded — its skeleton holds scale transforms that
# flatten/prune destroy, producing a 2-unit model instead of 143-unit.
echo "[4/5] Coral, jellyfish, decorations (meshopt only)..."
for f in "$OCEAN_DIR"/coral_*.glb "$OCEAN_DIR"/seaweed.glb \
         "$OCEAN_DIR"/jellyfish.glb "$OCEAN_DIR"/jellyfish_small.glb \
         "$OCEAN_DIR"/starfish.glb "$OCEAN_DIR"/sea_urchin.glb \
         "$OCEAN_DIR"/shell.glb "$OCEAN_DIR"/anemone.glb; do
  [ -f "$f" ] && optimize_file "$f" "none" "none"
done

echo "[5/5] Large coral (meshopt only)..."
[ -f "$OCEAN_DIR/coral_large.glb" ] && optimize_file "$OCEAN_DIR/coral_large.glb" "none" "none"

echo ""
echo "=== Optimization complete ==="
echo "Originals backed up to: $BACKUP_DIR/"
