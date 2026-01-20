# Tika Validation Layer

## Problem
Testing revealed Haiku ignores system prompt rules - dumps technical data like "alpha3", "8 variations", raw JSON structures. Tweaking prompts is fragile.

## Solution: Four-Tier Architecture

**The core insight: The LLM can't dump what it doesn't receive.**

### Tier 1: Tool Output Filtering (Source Fix) ⭐
- **File:** `output-filter.ts`
- **What:** Strip `contextData` and internal fields from tool results BEFORE LLM sees them
- **Impact:** Eliminates JSON dumping at the source - most effective defense

### Tier 2: Zod Schemas (Future)
- Add `outputSchema` to tool definitions for compile-time structure enforcement

### Tier 3: Response Validators (Detection)
- **Files:** `validators.ts`, `TikaResponseValidator.ts`
- **What:** 7 regex-based validators that run after response completes
- **Catches:** Position numbers (alpha3), degrees (90°), raw JSON, variation counts, Type 1 misconceptions
- **Action:** Log violations to Firestore for analysis, don't regenerate

### Tier 4: Client Sanitization (Future Fallback)
- Strip obvious JSON patterns before display

## Verification
```bash
node --import tsx scripts/tika-validator.ts --limit 20
```

**Baseline (2026-01-18):** 100% pass rate on "No JSON dump" check across 42 beginner scenarios.

## Key Files Modified
- `src/routes/api/tika/ask/+server.ts` - All 16 tool execute functions now use output filters
