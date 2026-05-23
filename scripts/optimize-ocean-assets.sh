#!/usr/bin/env bash
set -euo pipefail

# Ocean Asset Optimization Pipeline
# Run: pnpm optimize:ocean
# Processes all GLB files in static/models/ocean/ through gltf-transform.

OCEAN_DIR="static/models/ocean"
BACKUP_DIR="assets/source-models/ocean"
GLTF="pnpm gltf-transform"

# Ensure backup directory exists (gitignored)
mkdir -p "$BACKUP_DIR"

optimize_file() {
  local src="$1"
  local simplify_ratio="$2"
  local basename
  basename=$(basename "$src")
  local backup="$BACKUP_DIR/$basename"

  # Back up original if not already backed up
  if [ ! -f "$backup" ]; then
    cp "$src" "$backup"
    echo "  Backed up: $basename"
  fi

  local tmp="${src%.glb}.opt.glb"

  echo "  Processing: $basename (simplify ratio: $simplify_ratio)"

  # Pipeline: dedup → flatten → prune → simplify → meshopt → ktx2
  $GLTF dedup "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF flatten "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF prune "$src" "$tmp"
  mv "$tmp" "$src"

  if [ "$simplify_ratio" != "none" ]; then
    $GLTF simplify "$src" "$tmp" --ratio "$simplify_ratio"
    mv "$tmp" "$src"
  fi

  $GLTF meshopt "$src" "$tmp"
  mv "$tmp" "$src"

  # GPU-compressed textures (3-4x VRAM reduction, stays compressed on GPU)
  # Skipped if no embedded textures in the GLB
  $GLTF ktx2 "$src" "$tmp" --codec uastc 2>/dev/null && mv "$tmp" "$src" || true

  local size_kb
  size_kb=$(du -k "$src" | cut -f1)
  echo "  Done: $basename → ${size_kb}KB"
}

echo "=== Ocean Asset Optimization ==="
echo ""

# Hero rocks (aggressive simplify — 500K+ tris → 50K)
echo "[1/5] Hero rocks (simplify 0.1)..."
for f in "$OCEAN_DIR"/rock_*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1"
done

# Reef structures (aggressive simplify)
echo "[2/5] Reef structures (simplify 0.1)..."
for f in "$OCEAN_DIR"/structures/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1"
done

# Fish (moderate simplify)
echo "[3/5] Fish species (simplify 0.5)..."
for f in "$OCEAN_DIR"/pack/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.5"
done

# Small models (no simplify, just dedup/prune/meshopt)
echo "[4/5] Coral, kelp, jellyfish, decorations (meshopt only)..."
for f in "$OCEAN_DIR"/coral_*.glb "$OCEAN_DIR"/seaweed.glb "$OCEAN_DIR"/kelp_plant.glb \
         "$OCEAN_DIR"/jellyfish.glb "$OCEAN_DIR"/jellyfish_small.glb \
         "$OCEAN_DIR"/starfish.glb "$OCEAN_DIR"/sea_urchin.glb \
         "$OCEAN_DIR"/shell.glb "$OCEAN_DIR"/anemone.glb; do
  [ -f "$f" ] && optimize_file "$f" "none"
done

# Large coral (no simplify)
echo "[5/5] Large coral (meshopt only)..."
[ -f "$OCEAN_DIR/coral_large.glb" ] && optimize_file "$OCEAN_DIR/coral_large.glb" "none"

echo ""
echo "=== Optimization complete ==="
echo "Originals backed up to: $BACKUP_DIR/"
echo "Add $BACKUP_DIR to .gitignore if not already present."
