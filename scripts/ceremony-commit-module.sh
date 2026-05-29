#!/usr/bin/env bash
# Stage exactly the paths from .ceremony-stage-paths.txt (existing ones) and
# the git-mv-staged renames, then commit one module.
# Usage: bash scripts/ceremony-commit-module.sh <module>
set -e
cd "$(dirname "$0")/.."
MODULE="$1"
if [ -z "$MODULE" ]; then echo "need module"; exit 1; fi

while IFS= read -r p; do
  [ -z "$p" ] && continue
  if [ -e "$p" ]; then git add -- "$p"; fi
done < scripts/.ceremony-stage-paths.txt

echo "=== staged for $MODULE ==="
git diff --cached --name-only

# Safety: refuse if any forbidden path is staged.
FORBIDDEN="card-back-job-builder|gradient-parse|choreo-card/services/deck-variation|AnimatorCanvas.svelte|SplitCanvasView.svelte|SequenceViewerDrawerHost.svelte|ViewerOverflowMenu.svelte|routes/test/deck-variation"
if git diff --cached --name-only | grep -E "$FORBIDDEN" >/dev/null; then
  echo "ABORT: forbidden file staged"
  exit 2
fi

git commit -m "refactor(${MODULE}): flatten dirs + kebab rename

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git log --oneline -1
