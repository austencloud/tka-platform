---
status: backlog
value: 3
effort: L
remaining: Full build — compositional intent model
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Creator Intent & Compositional Finalization

**Date:** 2026-03-14
**Status:** Draft
**Builds on:** `2026-03-12-three-tier-sequence-model-design.md`

## Problem

Three related issues in the current model:

1. **`intendedProp` is too narrow.** The creator's intent includes more than just prop type — effort timelines are choreographic intent too. The field name and structure don't accommodate growth.

2. **Prop resolution is inconsistent.** `IntendedPropResolver` exists but is only used inline in `SequenceDetailContent.svelte`. The browse gallery ignores it entirely. There's no concept of "why am I viewing this sequence" driving the resolution.

3. **Dual persistence.** `steps` and `blueSoloProp + redSoloProp + stepPairings` are both written to Firestore. Two sources of truth is zero sources of truth.

## Solution

### 1. CreatorIntent replaces intendedProp

A single field on `SequenceData` that captures everything the creator explicitly chose:

```typescript
interface CreatorIntent {
  readonly propConfig: {
    readonly bluePropType: PropType;
    readonly redPropType: PropType;
    readonly catDogMode: boolean;
  };
  readonly effortTimeline?: EffortTimeline | null;
  // Future-proof: add fields here as new choreographic choices emerge
  // (e.g., tempo, time signature overrides, notation annotations)
}
```

**On SequenceData:**

```typescript
interface SequenceData {
  // NEW — replaces intendedProp and subsumes effortTimeline
  readonly creatorIntent?: CreatorIntent | null;

  // REMOVED
  // readonly intendedProp?: { ... } | null;    → moved into creatorIntent.propConfig
  // readonly effortTimeline?: EffortTimeline;   → moved into creatorIntent.effortTimeline

  // ... everything else unchanged
}
```

**Migration:** Read-time transform. If a loaded document has `intendedProp` but no `creatorIntent`, construct `creatorIntent` from the existing fields. If it has a top-level `effortTimeline`, fold it in. New saves always use `creatorIntent`.

**Capture timing:** `creatorIntent` is populated at save time from the user's current settings, same as `intendedProp` today. The Phrase Effort Lab's direct Firestore write (`setDoc` with merge) updates `creatorIntent.effortTimeline` specifically.

### 2. Entry-Point Prop Resolution

#### The Model

The viewing context determines which props to show. Two modes:

| Mode | When | Props from |
|------|------|------------|
| `"notation"` | Browse gallery, your library, practice mode | Viewer's settings |
| `"creator-expression"` | Creator profile, QR scan, shared link | `creatorIntent.propConfig` (falls back to viewer if absent) |

#### ViewingContext

```typescript
type ViewingContext = "notation" | "creator-expression";
```

Propagation mechanism depends on entry type:

- **External entry** (QR scan, shared link): URL query param `?intent=creator`. Absence defaults to `"notation"`.
- **Internal navigation** (browse → detail, profile → detail): Svelte context set by the parent module. The module that owns the entry point (BrowseModule, ProfileModule, LibraryModule) sets the context before navigating to the detail viewer.

Each entry point sets it:

| Entry point | Sets context to |
|---|---|
| Browse gallery → detail | `"notation"` |
| Library → detail | `"notation"` |
| Creator profile → detail | `"creator-expression"` |
| QR scan | `"creator-expression"` |
| Shared link (with `?intent=creator`) | `"creator-expression"` |
| Practice mode | `"notation"` |

#### Prop Resolution (Simplified)

The existing `IntendedPropResolver` is replaced with a simpler `PresentationResolver`:

```typescript
interface ResolvedPresentation {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
  readonly effortTimeline: EffortTimeline | null;
  readonly source: "creator-intent" | "viewer-settings";
}

interface IPresentationResolver {
  resolve(
    sequence: SequenceData,
    viewingContext: ViewingContext,
    viewerBlue: PropType,
    viewerRed: PropType,
    viewerCatDog: boolean
  ): ResolvedPresentation;
}
```

Logic:

```
if viewingContext == "creator-expression" AND sequence.creatorIntent exists:
  return creatorIntent values, source = "creator-intent"
else:
  return viewer settings, effortTimeline from creatorIntent (or null), source = "viewer-settings"
```

No more three-tier cascade. No `creatorFavoriteProp` (that parameter was never populated anyway). Two clear paths.

**Effort in notation mode:** Even in notation mode, effort is still applied from `creatorIntent.effortTimeline` if present. Effort is choreographic — it's part of the score, not the presentation. The only thing notation mode changes is prop type.

**Effort data flow:** `ResolvedPresentation.effortTimeline` is NOT consumed by `StepDeriver` (steps don't carry effort — effort is a timeline overlay on animation). It's consumed by `SequenceAnimationOrchestrator`, which already reads `sequence.effortTimeline`. After migration, the orchestrator reads effort from the resolved presentation instead of directly from the sequence. This keeps `StepDeriver` and `ViewerPreferences` free of effort concerns.

**Known limitation:** Legacy sequences with no `creatorIntent` that are opened via a `?intent=creator` shared link will silently fall back to the viewer's own prop settings. The `PropContextChip` will not appear because there's no creator intent to compare against. This is acceptable for legacy data — there's no intent to show.

#### The Contextual Chip

In the sequence detail viewer, when `creatorIntent.propConfig` exists and differs from the viewer's current display:

**Creator-expression mode:**
> "Flowybara saved this with fans. Displaying as fans. [Show with my staves]"

**Notation mode (creator saved with different props):**
> "You're viewing with staves. Flowybara saved this with fans. [Show as intended]"

**Same props, or no creatorIntent:**
No chip shown.

**Switch behavior:**
- Tapping "Show with my staves" / "Show as intended" toggles between the two modes
- The toggle is ephemeral — local component state only
- Does not change global settings, does not persist, resets when leaving the detail view
- The chip text updates to reflect the new state after switching

**Implementation:** The chip is a small Svelte component in the sequence detail viewer. It reads:
- `sequence.creatorIntent?.propConfig` (what the creator chose)
- `sequence.ownerDisplayName` (for the "Flowybara saved this..." text)
- Current resolved presentation (which mode we're in)
- Viewer's prop settings (for comparison)

It renders nothing when there's no difference to communicate.

### 3. Strip propType from MotionData

`MotionData` currently stores `propType`, `color`, and `isVisible`. These are viewer/rendering concerns:

- `propType` is "ALWAYS overridden by global settings during render" (existing code comment)
- `color` is assigned when combining solo props into a sequence (blue = left hand, red = right hand)
- `isVisible` is a rendering toggle

**Two types, not one.** `MotionData` is used in two contexts: as persisted domain data (what happened) and as the runtime type consumed by renderers (what to draw). Stripping fields from a single type would break 170+ consumer files that read `.propType` or `.color`. Instead, we split:

```typescript
// The persisted/domain form — no viewer concerns
interface MotionData {
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly turns: number | "fl";
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly handPath?: HandPath | null;
  readonly skewSteps?: number | null;
  readonly skewDir?: SkewDirection | null;
  readonly prefloatMotionType?: MotionType | null;
  readonly prefloatRotationDirection?: RotationDirection | null;

  // KEEP — needed for position calculations
  readonly gridMode: GridMode;

  // KEEP — rendering artifacts derived from domain data, expensive to recompute
  readonly arrowPlacementData: ArrowPlacementData;
  readonly propPlacementData: PropPlacementData;
  readonly arrowLocation: GridLocation;
}

// The runtime/rendered form — extends MotionData with viewer concerns
interface DerivedMotionData extends MotionData {
  readonly propType: PropType;
  readonly color: MotionColor;
  readonly isVisible: boolean;
}
```

**How the types flow:**

| Context | Type used | propType/color/isVisible |
|---|---|---|
| Firestore persistence | `MotionData` | Not stored |
| `SoloPropStepData` | Subset of `MotionData` + duration | Not present |
| `StepData.motions` (runtime) | `DerivedMotionData` | Injected by `StepDeriver` |
| Rendering pipeline | `DerivedMotionData` | Present, used for rendering |

**`StepDeriver.deriveSteps()`** takes `MotionData` from solo props, injects `propType`, `color`, and `isVisible` from the resolved presentation, and returns `StepData` with `DerivedMotionData` in its motions. All 170+ consumers that read `.propType` or `.color` on motions continue to work unchanged — they receive `DerivedMotionData` through the existing `StepData` interface.

**`PictographData.motions` type change:** The motions field type becomes `Partial<Record<MotionColor, DerivedMotionData | undefined>>` on runtime types (`StepData`, `PreparedPictographData`) and `Partial<Record<MotionColor, MotionData | undefined>>` on persisted types. In practice, `PictographData` keeps using `DerivedMotionData` since it's always consumed at render time.

**SoloPropStepData:** Already clean — no `propType`, `color`, or `isVisible`. No changes needed.

**Migration:** When reading old Firestore documents that have `propType`/`color`/`isVisible` in their motion data, the deserializer silently drops them. `createMotionData()` factory stops setting defaults for the removed fields.

**Consumer migration (Phase 2):** All files that access `.propType`, `.color`, or `.isVisible` on motion objects need their type annotations updated from `MotionData` to `DerivedMotionData`. This is a mechanical find-and-replace. Known consumers include:
- `SequenceEncoder.ts` / `SequenceDecoder.ts` (URL encoding)
- `PictographPreparer.ts` (render preparation)
- `ArrowPositioningOrchestrator.ts` (arrow placement)
- `TurnColorInterpreter.ts` (color logic)
- `DataTransformer.ts` / `arrow-factories.ts` (visibility checks)
- All pictograph rendering components

A full list can be obtained by grepping for `.propType`, `.color`, `.isVisible` on motion-typed variables.

### 4. Compositional Finalization

#### Stop Persisting steps

**Clarification vs. three-tier spec:** The three-tier spec (March 12) marks `steps` as "REMOVED" from `SequenceData`. This is inaccurate — `steps` remains on the TypeScript interface as a **derived field** populated at read time. It is removed from Firestore persistence only. The three-tier spec should be amended to say "DERIVED (not persisted)" rather than "REMOVED." All 222 files (814 references) that read `.steps` continue to work unchanged.

New Firestore writes no longer include `steps` or `startPosition`/`startingPosition`. The save path:

1. User saves sequence
2. `LibraryRepository.saveSequence()` calls `sequenceHydrator.ensureComposition()`
3. Decomposer extracts `blueSoloProp`, `redSoloProp`, `stepPairings`
4. **New:** Serializer omits `steps`, `startPosition`, `startingPosition` from the Firestore document
5. Compositional fields + hashes + metadata are written

On read:

1. Load document from Firestore
2. If `blueSoloProp` exists → derive `steps` via `StepDeriver`
3. If no `blueSoloProp` (legacy) → use raw `steps` from document
4. Either way, consumers get the same `SequenceData` interface with `.steps` populated

#### Backfill Existing Documents

Run `scripts/migrate-compositional.ts --commit` to ensure all existing documents have compositional fields. After backfill:
- All documents have `blueSoloProp`, `redSoloProp`, `stepPairings`
- The "if no blueSoloProp, use raw steps" fallback only triggers for truly ancient data

#### SoloPropStepData Alignment

Once `propType`, `color`, `isVisible` are removed from `MotionData`, the remaining fields are:

**MotionData:** motionType, rotationDirection, startLocation, endLocation, turns, startOrientation, endOrientation, handPath, skewSteps, skewDir, prefloatMotionType, prefloatRotationDirection, gridMode, arrowPlacementData, propPlacementData, arrowLocation

**SoloPropStepData:** motionType, rotationDirection, startLocation, endLocation, turns, startOrientation, endOrientation, handPath, skewSteps, skewDir, duration

The difference: SoloPropStepData has `duration` but no placement data (`arrowPlacementData`, `propPlacementData`, `arrowLocation`, `gridMode`, `prefloat*`).

This is correct. SoloPropStepData is the stored form (pure domain). MotionData is the rendered form (domain + placement). The decomposer strips placement, the deriver restores it. No type merge needed — the separation is the feature.

---

## PublicSequenceIndex

`PublicSequenceIndex` needs `creatorIntent` added to its schema so the browse gallery and public profiles can resolve props correctly.

```typescript
interface PublicSequenceIndex {
  // ... existing fields ...

  // NEW
  readonly creatorIntent?: CreatorIntent | null;

  // REMOVED
  // readonly intendedProp is not currently in PublicSequenceIndex
  // (it was never added — this is a gap being filled)
}
```

The `PublicIndexSyncer` includes `creatorIntent` when syncing to the `publicSequences` collection.

---

## QR Code / Shared Link Integration

When generating a QR code or share link from the sequence viewer:

1. Encode the current viewing context into the URL
2. If viewing in creator-expression mode: `?intent=creator`
3. If viewing in notation mode with viewer's props: `?intent=notation` (or omit — default)

When the recipient opens the link:
- `?intent=creator` → `ViewingContext = "creator-expression"` → shows creator's intended props
- No intent param → `ViewingContext = "notation"` → shows recipient's own props

The sequence's `creatorIntent` is already stored in Firestore. The URL just carries the viewing mode, not the actual prop data.

---

## File Changes Summary

### New Files

| File | Purpose |
|---|---|
| `src/lib/shared/foundation/domain/models/CreatorIntent.ts` | `CreatorIntent` interface |
| `src/lib/shared/sequence-viewer/services/implementations/PresentationResolver.ts` | Replaces `IntendedPropResolver` |
| `src/lib/shared/sequence-viewer/services/contracts/IPresentationResolver.ts` | Contract |
| `src/lib/shared/sequence-viewer/components/PropContextChip.svelte` | The contextual chip |

### Modified Files

| File | Change |
|---|---|
| `SequenceData.ts` | Add `creatorIntent`, deprecate `intendedProp` and top-level `effortTimeline` |
| `MotionData.ts` | Remove `propType`, `color`, `isVisible` |
| `createMotionData()` | Remove defaults for removed fields |
| `SequenceDecomposer.ts` | No change needed (already strips these fields) |
| `StepDeriver.ts` | Inject `propType`, `color`, `isVisible` from resolved presentation |
| `SequenceDetailContent.svelte` | Use `PresentationResolver` + add `PropContextChip` |
| `BrowseGrid.svelte` | Pass `ViewingContext` to thumbnails (stays `"notation"`) |
| `PublicSequenceIndex.ts` | Add `creatorIntent` |
| `PublicIndexSyncer.ts` | Include `creatorIntent` in sync |
| `LibraryRepository.ts` | Populate `creatorIntent` at save time, stop writing `steps` |
| `SequenceRepository.ts` | Read-time migration for `intendedProp` → `creatorIntent` |
| `PhraseEffortLabModule.svelte` | Write to `creatorIntent.effortTimeline` instead of top-level |
| `SequenceAnimationOrchestrator.ts` | Read effort from resolved presentation |
| `IntendedPropResolver.ts` | Deprecated, replaced by `PresentationResolver` |
| `community-container.ts` | Register `PresentationResolver`, remove `IntendedPropResolver` |

### Deleted Files

| File | Reason |
|---|---|
| `IntendedPropResolver.ts` | Replaced by `PresentationResolver` |
| `IIntendedPropResolver.ts` | Replaced by `IPresentationResolver` |

---

## Migration Path

### Phase 1: CreatorIntent + PresentationResolver

1. Define `CreatorIntent` type
2. Add `creatorIntent` to `SequenceData` (alongside existing `intendedProp` and `effortTimeline`)
3. Build `PresentationResolver`
4. Add read-time migration: if `intendedProp` exists but `creatorIntent` doesn't, construct it. If top-level `effortTimeline` exists, fold it into `creatorIntent.effortTimeline`.
5. Wire `PresentationResolver` into `SequenceDetailContent`
6. Add `PropContextChip` component
7. Update `LibraryRepository` save path to populate `creatorIntent`
8. Update `PhraseEffortLabModule.svelte` to write `creatorIntent.effortTimeline` instead of top-level `effortTimeline` (must happen now, not Phase 3 — otherwise the lab writes to a field that `PresentationResolver` doesn't read for newly saved sequences)
9. Update `SequenceAnimationOrchestrator` to read effort from resolved presentation

### Phase 2: MotionData Type Split + Stop Persisting Steps

1. Create `DerivedMotionData extends MotionData` with `propType`, `color`, `isVisible`
2. Remove `propType`, `color`, `isVisible` from base `MotionData` interface and factory
3. Update `StepDeriver` to produce `DerivedMotionData` by injecting viewer concerns
4. Update consumer type annotations: files reading `.propType`/`.color`/`.isVisible` on motions change from `MotionData` to `DerivedMotionData` (mechanical find-and-replace)
5. Stop persisting `steps` in new Firestore writes
6. Run backfill migration script
7. Update `IntendedPropResolver.test.ts` → `PresentationResolver.test.ts`

### Phase 3: Cleanup

1. Remove deprecated `intendedProp` field from `SequenceData` (after sufficient migration time)
2. Remove top-level `effortTimeline` field from `SequenceData`
3. Remove `IntendedPropResolver` and its contract
4. Update QR code generation to include `?intent=creator` when sharing from creator-expression mode

---

## Out of Scope

- Visual representation of effort in pictographs (hard problem, future work)
- Creator profile page implementation (depends on social features)
- Effort resolution chip (effort is always from creator intent, no switching needed)
- Effects system (purely viewer-side, no creator intent needed)
