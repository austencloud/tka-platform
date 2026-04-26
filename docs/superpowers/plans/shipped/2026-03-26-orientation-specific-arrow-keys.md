# Implementation Plan: Orientation-Specific Arrow Adjustment Keys

**Spec:** `docs/superpowers/specs/2026-03-26-orientation-specific-arrow-keys-design.md`
**Date:** 2026-03-26

## Steps

### Step 1: Update `SpecialPlacementOriKeyGenerator`

**Files:**
- `src/lib/shared/pictograph/arrow/positioning/key-generation/services/contracts/ISpecialPlacementOriKeyGenerator.ts`
- `src/lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/SpecialPlacementOriKeyGenerator.ts`

**Changes:**
1. Add `mapToLegacyBucket(specificOriKey: string): string` to the interface
2. Change `generateOrientationKey()` to return `{blueEndOri}_{redEndOri}` (e.g., `counter_counter`)
3. Implement `mapToLegacyBucket()` with the old layer mapping logic (pure function on the key string)

**Verify:** `npm run check` passes (type check catches any callers that break)

### Step 2: Update `GlobalArrowAdjustmentRepository` cascading lookup

**Files:**
- `src/lib/shared/pictograph/arrow/positioning/global/services/contracts/IGlobalArrowAdjustmentRepository.ts`
- `src/lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalArrowAdjustmentRepository.ts`

**Changes:**
1. Add `legacyOriKey: string` parameter to `getAdjustmentCascading()` in both interface and implementation
2. Within each prop-type layer (3, 2, 1), try the specific oriKey first, then fallback to legacyOriKey
3. The method body doubles from 3 layer checks to 3 layers x 2 oriKey variants = 6 in-memory Map lookups (trivial perf)

**Verify:** `npm run check` — this will show all callers of `getAdjustmentCascading` that need updating (they now need to pass legacyOriKey)

### Step 3: Update callers of `getAdjustmentCascading`

**Files:**
- `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts` — `getDiagnostics()` and `getBaseAdjustment()` (via `lookupSpecialPlacement()`)
- `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer.ts` — `getSpecialAdjustment()`

**Changes:**
1. After generating `oriKey`, also compute `legacyOriKey = this.oriKeyGenerator.mapToLegacyBucket(oriKey)`
2. Pass `legacyOriKey` as the new parameter to `getAdjustmentCascading()`

**Verify:** `npm run check` passes

### Step 4: Update `SpecialPlacer` JSON folder fallback

**File:** `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer.ts`

**Changes:** In all 3 methods that call `this.dataService.getLetterData(gridMode, oriKey, letter)`:

1. `getSpecialAdjustment()` (line ~114)
2. `hasRotationAngleOverride()` (line ~192)
3. `getSpecialJsonAdjustmentOnly()` (line ~266)

Add fallback: if letterData is null/empty, try again with `legacyOriKey`:

```typescript
let letterData = await this.dataService.getLetterData(gridMode, oriKey, letter);
if (!letterData || Object.keys(letterData).length === 0) {
  const legacyOriKey = this.oriKeyGenerator.mapToLegacyBucket(oriKey);
  letterData = await this.dataService.getLetterData(gridMode, legacyOriKey, letter);
}
```

Also update `getSpecialJsonAdjustmentOnly()` to report the actual folder used in the `filePath` return value.

Also update `checkLocalStorageOverride()` with the same two-key pattern.

**Verify:** `npm run check` passes

### Step 5: Update `RotationOverrideManager` localStorage fallback

**File:** `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/RotationOverrideManager.ts`

**Changes:**
1. In `hasRotationOverride()`: after looking up with specific oriKey, if not found, try legacy bucket
2. `toggleRotationOverride()` saves under the specific oriKey (new format). Old entries remain accessible via the fallback in `hasRotationOverride()`.

**Verify:** `npm run check` passes

### Step 6: Build verification

**Commands:**
- `npm run check` — TypeScript compilation
- `npm run build` — Full production build

**Verify:** Both pass with zero errors.

## Notes

- No Firestore migration needed. Old entries become fallback matches.
- No JSON file changes needed. Legacy folder structure serves as fallback.
- The `ArrowAdjustmentOrchestrator` (WASD save path) goes through `GlobalAdjustmentKeyGenerator`, which delegates to `SpecialPlacementOriKeyGenerator.generateOrientationKey()`. New saves automatically use the specific oriKey format.
- Display changes in `PictographInspectModal.svelte` and `ArrowAdjustmentHistory.svelte` happen automatically since they read the oriKey from the same generator.
