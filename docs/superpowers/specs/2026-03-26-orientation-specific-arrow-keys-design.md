# Orientation-Specific Arrow Adjustment Keys

**Date:** 2026-03-26
**Status:** Draft

## Problem

The global arrow adjustment tier collapses specific orientations into coarse buckets before saving:

| Orientation | Current Bucket |
|-------------|---------------|
| `in` | `from_layer1` (radial) |
| `out` | `from_layer1` (radial) |
| `clock` | `from_layer2` (nonradial) |
| `counter` | `from_layer2` (nonradial) |

This means adjusting an arrow when both props end in `counter` also changes the arrow when both props end in `clock`, because both map to `from_layer2`. For staves this is fine (the SVG looks the same either way). For fans, the SVG extends differently in `clock` vs `counter`, so each needs its own adjustment.

### Concrete Example

The sequence IIII (vtg-2to1-tog-same-iiii) has 4 beats, all letter I with identical motion types and turns. The orientations cycle:

| Beat | Blue End Ori | Red End Ori | Current oriKey |
|------|-------------|-------------|----------------|
| 1 | counter | counter | `from_layer2` |
| 2 | out | out | `from_layer1` |
| 3 | clock | clock | `from_layer2` |
| 4 | in | in | `from_layer1` |

Beats 1 and 3 share a key. Beats 2 and 4 share a key. Any WASD adjustment to beat 1's arrows is applied identically to beat 3, despite the fan SVGs requiring different positioning.

## Design Principle

**Store the most specific data you have. Generalize at lookup time, never at save time.**

The current system generalizes at save time (collapsing `counter` to `from_layer2`), which throws away information permanently. The fix: save the actual orientations, and let the cascading lookup provide generalization as a fallback.

## Solution

### New oriKey Format

Instead of the 4-bucket system (`from_layer1`, `from_layer2`, `from_layer3_blue1_red2`, `from_layer3_blue2_red1`), the oriKey encodes the actual end orientations of both hands:

```
{blueEndOrientation}_{redEndOrientation}
```

Examples:
- `counter_counter` (was `from_layer2`)
- `clock_clock` (was `from_layer2`)
- `in_in` (was `from_layer1`)
- `out_out` (was `from_layer1`)
- `in_clock` (was `from_layer3_blue1_red2`)
- `counter_out` (was `from_layer3_blue2_red1`)

### Cascading Fallback

When looking up an adjustment, the system tries the specific key first, then falls back to the legacy bucket key:

```
1. Try specific: "diamond|counter_counter|I|(0.5, 0.5)|blue|fan"
2. No match? Map to legacy bucket: "diamond|from_layer2|I|(0.5, 0.5)|blue|fan"
3. Continue existing cascade (Layer 2 → Layer 1 for staff)
```

This means:
- **All existing Firestore entries (using `from_layer1`/`from_layer2`/`from_layer3_*`) keep working.** They become the fallback layer.
- **New saves use specific orientation keys.** They take priority when present.
- **Staff adjustments** saved with the old bucket keys continue to match all orientations in that bucket, which is correct behavior for staves.
- **Fan adjustments** saved with specific keys only match that exact orientation combination.

### No Data Migration Required

Old entries are never deleted or modified. They naturally become the "general" fallback. Over time, as the user makes fan-specific adjustments, specific-orientation entries accumulate and take priority for cases where they exist.

## Changes

### 1. `SpecialPlacementOriKeyGenerator.ts`

**Current behavior:** Maps `in`/`out` → layer 1, everything else → layer 2, then combines into `from_layer1`/`from_layer2`/`from_layer3_*`.

**New behavior:** Returns `{blueEndOri}_{redEndOri}` directly (e.g., `counter_counter`, `in_out`).

Add a new method `mapToLegacyBucket()` that performs the old mapping, for use during fallback lookups.

```typescript
// New primary method
generateOrientationKey(motionData, pictographData): string {
  const blueEndOri = blueMotion.endOrientation || "in";
  const redEndOri = redMotion.endOrientation || "in";
  return `${blueEndOri}_${redEndOri}`;
}

// Fallback mapping (used by cascade lookup)
mapToLegacyBucket(specificOriKey: string): string {
  const [blueOri, redOri] = specificOriKey.split("_");
  const blueLayer = ["in", "out"].includes(blueOri) ? 1 : 2;
  const redLayer = ["in", "out"].includes(redOri) ? 1 : 2;
  if (blueLayer === 1 && redLayer === 1) return "from_layer1";
  if (blueLayer === 2 && redLayer === 2) return "from_layer2";
  if (blueLayer === 1 && redLayer === 2) return "from_layer3_blue1_red2";
  return "from_layer3_blue2_red1";
}
```

### 2. `GlobalArrowAdjustmentRepository.ts` — `getAdjustmentCascading()`

Add an orientation fallback step. The cascade becomes:

```
For each prop-type layer (Layer 3 → Layer 2 → Layer 1):
  1. Try with specific oriKey (e.g., "counter_counter")
  2. If no match, try with legacy bucket oriKey (e.g., "from_layer2")
```

The existing Layer 3 → Layer 2 → Layer 1 cascade (prop-type layers) remains unchanged. The orientation fallback is an inner loop within each prop-type layer.

The caller (in `ArrowAdjustmentCalculator`) computes the legacy key and passes it in, keeping the repository free of orientation-key-generation logic:

```typescript
// In ArrowAdjustmentCalculator (the caller):
const oriKey = this.orientationKeyService.generateOrientationKey(motionData, pictographData);
const legacyOriKey = this.orientationKeyService.mapToLegacyBucket(oriKey);
const baseKey = { gridMode, oriKey, letter, turnsTuple, arrowKey };
repo.getAdjustmentCascading(baseKey, legacyOriKey, thisPropType, otherPropType);

// In GlobalArrowAdjustmentRepository:
getAdjustmentCascading(
  baseKey: GlobalAdjustmentKey,       // specific oriKey (e.g., "counter_counter")
  legacyOriKey: string,               // fallback bucket (e.g., "from_layer2")
  thisPropType: string,
  otherPropType: string
): CascadingLookupResult | null {
  const fallbackKey = { ...baseKey, oriKey: legacyOriKey };

  // Layer 3: try specific → try legacy
  // Layer 2: try specific → try legacy
  // Layer 1: try specific → try legacy (staff only)
  // (Same structure as today, but each layer tries two oriKeys)
}
```

### 3. `GlobalAdjustmentKeyGenerator.ts`

No structural changes needed. It already delegates to `SpecialPlacementOriKeyGenerator.generateOrientationKey()`, which now returns specific keys. The generated key automatically uses the new format.

### 4. `SpecialPlacer.ts` — JSON Folder Fallback (Critical)

The static JSON files live in `/data/arrow_placement/{gridMode}/special/{oriKey}/`. The folders are named `from_layer1`, `from_layer2`, etc. After this change, `generateOrientationKey()` returns `counter_counter`, so the data provider tries to load from a `counter_counter/` folder that does not exist.

Three methods in `SpecialPlacer` pass `oriKey` to `SpecialPlacementDataProvider.getLetterData()`:
- `getSpecialAdjustment()` (line ~114)
- `getSpecialJsonAdjustmentOnly()` (line ~266)
- `hasRotationAngleOverride()` (line ~192)

Each needs the two-step fallback:

```typescript
// Try specific oriKey folder first
let letterData = await this.dataService.getLetterData(gridMode, oriKey, letter);
if (!letterData || Object.keys(letterData).length === 0) {
  // Fall back to legacy bucket folder
  const legacyOriKey = this.oriKeyGenerator.mapToLegacyBucket(oriKey);
  letterData = await this.dataService.getLetterData(gridMode, legacyOriKey, letter);
}
```

Since no specific-orientation JSON folders exist yet, the first lookup always returns empty and falls through to the legacy folders. This is correct — the JSON data was authored under the old scheme and remains valid. If specific-orientation JSON folders are added in the future, they will take priority.

### 5. `RotationOverrideManager.ts` — localStorage Key Fallback

`RotationOverrideManager` stores rotation overrides in localStorage keyed by `[gridMode][oriKey][letter][turnsTuple][rotationKey]`. After this change, new overrides save under `counter_counter` while old overrides remain under `from_layer2`.

Without a fallback, existing user overrides become orphaned. The lookup needs:

```typescript
// Try specific oriKey first
let override = overrides[gridMode]?.[specificOriKey]?.[letter]?.[turnsTuple]?.[rotationKey];
if (override === undefined) {
  // Fall back to legacy bucket oriKey
  const legacyOriKey = this.oriKeyGenerator.mapToLegacyBucket(specificOriKey);
  override = overrides[gridMode]?.[legacyOriKey]?.[letter]?.[turnsTuple]?.[rotationKey];
}
```

`SpecialPlacer.checkLocalStorageOverride()` (line ~299) also needs this pattern.

### 6. Interradial Orientations (Level 6+)

At Level 6, there are 8 orientations (e.g., `clockIn`, `counterOut`). These are not `in` or `out`, so `mapToLegacyBucket` classifies them as layer 2, which matches the current behavior. The specific key format (`clockIn_counterOut`) handles them correctly without special casing.

## Key Format Summary

### Before

```
diamond|from_layer2|I|(0.5, 0.5)|blue|fan
```

### After (new saves)

```
diamond|counter_counter|I|(0.5, 0.5)|blue|fan
```

### Lookup Order (for the oriKey dimension)

```
1. counter_counter  (specific — new format)
2. from_layer2      (legacy bucket — old format, fallback)
```

## What This Does NOT Change

- **Prop-type cascade** (Layer 3 → 2 → 1): Unchanged.
- **Directional tuple rotation**: Unchanged. This happens after adjustment lookup.
- **Beta offset logic**: Unchanged. Uses its own inline radial/nonradial check.
- **Prop geometry tier**: Already stores specific orientations. No changes needed.
- **Default placement tier**: No oriKey involved. Unchanged.
- **Firestore collection name/structure**: Same `global_arrow_adjustments` collection.
- **WASD panel UX**: Same interaction. Only the saved key format changes.

## Affected Files

| File | Change |
|------|--------|
| `SpecialPlacementOriKeyGenerator.ts` | New key format + `mapToLegacyBucket()` method |
| `ISpecialPlacementOriKeyGenerator.ts` | Add `mapToLegacyBucket()` to interface |
| `GlobalArrowAdjustmentRepository.ts` | Orientation fallback in cascading lookup. Pass legacy oriKey from caller rather than adding oriKeyGenerator dependency (keeps repo as a general-purpose data store). |
| `SpecialPlacer.ts` | Two-step JSON folder lookup in 3 methods + localStorage override fallback |
| `RotationOverrideManager.ts` | Two-key fallback for localStorage rotation overrides |
| `PictographInspectModal.svelte` | Display change only — oriKey now shows `counter_counter` instead of `from_layer2` (more informative, no code change needed) |
| `ArrowAdjustmentHistory.svelte` | Display change only — history entries show new format, old entries still parse correctly |

## Risk Assessment

**Low risk.** The change is additive:
- Old Firestore entries are never modified or deleted
- Old entries become fallback matches via `mapToLegacyBucket()`
- New entries use specific keys and take priority
- If anything goes wrong with specific key lookup, the fallback to legacy keys means behavior is identical to today

**Edge case:** If someone saves a staff adjustment with the new format (`in_in` instead of `from_layer1`), it will only match `in_in` specifically, not `out_out`. This is technically more restrictive than before for staves. However, this is actually more correct — if someone explicitly saves a staff adjustment while in `in_in` orientation, that adjustment should apply to `in_in`. The `from_layer1` fallback still provides the general staff behavior for orientations that don't have specific overrides.

## Success Criteria

After implementation, adjusting the blue arrow on beat 1 (counter/counter) of the IIII fan sequence should NOT affect the blue arrow on beat 3 (clock/clock). Each beat should be independently adjustable while sharing the same letter, motion types, and turns.
