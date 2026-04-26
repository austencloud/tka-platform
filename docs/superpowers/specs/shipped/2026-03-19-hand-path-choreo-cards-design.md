# Hand Path Choreo Cards for L1 Deck

**Date:** 2026-03-19
**Status:** Approved
**Supersedes:** `2026-03-19-hand-path-purpose-built-data-design.md` (refined from purpose-built approach into minimal DSL)

## Problem

The L1 Quartered Rotated LOOP deck has 64 sequences mapping to 18 unique hand paths. We need to render hand path cards showing pure spatial trajectories: where each hand goes, stripped of letters, orientation, and prop type.

The previous approach (render-time `handPathMode` flag) failed because the flag couldn't penetrate 4+ cache layers consistently. The purpose-built data approach in the prior spec was sound but over-complicated the data construction.

## Design

### Core Insight

The rendering engine already handles everything we need — HAND props at 0° rotation, float arrows showing trajectory, null letters producing no overlay. The only missing piece is a clean way to construct the input data from location traces, and a way to prevent arrow overlap when two hands share a location.

### HandPathDataBuilder

A service that takes a minimal location-trace DSL and produces valid `PictographData[]`.

**Input:**
```typescript
interface HandPathTrace {
  blue: GridLocation[];   // length 9: start position + 8 beat destinations
  red: GridLocation[];    // length 9: start position + 8 beat destinations
}
```

**Output:** `PictographData[]` — one per beat (8 total), each containing blue and red `MotionData`.

**Derivation rules per beat (beat N uses index N-1 → N):**

| Field | Value | Why |
|---|---|---|
| `startLocation` | `trace[N-1]` | Previous position |
| `endLocation` | `trace[N]` | Current destination |
| `motionType` | `"float"` if start ≠ end, `"static"` if start = end | Shifts become floats to show trajectory arrows |
| `turns` | `"fl"` if float, `0` if static | Standard float/static turns |
| `color` | `"blue"` or `"red"` | From which hand |
| `propType` | `"hand"` | HAND SVG, 0° rotation via PropPlacer |
| `startOrientation` | `"in"` | Irrelevant — HAND prop ignores orientation |
| `endOrientation` | `"in"` | Same |
| `rotationDirection` | `"no_rotation"` | Floats use handpath direction for arrow rotation, not this field |
| `gridMode` | `"diamond"` | L1 deck uses cardinal locations |
| `isVisible` | `true` | Always visible |
| `arrowLocation` | Default from `createMotionData()` | The rendering pipeline's `ArrowPositioningOrchestrator` recalculates arrowLocation from motion geometry before rendering. The builder does NOT pre-compute this. |
| `handPath` | Derived: CW for N→E, E→S, S→W, W→N; CCW for reverse | Float arrows use handPath direction for rotation instead of rotationDirection. Must be set for correct arrow orientation. |

**PictographData.id:** The builder generates synthetic IDs in the format `hp-{handPathIndex}-beat-{N}` to avoid conflicts with real sequence IDs. These are used as cache keys downstream.

All other MotionData fields use `createMotionData()` defaults. The builder calls `createMotionData()` with only the overrides listed above.

**PictographData per beat:**
```typescript
{
  letter: null,           // No TKA overlay
  motions: { blue, red }, // MotionData constructed above
  gridMode: "diamond",    // L1 deck
  startPosition: null,    // Not needed for hand path rendering
  endPosition: null,
}
```

### Extracting traces from handPathId

The `handPathId` already stored on each sequence encodes the full location trace:
```
n→e→e→s→s→w→w→n→n|s→w→w→n→n→e→e→s→s
```

Format: `blueTrace|redTrace` where each trace is 9 locations (start + 8 beats) separated by `→`.

The builder parses this directly — no need to inspect the sequence's motion data at all.

### ArrowCollisionResolver

When two float arrows share the same grid location in a beat, the default positioning stacks them at the same pixel coordinates. This service applies a fixed offset to separate them.

**Algorithm:**

1. For each beat, check if blue and red arrows have the same `endLocation`.
2. If they collide, determine the **outward direction** from grid center for that location:
   - N → push along Y axis (up/down)
   - E → push along X axis (right/left)
   - S → push along Y axis (down/up)
   - W → push along X axis (left/right)
   - NE → push along diagonal (up-right / down-left)
   - SE → push along diagonal (down-right / up-left)
   - SW → push along diagonal (down-left / up-right)
   - NW → push along diagonal (up-left / down-right)
3. Apply offset: push blue arrow outward by ~25px, push red arrow inward by ~25px.
4. Store offsets in the `arrowPlacementData.manualAdjustmentX/Y` fields on each MotionData.

**Offset vectors in 950x950 coordinate space:**

The pictograph renders in a 950x950 coordinate system. Grid points are ~143 units apart (e.g., N at y=332, center at y=475). An offset of ~50 units provides visible separation without pushing arrows off-grid. For diagonals, `50 / sqrt(2) ≈ 35`.

| Location | Blue offset (outward) | Red offset (inward) |
|---|---|---|
| N | (0, -50) | (0, +50) |
| E | (+50, 0) | (-50, 0) |
| S | (0, +50) | (0, -50) |
| W | (-50, 0) | (+50, 0) |
| NE | (+35, -35) | (-35, +35) |
| SE | (+35, +35) | (-35, -35) |
| SW | (-35, +35) | (+35, -35) |
| NW | (-35, -35) | (+35, +35) |

These values are starting points. The exact magnitude may need visual tuning — start at 50 units and adjust based on how the rendered cards look.

**Two-tier adjustment model:**
- **Tier 1 (algorithmic):** This service handles all cases automatically.
- **Tier 2 (manual):** The existing manual adjustment infrastructure (`manualAdjustmentX/Y`) can fine-tune any beat that doesn't look right. This is the same system used for letter-based arrow tuning.

### Collision frequency in L1 deck

8 of 18 hand paths have collisions (~40 collision beats total):
- 2 hand paths: identical traces, all 8 beats collide
- 6 hand paths: offset traces, 4 beats collide (alternating odd or even)
- 10 hand paths: no collisions

All collisions occur at cardinal locations (N, E, S, W) since L1 uses diamond grid.

### Where this plugs into the UI

`DeckFamilySection.svelte` groups sequences by `handPathId`. For each unique hand path:

1. Parse the `handPathId` string into a `HandPathTrace`
2. Pass to `HandPathDataBuilder` to get `PictographData[]`
3. Run `ArrowCollisionResolver` on the result
4. Render each beat's `PictographData` through the existing `PropAwareThumbnail` pipeline

No new UI components needed. The hand path card is just a choreo card with different input data.

### Dash motions in hand paths

Some hand paths include dash motions (hand stays at same location but performs a dash). In the location trace, these appear as repeated locations: `...e→e...` (start and end are the same).

For the hand path card, dashes become `motionType: "static"` with `turns: 0` since the hand doesn't move spatially. The trajectory visualization only cares about where hands go, not what rotation they perform in place. This is correct — a dash and a static look identical in terms of spatial trajectory.

**Intentional behavior:** Static arrows render as empty SVGs (no visible arrow). This means beats where a hand stays in place show only the HAND prop dot, no arrow. This is correct — if the hand doesn't move, there's no trajectory to visualize. Some beats in collision hand paths will show one arrow (moving hand) and one dot (stationary hand).

## Files

### New files
- `src/lib/features/choreo-card/services/contracts/IHandPathDataBuilder.ts` — interface
- `src/lib/features/choreo-card/services/implementations/HandPathDataBuilder.ts` — location trace → PictographData[]
- `src/lib/features/choreo-card/services/contracts/IArrowCollisionResolver.ts` — interface
- `src/lib/features/choreo-card/services/implementations/ArrowCollisionResolver.ts` — overlap detection + offset

### Modify
- `DeckFamilySection.svelte` — use HandPathDataBuilder for hand path card rendering
- `src/lib/shared/di/containers/choreo-card-container.ts` — register both new services (create if not exists)

### Can remove (optional cleanup)
- `handPathMode` flag threading through ImageComposer, ThumbnailRenderer, etc.
- `transformForHandPath()` and `deriveHandPath()` in PictographPreparer

## Testing strategy

Per earned tests philosophy — the `HandPathDataBuilder` is a pure transform (location trace → PictographData) where bugs would be silent (wrong data renders wrong arrows without crashing). Worth a test.

The `ArrowCollisionResolver` is pure math (detect overlap, compute offset vector). Also worth a test since wrong offsets produce overlapping arrows without any error.

Test cases:
1. Parse a handPathId string into correct HandPathTrace
2. Non-colliding beat produces no offsets
3. Colliding beat at each cardinal direction produces correct offset vectors
4. Full 8-beat sequence with alternating collisions
