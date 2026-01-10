# Skew System Audit Findings

**Date:** January 9, 2026
**Feedback ID:** FhvO9BTDmKuj7pgNBD7P

---

## Executive Summary

The skewed mode infrastructure is ~70% complete. Core position definitions and coordinate systems work correctly, but there are significant gaps in data coverage and arrow rendering integration.

---

## Part 1: Skewed Dataframe Audit

### What's Correct ✅

| Check | Status | Details |
|-------|--------|---------|
| No duplicates | ✅ | 0 duplicate rows in 2,304 total |
| End position logic | ✅ | Mixed locations (C+I) → ZETA/ETA correctly |
| SkewDir values | ✅ | All 3,328 crossing motions have +/- values |
| Motion type balance | ✅ | Pro/anti/static/dash distributed correctly |

### Critical Issues ❌

#### Issue 1: Only 8 of 32 ZETA/ETA Positions Reachable

**Used positions:** zeta1, zeta7, zeta9, zeta15, eta1, eta7, eta9, eta15
**Missing positions:** zeta2-6, zeta8, zeta10-14, zeta16, eta2-6, eta8, eta10-14, eta16

**Root cause:** The CSV generator only creates variants where BLUE skews. RED end locations are limited to N and W only (never E or S).

```
Red end location distribution in skewed-ending rows:
  n: 640 rows
  w: 640 rows
  e: 0 rows  ← MISSING
  s: 0 rows  ← MISSING
```

**Impact:** 24 of 32 skewed positions are unreachable from any starting position.

#### Issue 2: No Transitions FROM Skewed Positions

```
Start position analysis:
  ALPHA starts: 576 rows
  ZETA starts: 0 rows
  ETA starts: 0 rows
```

**Impact:** Cannot chain multiple skewed beats. After one skewed beat, generation is stuck.

**Required additions:**
- ZETA → ZETA transitions
- ZETA → ALPHA/BETA/GAMMA transitions
- ETA → ETA transitions
- ETA → ALPHA/BETA/GAMMA transitions

---

## Part 2: Arrow Placement Analysis

### Current State

The `ArrowLocator.calculateShiftLocation()` handles:
- Cardinal → Cardinal: `n,e` → `ne` ✅
- Intercardinal → Intercardinal: `ne,nw` → `n` ✅
- Cardinal ↔ Intercardinal: **Returns empty string** ❌

### Proposed Solution

Add 32 new mappings using "first intermediate point" strategy:

```javascript
// Cardinal → Intercardinal (16 mappings)
"n,ne": "ne", "n,se": "ne", "n,sw": "nw", "n,nw": "nw",
"e,ne": "ne", "e,se": "se", "e,sw": "se", "e,nw": "ne",
"s,ne": "se", "s,se": "se", "s,sw": "sw", "s,nw": "sw",
"w,ne": "nw", "w,se": "sw", "w,sw": "sw", "w,nw": "nw",

// Intercardinal → Cardinal (16 mappings)
"ne,n": "n", "ne,e": "e", "ne,s": "e", "ne,w": "n",
"se,n": "e", "se,e": "e", "se,s": "s", "se,w": "s",
"sw,n": "w", "sw,e": "s", "sw,s": "s", "sw,w": "w",
"nw,n": "n", "nw,e": "n", "nw,s": "w", "nw,w": "w",
```

### Arrow SVGs

**Good news:** 112 skew arrow variants already exist in `arrows-sprite.svg`!

```
Naming convention:
- Minus skew: {type}_{turns}_{orientation}_skew-
- Plus skew: {type}_x5F_{turns}_x5F_{orientation}_x5F_skew_x2B_
```

**Required change:** Update `ArrowPathResolver.getArrowSymbolId()` to append skew suffix when `motionData.skewDir` is present.

---

## Part 3: SkewLab Validation

The SkewLab module correctly:
- Maps all 32 ZETA/ETA positions to hand locations
- Renders static pictographs at each position
- Respects user prop preferences

**Limitation:** Only tests STATIC motions, not movement arrows.

---

## Recommended Fix Order

### Phase 1: Fix Data Generator (Subtask #13 continuation)
1. Update `generate-skewed-dataframe.ts` to generate RED-skew variants
2. Add all 32 ZETA/ETA positions as end destinations
3. Validate red ends at E and S (not just N and W)

### Phase 2: Add Missing Transitions (Subtasks #14, #15)
1. Generate ZETA/ETA → ALPHA/BETA/GAMMA transitions
2. Generate ZETA/ETA → ZETA/ETA transitions
3. Rerun data generation

### Phase 3: Arrow Integration (Subtasks #11, #12)
1. Add 32 skewed mappings to ArrowLocator
2. Update ArrowPathResolver to use skewDir suffix
3. Test arrow rendering in SkewLab with movement pictographs

### Phase 4: Generator Integration (Subtask #7)
1. Add SKEWED to GridModeCard (needs tri-state selector)
2. Update StartPositionSelector for skewed mode
3. Test end-to-end generation

---

## Files Requiring Changes

| File | Change Type | Priority |
|------|-------------|----------|
| `scripts/generate-skewed-dataframe.ts` | Fix red-skew generation | HIGH |
| `ArrowLocator.ts` | Add 32 skewed mappings | HIGH |
| `ArrowPathResolver.ts` | Add skewDir suffix logic | HIGH |
| `GridModeCard.svelte` | Convert to tri-state | MEDIUM |
| `ToggleCard.svelte` | Support 3 options OR create new component | MEDIUM |
| `GenerationOrchestrator.ts` | Add skewed start positions | MEDIUM |
