#!/usr/bin/env bash
# Reports remaining container.items references and ITI imports
echo "=== DI Migration Progress ==="
echo ""
echo "container.items references remaining:"
grep -r "container\.items\." src/ --include="*.ts" --include="*.svelte" -l 2>/dev/null | wc -l
echo ""
echo "ITI imports remaining:"
grep -r "from \"iti\"" src/ --include="*.ts" -l 2>/dev/null | wc -l
echo ""
echo "Container files remaining:"
ls src/lib/shared/di/containers/*.ts 2>/dev/null | wc -l
echo ""
echo "Top 10 most-referenced services:"
grep -roh "container\.items\.\w\+" src/ --include="*.ts" --include="*.svelte" 2>/dev/null | sort | uniq -c | sort -rn | head -10
