# Dash Arrow Positioning Diagnostic Tool

## Problem

When modifying directional tuple transformation matrices in `DirectionalTupleProcessor.ts`, changes may have no effect on arrow positioning. This indicates the transformation pipeline is either:

- Not being executed (motion type/rotation/grid mode not detected correctly)
- Catching errors and using fallback values
- Being bypassed by caching or async issues

## Solution: Comprehensive Diagnostic Pipeline

This tool traces the complete arrow positioning flow from start to finish, validating each step.

## Quick Start

### Method 1: UI Button (Recommended)

Add the debug button to any component that displays pictographs:

```svelte
<script>
  import DashPositioningDebugButton from "$shared/pictograph/arrow/positioning/calculation/components/DashPositioningDebugButton.svelte";
  import { pictographState } from "./your-pictograph-state";
</script>

<!-- Add near your pictograph display -->
<DashPositioningDebugButton
  pictographData={pictographState.pictographData}
  debugBoth={true}
/>
```

Good places to add this:

- `src/lib/modules/build/animate/components/AnimationPanel.svelte`
- `src/lib/modules/browse/shared/components/BrowseModule.svelte`
- `src/lib/shared/pictograph/shared/components/Pictograph.svelte`

### Method 2: Svelte 5 Composable (Runes-based)

Use the composable in any Svelte component:

```svelte
<script lang="ts">
  import { useDashPositioningDebug } from "$shared/pictograph/arrow/positioning/calculation/services/implementations/useDashPositioningDebug.svelte";

  const { debugPictograph, debugBothArrows } = useDashPositioningDebug();

  // Call when needed:
  await debugPictograph(myPictographData, true); // Debug blue arrow
  await debugBothArrows(myPictographData); // Debug both arrows
</script>
```

### Method 3: Browser Console

Open browser console and call:

```javascript
// Debug blue arrow
window.debugDashArrow(pictographData, true);

// Debug red arrow
window.debugDashArrow(pictographData, false);
```

## What It Tests

The diagnostic runs 8 comprehensive checks:

### ✅ STEP 1: Motion Type Detection

- Validates motion is detected as DASH
- Checks raw motion type value
- **Common issue**: Motion type string not matching "dash" exactly

### ✅ STEP 2: Rotation Direction Detection

- Validates rotation direction (CW/CCW/NoRotation)
- Checks turn count
- **Common issue**: 1 turn not mapped to "clockwise" correctly

### ✅ STEP 3: Grid Mode Detection

- Determines if grid is Diamond or Box mode
- Checks motion start/end locations (cardinal vs diagonal)
- **Common issue**: Wrong grid mode causes wrong transformation matrices

### ✅ STEP 4: Arrow Location Calculation

- Uses `DashLocationCalculator` to get arrow position
- Shows calculated location vs motion locations
- **Common issue**: Arrow location doesn't match expected position

### ✅ STEP 5: Base Adjustment Retrieval

- Gets XY values from JSON files
- Shows special vs default placement
- **Common issue**: JSON key mismatch returns (0,0)

### ✅ STEP 6: Directional Tuple Generation ⚠️ CRITICAL

- **This is where your transformation matrices are applied**
- Generates 4 tuples (one per quadrant) from base XY
- Shows all 4 transformed values
- **Validates transformation occurred** (tuples ≠ base values)
- **Common issue**: All tuples identical to base = NO TRANSFORMATION

### ✅ STEP 7: Quadrant Index Calculation

- Determines which quadrant the arrow is in
- Shows index mapping (0=NE, 1=SE, 2=SW, 3=NW)
- **Common issue**: Wrong index selects wrong tuple

### ✅ STEP 8: Final Adjustment Application

- Shows which tuple was selected
- Compares final vs base adjustment
- **Validates transformation was applied to final result**
- **Common issue**: Final equals base = transformation bypassed

## Interpreting Results

### ✅ Success Output Example

```
🔍 DASH POSITIONING DIAGNOSTIC
  📋 STEP 1: Motion Type Detection
    ✅ Motion correctly detected as DASH

  🔄 STEP 2: Rotation Direction Detection
    Raw rotation: "clockwise"
    Turns: 1
    Detected as CW: true

  🔢 STEP 6: Directional Tuple Generation
    Base values: (10, 15)
    Generated tuples:
      NE (index 0): (10, -15)   ← TRANSFORMED!
      SE (index 1): (15, 10)    ← TRANSFORMED!
      SW (index 2): (-10, 15)   ← TRANSFORMED!
      NW (index 3): (-15, -10)  ← TRANSFORMED!
    ✅ Tuples are transformed (different from base)

  ✨ STEP 8: Final Adjustment Application
    Selected quadrant: 1
    Selected tuple: (15, 10)
    ✅ Transformation was applied
```

### ⚠️ Problem Output Example

```
🔍 DASH POSITIONING DIAGNOSTIC
  📋 STEP 1: Motion Type Detection
    ⚠️ WARNING: Motion is NOT detected as DASH!
    Current type: dash
    ^ Possible string case mismatch

  🔢 STEP 6: Directional Tuple Generation
    Base values: (10, 15)
    Generated tuples:
      NE (index 0): (10, 15)    ← SAME AS BASE!
      SE (index 1): (10, 15)    ← SAME AS BASE!
      SW (index 2): (10, 15)    ← SAME AS BASE!
      NW (index 3): (10, 15)    ← SAME AS BASE!
    ⚠️ WARNING: All tuples are identical to base adjustment!
    ⚠️ This suggests transformation matrices are NOT being applied!

  ✨ STEP 8: Final Adjustment Application
    ⚠️ WARNING: Final adjustment is identical to base adjustment!
    ⚠️ Transformation was NOT applied!
```

## Common Issues & Fixes

### Issue: "Transformation matrices NOT being applied"

**Symptoms**: All tuples identical to base in Step 6

**Possible causes**:

1. Motion type not detected as "dash" (check Step 1)
2. Rotation direction not detected as CW/CCW (check Step 2)
3. Grid mode wrong (check Step 3)
4. Error caught silently in `processDirectionalTuples()` try-catch

**Fix**: Check the console for caught errors in Step 6. The transformation logic in `DirectionalTupleProcessor.generateDirectionalTuples()` might be throwing an error.

### Issue: "Changes to matrices have no effect"

**Symptoms**: Modified `DirectionalTupleProcessor.ts` lines 200-206 but arrows don't move

**Possible causes**:

1. Wrong code path being executed (box mode instead of diamond)
2. Error being caught and base adjustment returned
3. Module not reloaded (HMR issue)

**Fix**:

1. Run diagnostic to confirm which code path is executed
2. Add `console.log()` directly in the transformation matrix code
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: "Base adjustment is (0, 0)"

**Symptoms**: Step 5 shows (0, 0) for base adjustment

**Possible causes**:

1. JSON key mismatch in placement files
2. Motion parameters don't match any JSON entry
3. JSON file not loaded

**Fix**: Check `DefaultPlacementService` logs for JSON loading errors

## Files Modified/Created

- **DirectionalTupleDebugger.ts** - Core diagnostic engine
- **useDashPositioningDebug.svelte.ts** - Svelte 5 composable
- **DashPositioningDebugButton.svelte** - Drop-in UI component
- **DEBUG_GUIDE.md** - This documentation

## Next Steps

1. Add the debug button to a component that displays pictographs
2. Find a pictograph with a dash motion that has 1 turn (clockwise)
3. Click the debug button
4. Check console output
5. Look for warnings in Steps 6 and 8
6. This will tell you exactly where the transformation is failing

## Example: Debugging a Specific Issue

**Your issue**: Modifying lines 200-206 in DirectionalTupleProcessor has no effect

**Steps**:

1. Add debug button to AnimationPanel
2. Load a pictograph with clockwise dash + 1 turn
3. Click debug button
4. Look at Step 2: Is it detecting "clockwise"?
5. Look at Step 3: Is it detecting "diamond" mode?
6. Look at Step 6: Are the tuples DIFFERENT from base?
7. Look at Step 8: Is the final adjustment DIFFERENT from base?

**Expected**: If your code is being executed, Step 6 should show 4 different tuples using your modified matrices.

**If NOT**: The diagnostic will show you exactly which condition is failing (wrong motion type, wrong grid mode, error caught, etc.)
