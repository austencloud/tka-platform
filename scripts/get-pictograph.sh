#!/bin/bash
# Simple script to get pictograph from API endpoint (no auth required)
# Usage: ./scripts/get-pictograph.sh A

if [ -z "$1" ]; then
  echo "Usage: ./scripts/get-pictograph.sh <letter>"
  echo "Example: ./scripts/get-pictograph.sh A"
  exit 1
fi

LETTER=$1
OUTPUT_DIR="static/images/grant-feature"
OUTPUT_FILE="$OUTPUT_DIR/pictograph-$LETTER.png"

mkdir -p "$OUTPUT_DIR"

echo "Rendering pictograph $LETTER..."
curl -s "http://localhost:5173/api/render-pictograph?letter=$LETTER" \
  -o "$OUTPUT_FILE"

if [ $? -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
  # Check if file is actually an image (not an error message)
  FILE_TYPE=$(file -b --mime-type "$OUTPUT_FILE")
  if [ "$FILE_TYPE" = "image/png" ]; then
    echo "✅ Rendered: $OUTPUT_FILE"
    exit 0
  else
    echo "❌ Error: Server returned error"
    cat "$OUTPUT_FILE"
    rm "$OUTPUT_FILE"
    exit 1
  fi
else
  echo "❌ Error: Failed to download"
  exit 1
fi
