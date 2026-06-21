# Special JSON Firestore Editing

**Date:** 2026-05-25
**Status:** Design

## Problem

The arrow positioning pipeline has 4 tiers. The Special JSON tier (per-letter placement data in static `R_placements.json` files) contains legacy values tuned in the Python desktop app's WASD panel. Some values are wrong — e.g., R's `(3,3)` anti entry is `[0, -100]`, placing the arrow 250px above its prop. The correct default would be `[45, -55]`, but the Special JSON overrides it.

Currently, only Global Overrides (Tier 1) are editable from the web app via Firestore. Special JSON values are baked into static files — editable only by modifying JSON on disk, which doesn't work in production (Cloudflare serves static files from build artifacts).

## Solution

Add a Firestore-backed override layer for Special JSON entries. When present, a Firestore special override replaces the static file value for that key. The static file becomes the "original/legacy" fallback.

## Pipeline Cascade (Updated)

```
1. Global Override        (Firestore: global_arrow_adjustments)      — unchanged
2. Special JSON Override  (Firestore: special_arrow_placements)      — NEW
3. Special JSON           (static file: R_placements.json)           — existing, now fallback
4. Prop Geometry          (Firestore: prop_geometry_adjustments)      — unchanged
5. Default                (calculated from motion type + turns)       — unchanged
```

First non-null tier wins. Tier 2 beats Tier 3 for the same key.

## Data Model

### Firestore Collection: `special_arrow_placements`

**Document ID format:** `{gridMode}|{oriFolder}|{letter}|{turnsTuple}|{motionType}`

Example: `diamond|from_layer1|R|(3, 3)|anti`

**Document shape:**

```ts
interface SpecialArrowPlacement {
  key: string;              // compound key (same as doc ID)
  gridMode: string;         // "diamond" | "box"
  oriFolder: string;        // "from_layer1" | "from_layer2" | "from_layer3_blue1_red2" | etc.
  letter: string;           // "R", "H", "Sigma-", etc.
  turnsTuple: string;       // "(3, 3)", "(0, 0)", "(fl, 2)", etc.
  motionType: string;       // "pro" | "anti" | "float" | "dash" | "static"
  adjustmentX: number;      // base X offset
  adjustmentY: number;      // base Y offset
  originalX: number;        // static file X (for reference)
  originalY: number;        // static file Y (for reference)
  updatedAt: Timestamp;
  updatedBy: string;        // email
}
```

Storing `originalX`/`originalY` lets the UI show what the static file had, enabling "revert to original" without re-reading the JSON.

### Zod Schema

```ts
const SpecialArrowPlacementSchema = z.object({
  key: z.string(),
  gridMode: z.string(),
  oriFolder: z.string(),
  letter: z.string(),
  turnsTuple: z.string(),
  motionType: z.string(),
  adjustmentX: z.number(),
  adjustmentY: z.number(),
  originalX: z.number(),
  originalY: z.number(),
  updatedAt: z.any(),
  updatedBy: z.string(),
});
```

## Pipeline Integration

### PipelineDiagnostics Changes

```ts
// PipelineTier enum stays the same — no new value needed.
// The SpecialJsonTierInfo.firestoreOverride field distinguishes the source.

export interface SpecialJsonTierInfo {
  value: TierValue;              // active value (Firestore override if exists, else static)
  filePath: string;              // static file path (always populated if static entry exists)
  turnsTupleKey: string;
  firestoreOverride: {           // NEW — non-null when a Firestore override exists
    value: TierValue;            // the override value
    original: TierValue | null;  // what the static file had (null if no static entry)
    updatedAt: Timestamp;
    updatedBy: string;
  } | null;
}
```

When `firestoreOverride` is non-null, the `value` field reflects the override (not the static file). The `activeTier` stays `"special-json"` — the UI uses `firestoreOverride` presence to show the "(override)" badge.

### Creating New Special JSON Entries

If no static file entry exists for a letter/turns/motionType combo, the Firestore override can still be created. In this case:
- `diagnostics.specialJson` is `null` (no static entry)
- The key is generated from the motion data directly: `{gridMode}|{oriFolder}|{letter}|{turnsTuple}|{motionType}`
- `firestoreOverride.original` is `null`
- This effectively creates a per-letter placement where none existed before

### ArrowAdjustmentCalculator.getDiagnostics() Changes

Insert a new probe between Tier 1 (Global) and Tier 2 (Special JSON):

```
Tier 1: Global Override probe        — existing (lines 178-261)
Tier 1.5: Special JSON Override probe — NEW (Firestore lookup)
Tier 2: Special JSON probe           — existing (lines 263-288)
Tier 3: Prop Geometry probe          — existing
Tier 4: Default probe                — existing
```

The Tier 1.5 probe generates the same key the static JSON uses (`gridMode|oriFolder|letter|turnsTuple|motionType`) and checks Firestore. If found, it populates `diagnostics.specialJson.firestoreOverride`.

### ArrowAdjustmentCalculator.getBaseAdjustment() Changes

In `lookupSpecialPlacement()`, after checking Global Override, check Firestore special placements before falling through to static JSON. The `SpecialPlacer.getSpecialAdjustment()` method needs to be aware of this new layer.

## New Service: SpecialArrowPlacementRepository

Follows the exact pattern of `GlobalArrowAdjustmentRepository`:

```
src/lib/shared/pictograph/arrow/positioning/special-override/
  domain/
    SpecialArrowPlacement.ts          — types + Zod schema + key generation
  services/
    implementations/
      SpecialArrowPlacementPersister.ts   — Firestore CRUD
      SpecialArrowPlacementRepository.ts  — state + cascading lookup
    special-override-singleton.ts         — singleton accessor
  state/
    SpecialArrowPlacementState.svelte.ts  — reactive state
```

**Key methods:**

- `getOverride(key: string): TierValue | null` — lookup by compound key
- `saveOverride(input: SpecialArrowPlacementInput): Promise<void>` — admin-only
- `deleteOverride(key: string): Promise<void>` — admin-only, reverts to static file
- `saveOverrideLocal(input): void` — optimistic update for WASD preview
- `deleteOverrideLocal(key): void` — optimistic delete

**Admin gate:** Same as Global Overrides — only `austencloud@gmail.com` can save/delete.

**Initialization:** Called alongside `initializeGlobalAdjustments()` in the auth-ready hook. Loads all overrides into memory, starts Firestore snapshot subscription.

## UI Changes: PipelineTraceSection.svelte

### Edit Target Selection

Currently: Edit button opens WASD editor targeting Global Overrides only.

New: Edit mode has a target selector. Clicking a tier row while editing selects that tier as the edit target.

Two editable targets:
1. **Global Override** — existing behavior, Layer 1/2/3 tabs, saves to `global_arrow_adjustments`
2. **Special JSON** — NEW, no layer tabs, saves to `special_arrow_placements`

Default and Prop Geometry rows are not directly editable (read-only display).

### Numeric Input Fields

Both targets get editable X/Y number inputs alongside WASD:

```svelte
<div class="editor-values">
  <label>
    X: <input type="number" bind:value={editX} onchange={handleNumericChange} />
  </label>
  <label>
    Y: <input type="number" bind:value={editY} onchange={handleNumericChange} />
  </label>
</div>
```

WASD increments update the same `editX`/`editY` state. Typing a value and pressing Enter also works.

### Special JSON Row Display (When Override Exists)

```
★ Special JSON (override)  [45, -55]
  └ original               [0, -100]    (dimmed, struck through)
```

The "original" sub-row shows the static file value. A "Revert" button deletes the Firestore override, restoring the static file as active.

### Special JSON Edit Mode

When Special JSON tier is selected as edit target:

1. No Layer tabs (single value, not 3-layer cascade)
2. Pre-populate editor with current value (Firestore override if exists, else static file value)
3. WASD adjusts from current value
4. Save writes to Firestore `special_arrow_placements`
5. Delete removes Firestore override (reverts to static file)
6. `onDiagnosticsChanged` fires to refresh the pipeline display

### Key Generation for Special JSON Override

The compound key must match between the diagnostics probe and the editor save. The `SpecialJsonTierInfo` already exposes `filePath` and `turnsTupleKey`. From these:

```ts
function generateSpecialOverrideKey(
  diagnostics: PipelineDiagnostics,
  motionData: MotionData,
  pictographData: PictographData
): string {
  const gridMode = motionData.gridMode || "diamond";
  const oriFolder = extractOriFolderFromPath(diagnostics.specialJson!.filePath);
  const letter = pictographData.letter;
  const turnsTuple = diagnostics.specialJson!.turnsTupleKey;
  const motionType = motionData.motionType.toLowerCase();
  return `${gridMode}|${oriFolder}|${letter}|${turnsTuple}|${motionType}`;
}
```

`extractOriFolderFromPath` parses `"diamond/special/from_layer1/R_placements.json"` to extract `"from_layer1"`.

## Firestore Security Rules

```
match /special_arrow_placements/{docId} {
  allow read: if true;
  allow write: if request.auth != null
    && request.auth.token.email == "austencloud@gmail.com";
}
```

Same admin-only pattern as `global_arrow_adjustments`.

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts` | Types, Zod schema, key generation |
| `src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementPersister.ts` | Firestore CRUD |
| `src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementRepository.ts` | State + lookup |
| `src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts` | Singleton accessor |
| `src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts` | Reactive state |

## Files to Modify

| File | Change |
|------|--------|
| `PipelineDiagnostics.ts` | Add `"special-json-override"` tier, `firestoreOverride` field |
| `ArrowAdjustmentCalculator.ts` | Add Tier 1.5 probe in `getDiagnostics()`, add override check in `getBaseAdjustment()` |
| `SpecialPlacer.ts` | Check Firestore override before static JSON in `getSpecialAdjustment()` |
| `PipelineTraceSection.svelte` | Add target selector, numeric inputs, Special JSON edit mode, override display |
| `hooks.client.ts` (or auth-ready hook) | Initialize `SpecialArrowPlacementRepository` alongside global adjustments |
| Firestore security rules | Add `special_arrow_placements` collection rules |

## Out of Scope

- Editing Prop Geometry or Default tiers from this panel
- Batch editing multiple letters at once
- History/undo for Special JSON overrides (could reuse the Global Override history pattern later)
- Migrating all static JSON data to Firestore (future project — this is the stepping stone)
