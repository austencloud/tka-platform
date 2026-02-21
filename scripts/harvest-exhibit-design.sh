#!/bin/bash
# Harvest all exhibit-design tagged items

items=()

# Extract all IDs from museum list output
node scripts/museum-dev.js list 2>/dev/null | grep "^     " | awk '{print $1}' | sed 's/\.\.\.//g' | while read id; do
  [ -z "$id" ] && continue
  
  # Query this item
  result=$(node scripts/museum-dev.js $id 2>/dev/null)
  
  # Check if it has exhibit-design tag
  if echo "$result" | grep -q "exhibit-design"; then
    echo "$result" | head -20
    echo "---"
  fi
done
