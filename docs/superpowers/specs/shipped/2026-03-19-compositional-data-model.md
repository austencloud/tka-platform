---
status: shipped
value: 3
effort: M
remaining: "Phases 1-3 and 5 shipped (artifact-extractor.ts, solo prop save from Assemble, browse taxonomy toggle, hand path builder save). Only Phase 4 CompositionBreakdown detail view was never built (no src match as of 2026-07-28)."
depends_on: ""
plan_path: plans/backlog/2026-03-19-compositional-data-model.md
tags: []
last_triaged: 2026-07-28
---
# Compositional Data Model: Browsing, Saving, and Progressive Disclosure

**Date:** 2026-03-19
**Status:** Draft
**Feedback:** WXkxNzJZiDnc4jAUDA97
**Depends on:** `2026-03-12-three-tier-sequence-model-design.md` (foundation types and decomposition)

## Problem

The three-tier data model (HandPathData, SoloPropData, SequenceData) exists at the persistence layer, but the app still treats sequences as the only first-class artifact. You can't browse hand paths, save a solo prop build, or toggle between "what are the hands doing?" and "what are the props doing?" in the gallery. The compositional structure is invisible to users.

## Solution Overview

Thread the three-tier model through browsing, saving, and discovery by introducing:

1. A 2x2 browsing taxonomy: two toggles that control what you see in the gallery
2. Decomposition on save: every saved sequence automatically produces hand path and solo prop artifacts
3. An "original" flag for standalone hand paths created directly (not extracted from sequences)
4. Progressive disclosure: new users see full sequences, power users discover compositional tools

---

## The 2x2 Browsing Taxonomy

Two independent dimensions, two values each. Four cells.

### Dimension 1: Subject ("What am I looking at?")

| Value | Label | What renders |
|-------|-------|-------------|
| `props` | Sequence mode | Pictographs showing both props with orientation, motion type, turns. The current default view. |
| `hands` | Hand mode | Simplified pictographs showing hand positions only (dots at grid locations, float/dash arrows between them). No prop rendering, no orientation. |

### Dimension 2: Granularity ("How many?")

| Value | Label | What renders |
|-------|-------|-------------|
| `combined` | Both | Two hands/props shown together. The current default. |
| `solo` | One | A single hand or single prop shown in isolation. |

### The Matrix

| | Combined (both) | Solo (one) |
|---|---|---|
| **Sequence mode (props)** | Full sequence (today's view) | Solo prop path: one prop with motion, orientation, turns |
| **Hand mode (hands)** | Paired hand path: two dots moving through grid locations | Solo hand path: one dot's trajectory through the grid |

### Default Landing

`subject: "props"` + `granularity: "combined"` -- identical to what exists today. Users who never touch the toggles see zero change.

### UI Representation

Two toggle controls, likely chip toggles or segmented controls:

```
[Props | Hands]    [Both | One]
```

When `granularity` is `solo`, a third control appears to select which hand/prop:

```
[Props | Hands]    [Both | One]    [Blue | Red]
```

The `color` selector defaults to `blue` and only appears when `granularity === "solo"`.

### State Shape

```typescript
interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  color: "blue" | "red"; // only meaningful when granularity === "solo"
}
```

This state belongs in the browse module's reactive state, persisted to user preferences so it survives navigation.

---

## How Existing Data Supports This

The three-tier model is already persisted. Every sequence document contains:

```typescript
// Already on SequenceData (from the three-tier migration)
readonly blueSoloProp?: SoloPropData;   // contains .handPath: HandPathData
readonly redSoloProp?: SoloPropData;
readonly stepPairings?: readonly StepPairingData[];

// Content hashes for equivalence queries
readonly bluePathHash?: string;  // hash of blue hand path
readonly redPathHash?: string;
readonly blueSoloHash?: string;  // hash of blue solo prop
readonly redSoloHash?: string;
```

Each SoloPropData contains its HandPathData:

```typescript
interface SoloPropData {
  readonly handPath: HandPathData;  // tier 1 embedded in tier 2
  readonly steps: readonly SoloPropStepData[];
  // ... content hash, derived fields, metadata
}
```

This means every saved sequence already contains the data needed for all four browsing cells. No additional decomposition at query time.

---

## Decomposition: Sequences Automatically Produce Sub-Artifacts

### On Save

When a user saves a sequence to their library, the existing `SequenceHydrator.ensureComposition()` already populates `blueSoloProp`, `redSoloProp`, and `stepPairings` with content hashes. This happens at the `LibrarySaveService.saveSequence()` boundary.

What changes: the save flow also writes the decomposed artifacts to their own Firestore collections:

1. **Hand paths** written to `users/{uid}/handPaths/{contentHash}`
2. **Solo props** written to `users/{uid}/soloProps/{contentHash}`

These are deduplicated by content hash. If two sequences share the same blue hand path, only one hand path document exists. The sequence document's `bluePathHash` and `blueSoloHash` fields serve as foreign keys.

### On Publish

When a sequence becomes public, `PublicIndexSyncer` already copies compositional fields to the `publicSequences` document. What changes: it also writes to `publicHandPaths/{contentHash}` and `publicSoloProps/{contentHash}`, enabling the public browse gallery to show all four cells.

### Deduplication

Content hashes are the identity. Two solo props with identical motion content produce the same hash regardless of which sequence they came from. The repository uses `contentHash` as the document ID, making writes idempotent.

```
users/{uid}/handPaths/{contentHash}
users/{uid}/soloProps/{contentHash}
publicHandPaths/{contentHash}
publicSoloProps/{contentHash}
```

### Provenance Tracking

Each hand path and solo prop document tracks where it came from:

```typescript
interface ArtifactProvenance {
  // Which sequences contain this artifact?
  readonly sourceSequenceIds: readonly string[];
  // Was this created directly (not extracted from a sequence)?
  readonly isOriginal: boolean;
  // When first seen (earliest source sequence's birthday)
  readonly firstSeenAt: Date;
}
```

This is stored alongside the artifact data:

```typescript
// Firestore document at users/{uid}/handPaths/{contentHash}
{
  ...HandPathData,
  provenance: ArtifactProvenance,
}

// Firestore document at users/{uid}/soloProps/{contentHash}
{
  ...SoloPropData,
  provenance: ArtifactProvenance,
}
```

#### `sourceSequenceIds` Updates Use `arrayUnion`

Since artifact extraction is fire-and-forget, multiple sequences may write to the same artifact document concurrently. A naive read-modify-write on `sourceSequenceIds` creates race conditions (two concurrent saves read the same array, each appends their ID, last write wins and drops the other).

Instead, all `sourceSequenceIds` updates use Firestore's `arrayUnion` operation:

```typescript
await updateDoc(artifactRef, {
  "provenance.sourceSequenceIds": arrayUnion(sequenceId),
});
```

`arrayUnion` is atomic and idempotent: it adds the ID only if absent, handles concurrent writes without races, and re-running the same extraction is a no-op. This makes the fire-and-forget pattern safe for provenance tracking.

---

## The "Original" Flag

### Problem

Most hand paths and solo props are decomposed from saved sequences. But users should also be able to create standalone hand paths directly (e.g., in a hand-path-focused builder). These user-created artifacts need a way to distinguish themselves from auto-extracted ones.

### Solution

The `isOriginal` field on `ArtifactProvenance`:

- `isOriginal: true` -- user explicitly created this artifact (no parent sequence)
- `isOriginal: false` -- auto-extracted during sequence save (has parent sequences)

An artifact starts as original and stays original. If a user creates a hand path, then later a sequence happens to produce the same hand path (same content hash), the document is not overwritten. The `sourceSequenceIds` array gains a new entry, but `isOriginal` remains `true`.

Conversely, if a hand path was auto-extracted (`isOriginal: false`) and the user later "promotes" it (gives it a name, tags it, saves it explicitly), `isOriginal` flips to `true`.

### Promotion Workflow

"Promote" means the user sees a decomposed artifact and says "I want this to be a first-class thing in my library." Promotion:

1. Sets `isOriginal: true`
2. Allows the user to add name, notes, tags
3. Makes the artifact appear in "My Hand Paths" / "My Solo Props" sections

Before promotion, auto-extracted artifacts are queryable but don't clutter the user's explicit library.

---

## Browse Gallery Integration

### Current Architecture

The browse gallery is powered by:

- `OptimizedBrowser` -- loads paginated sequences from Firestore
- `BrowseFilter` / `MultiFilter` -- filters by level, letter, position, favorites
- `BrowseSorter` -- sorts by alpha, date, difficulty, length
- `BrowseSectionManager` -- groups sequences into sections
- `VariationGrouper` -- groups equivalent sequences
- `BrowseCache` -- caches loaded data

### What Changes

#### New: `BrowseDataSource` Interface

The browse gallery currently always queries `publicSequences` or `users/{uid}/sequences`. The 2x2 taxonomy requires querying different collections depending on the active view mode.

```typescript
interface IBrowseDataSource {
  load(
    viewMode: BrowseViewMode,
    filters: BrowseFilters,
    pagination: PaginationParams
  ): Promise<BrowseResult>;
}

type BrowseResult =
  | { kind: "sequences"; items: SequenceData[] }
  | { kind: "soloProps"; items: SoloPropData[] }
  | { kind: "handPaths"; items: HandPathData[] };
```

The data source selects the Firestore collection based on `viewMode`:

| subject | granularity | Collection queried | Item type |
|---------|------------|-------------------|-----------|
| props | combined | `publicSequences` / `users/{uid}/sequences` | SequenceData |
| props | solo | `publicSoloProps` / `users/{uid}/soloProps` | SoloPropData |
| hands | combined | `publicSequences` / `users/{uid}/sequences` | SequenceData (rendered differently) |
| hands | solo | `publicHandPaths` / `users/{uid}/handPaths` | HandPathData |

Note: "hands + combined" queries the same collection as "props + combined" because paired hand paths are just a rendering mode of the same sequence data. The difference is how the choreo card renders them (hand dots vs. prop pictographs).

#### Existing Filters: Behavior Per Mode

| Filter | props+combined | props+solo | hands+combined | hands+solo |
|--------|---------------|------------|---------------|------------|
| Level | Works (sequence level) | Works (derived from motion complexity) | Works (same as sequence) | Hidden (hand paths don't have levels) |
| Letter | Works (sequence word) | Hidden (solo props have no letters) | Works (same as sequence) | Hidden |
| Position | Works (start/end position) | Works (start/end location) | Works | Works |
| Length | Works (beat count) | Works (step count) | Works | Works |
| Favorites | Works | Works (per-artifact favorites) | Works | Works |
| Grid mode | Works | Works (impliedGridMode) | Works | Works (impliedGridMode) |

Filters that don't apply to the current view mode are hidden, not disabled.

#### Existing Sort: Behavior Per Mode

All sort methods work on all tiers. The `BrowseSorter` interface doesn't change -- it receives a `sortKey` and array of items. The items all have `name`, `dateCreated`/`birthday`, `length`, and `contentHash`.

#### Thumbnail Rendering Per Mode

The `ChoreoCard` and `ChoreoCardThumbnail` components need to render four different views:

| Mode | Rendering |
|------|-----------|
| props + combined | Today's pictograph grid (no change) |
| props + solo | Single-prop pictograph: one colored prop on the grid, the other hand absent |
| hands + combined | Paired hand dots: two colored dots (blue/red) at grid locations, lines between consecutive positions |
| hands + solo | Single hand path: one colored dot tracing grid locations, with directional arrows |

These are rendering modes of the same `PreviewCellRenderer`, not separate components. The renderer receives the view mode and adjusts:

```typescript
interface PreviewCellRenderOptions {
  // existing fields...
  viewMode?: BrowseViewMode;
}
```

When `viewMode.subject === "hands"`, the renderer draws hand dots instead of props. When `viewMode.granularity === "solo"`, only one color is drawn.

---

## Save Flow Changes

### Current Save Flow

1. User builds sequence in Create module
2. Clicks Save -> `LibrarySaveService.saveSequence()` is called
3. Thumbnail generated, uploaded
4. Sequence written to Dexie (optimistic) then Firestore
5. `PublicIndexSyncer` writes to `publicSequences` if public

### New Save Flows

#### Saving a Full Sequence (enhanced existing flow)

Same as today, plus:

6. Extract `blueSoloProp` and `redSoloProp` (already computed by `ensureComposition`)
7. Write each solo prop to `users/{uid}/soloProps/{contentHash}` (deduplicated)
8. Extract hand paths from each solo prop
9. Write each hand path to `users/{uid}/handPaths/{contentHash}` (deduplicated)
10. If public, also write to `publicSoloProps` and `publicHandPaths`

Steps 6-10 are fire-and-forget (non-blocking), same pattern as the existing Firestore sync. The sequence is already safe in Dexie.

#### Saving a Solo Prop (new flow)

When the Assemble Lab produces a single-hand build:

1. The assemble state already tracks per-hand steps (`blueSteps`, `redSteps`)
2. A "Save as Solo Prop" action becomes available when one hand has steps and the other doesn't (or the user explicitly chooses to save one hand)
3. `SoloPropSaveOrchestrator` orchestrates:
   - Convert `BuilderStep[]` to `SoloPropStepData[]`
   - Build `SoloPropData` via `SoloPropFactory`
   - Generate solo prop thumbnail (single-prop pictograph)
   - Write to `users/{uid}/soloProps/{contentHash}`
   - Extract and write hand path to `users/{uid}/handPaths/{contentHash}`
4. The artifact is marked `isOriginal: true` (user created it directly)

#### Saving a Hand Path (new flow)

When a future hand-path builder (or the Fuse tab) produces a hand path:

1. `HandPathSaveOrchestrator` receives a `GridLocation[]` array
2. Builds `HandPathData` via `HandPathFactory`
3. Generates hand path thumbnail (dot trajectory on grid)
4. Writes to `users/{uid}/handPaths/{contentHash}`
5. Marked `isOriginal: true`

### Save Panel UI Changes

The existing save panel (`SaveToLibraryPanel`) accepts name, visibility, tags, notes. These fields apply equally to all three tiers. No structural changes needed -- the save panel works for sequences, solo props, and hand paths.

What changes: the panel title adapts:

- "Save Sequence" (existing)
- "Save Solo Prop" (new)
- "Save Hand Path" (new)

---

## Schema Changes Summary

### New Firestore Collections

```
users/{uid}/handPaths/{contentHash}     -- user's hand path library
users/{uid}/soloProps/{contentHash}      -- user's solo prop library
publicHandPaths/{contentHash}            -- public hand path feed
publicSoloProps/{contentHash}            -- public solo prop feed
```

### New Fields on Existing Types

#### ArtifactProvenance (new type)

```typescript
interface ArtifactProvenance {
  readonly sourceSequenceIds: readonly string[];
  readonly isOriginal: boolean;
  readonly firstSeenAt: Date;
}
```

Added to `HandPathData` and `SoloPropData` documents when persisted (not on the in-memory types, which remain pure data).

#### BrowseViewMode (new type)

```typescript
interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  color: "blue" | "red";
}
```

#### No changes to existing types

`SequenceData`, `SoloPropData`, `HandPathData`, `StepPairingData`, `LibrarySequence`, and `PublicSequenceIndex` are unchanged. The compositional fields they already carry are sufficient.

### Firestore Indexes

New composite indexes needed for the new collections:

```
publicHandPaths: (impliedGridMode, length) -- for filtered browse
publicHandPaths: (startLocation, endLocation) -- for position queries
publicSoloProps: (impliedGridMode, length) -- same
publicSoloProps: (startLocation, length) -- same
```

### Firestore Security Rules

Same ownership pattern as sequences:

```
users/{uid}/handPaths/{pathId}: read/write if auth.uid == uid
users/{uid}/soloProps/{propId}: read/write if auth.uid == uid
publicHandPaths/{pathId}: read if authenticated, write via cloud function or if ownerId matches
publicSoloProps/{propId}: same
```

---

## Progressive Disclosure Strategy

### Level 1: Default Experience (zero configuration)

New users land on `props + combined`. The gallery looks identical to today. They see full sequences. They build sequences in Create. They save sequences. Everything works as before.

The 2x2 toggles are visible but unobtrusive (small chip row above the gallery grid). The default position requires no interaction.

### Level 2: Discovery Through Building

When a user builds in the Assemble Lab and finishes one hand before the other, a subtle prompt appears:

> "Save this hand's path on its own?"

If they tap "yes," they've created their first solo prop. The browse gallery now has content in the `props + solo` cell. The toggle becomes meaningful.

### Level 3: Discovery Through Browsing

When viewing a sequence in the gallery, the detail view includes a "Composition" section showing:

- Blue hand path (tappable -> shows the hand path in isolation)
- Red hand path (tappable)
- Blue solo prop (tappable -> shows the solo prop in isolation)
- Red solo prop (tappable)

Tapping any of these switches the browse view to the appropriate cell and filters to that artifact. This is the "zoom in" gesture.

### Level 4: Power User Workflow

Power users who understand the compositional model can:

1. Browse hand paths in `hands + solo` mode to find interesting trajectories
2. Browse solo props in `props + solo` mode to find motions with the right feel
3. Combine two solo props in the Fuse tab to create new sequences
4. Save the result

This is the full compositional workflow, but nobody needs to reach this level to use the app effectively.

### What We Don't Do

- No onboarding modal explaining the 2x2 matrix
- No forced walkthrough of compositional concepts
- No "hand mode" as a separate module (it's a toggle in the existing browse)
- No requirement to understand composition before saving sequences

---

## Services and Components That Need Modification

### New Services

| Service | File | Responsibility |
|---------|------|----------------|
| `IBrowseDataSource` | `services/contracts/IBrowseDataSource.ts` | Selects Firestore collection based on view mode |
| `BrowseDataSource` | `services/implementations/BrowseDataSource.ts` | Implements collection routing |
| `ISoloPropSaveOrchestrator` | `services/contracts/ISoloPropSaveOrchestrator.ts` | Save solo prop to library |
| `SoloPropSaveOrchestrator` | `services/implementations/SoloPropSaveOrchestrator.ts` | Orchestrates solo prop save flow |
| `IHandPathSaveOrchestrator` | `services/contracts/IHandPathSaveOrchestrator.ts` | Save hand path to library |
| `HandPathSaveOrchestrator` | `services/implementations/HandPathSaveOrchestrator.ts` | Orchestrates hand path save flow |
| `IArtifactExtractor` | `services/contracts/IArtifactExtractor.ts` | Writes decomposed artifacts during sequence save |
| `ArtifactExtractor` | `services/implementations/ArtifactExtractor.ts` | Fire-and-forget side-channel writes |

### Existing Services (already implemented)

| Service | File | Status |
|---------|------|--------|
| `HandPathRepository` | `src/lib/shared/foundation/services/implementations/HandPathRepository.ts` | Already exists. Handles Firestore reads/writes for hand path documents. |
| `SoloPropRepository` | `src/lib/shared/foundation/services/implementations/SoloPropRepository.ts` | Already exists. Handles Firestore reads/writes for solo prop documents. |

The new orchestrators (`SoloPropSaveOrchestrator`, `HandPathSaveOrchestrator`) and `ArtifactExtractor` delegate persistence to these existing repositories.

### Modified Services

| Service | Change |
|---------|--------|
| `LibrarySaveService` | After saving sequence, calls `ArtifactExtractor` to write decomposed hand paths and solo props |
| `PublicIndexSyncer` | After syncing public sequence, also writes to `publicHandPaths` and `publicSoloProps` |
| `OptimizedBrowser` | Accepts `BrowseViewMode`, delegates to `BrowseDataSource` |
| `BrowseFilter` / `MultiFilter` | Hides inapplicable filters based on current view mode |
| `PreviewCellRenderer` | Accepts `viewMode` in render options, renders hand dots or solo props accordingly |
| `BuilderStepConverter` | Gains a `toSoloPropStepData()` method for Assemble Lab -> SoloPropData conversion |

### Modified Components

| Component | Change |
|-----------|--------|
| `BrowseLayout.svelte` | Adds view mode toggle chips above gallery grid |
| `ChoreoCard.svelte` (sequence-viewer) | Renders differently based on `viewMode` prop |
| `ChoreoCardThumbnail` | Same -- adapts rendering to view mode |
| `AssembleLabModule.svelte` | "Save as Solo Prop" action when one hand is complete |
| `BuilderControls.svelte` | Shows solo save option alongside existing finish/reset |
| `SequenceViewerActions.svelte` | Adds "View Composition" section in detail view |
| `FilterChipRow.svelte` | Hides chips that don't apply to current view mode |

### New Components

| Component | Purpose |
|-----------|---------|
| `ViewModeToggle.svelte` | The two toggle controls (subject + granularity) |
| `ColorSelector.svelte` | Blue/Red selector that appears in solo mode |
| `CompositionBreakdown.svelte` | Shows hand paths and solo props for a sequence in detail view |
| `HandPathPreview.svelte` | Renders a hand path as dots + trajectory lines on a grid |
| `SoloPropPreview.svelte` | Renders a single prop's motion on a grid |

---

## Data Flow Diagram

```
User saves sequence
  │
  ├─ LibrarySaveService.saveSequence()
  │   ├─ SequenceHydrator.ensureComposition()  [already exists]
  │   │   └─ Populates blueSoloProp, redSoloProp, stepPairings, hashes
  │   ├─ Write to users/{uid}/sequences/{id}   [already exists]
  │   └─ ArtifactExtractor.extract()           [NEW, fire-and-forget]
  │       ├─ Write blueSoloProp to users/{uid}/soloProps/{blueSoloHash}
  │       ├─ Write redSoloProp to users/{uid}/soloProps/{redSoloHash}
  │       ├─ Write blue handPath to users/{uid}/handPaths/{bluePathHash}
  │       └─ Write red handPath to users/{uid}/handPaths/{redPathHash}
  │
  └─ PublicIndexSyncer (if public)
      ├─ Write to publicSequences/{id}          [already exists]
      ├─ Write to publicSoloProps/{blueSoloHash} [NEW]
      ├─ Write to publicSoloProps/{redSoloHash}  [NEW]
      ├─ Write to publicHandPaths/{bluePathHash} [NEW]
      └─ Write to publicHandPaths/{redPathHash}  [NEW]
```

```
User browses gallery
  │
  ├─ BrowseViewMode = { subject, granularity, color }
  │
  └─ BrowseDataSource.load(viewMode, filters, pagination)
      │
      ├─ props + combined → query publicSequences (existing)
      ├─ props + solo     → query publicSoloProps (new)
      ├─ hands + combined → query publicSequences (render as hand paths)
      └─ hands + solo     → query publicHandPaths (new)
```

---

## Migration Path

### Phase 1: Save-Side Extraction

Add `ArtifactExtractor` to the save flow. Every new save writes decomposed artifacts. Run a backfill script over existing sequences to populate hand path and solo prop collections. This is non-breaking; the browse gallery doesn't use these collections yet.

### Phase 2: Browse Toggle

Add `ViewModeToggle` to the browse layout. Implement `BrowseDataSource` routing. The `hands + combined` cell works immediately (same data, different rendering). The `props + solo` and `hands + solo` cells work once Phase 1 has populated the collections.

### Phase 3: Solo Prop Save

Add "Save as Solo Prop" to the Assemble Lab. This gives users a way to create original solo props. The browse gallery now has user-created content in the solo cells.

### Phase 4: Detail View Composition

Add `CompositionBreakdown` to the sequence detail view. Users can tap individual hand paths and solo props to navigate to the appropriate browse cell.

### Phase 5: Standalone Hand Path Creation

A hand path builder already exists at `src/lib/features/hand-path-builder/` with state factory (`builder-state.svelte.ts`), context (`builder-context.ts`), components (`BuilderControls.svelte`, `PathPreview.svelte`, `GridModeSelector.svelte`), and services (`HandPropStateFactory`, `HandPathAnimator`). Phase 5 integrates this existing builder with the save flow (`HandPathSaveOrchestrator`) and connects it to the browse gallery so user-created hand paths appear in the `hands + solo` cell.

The Fuse tab (specced separately) enables composing hand paths into sequences. Together with the existing builder, this completes the loop: users can create at any tier, browse at any tier, and compose across tiers.

---

## SequenceFuser: Combining Two Hand Paths into a Sequence

The Fuse tab (specced separately for UX) needs a data transformation service that merges two independent hand paths or solo props into a combined `SequenceData`. This service fell between the cracks of the Fuse UX spec and this data model spec, so it's defined here.

### Interface

```typescript
interface ISequenceFuser {
  fuse(
    blue: HandPathData | SoloPropData,
    red: HandPathData | SoloPropData,
    options?: FuseOptions
  ): SequenceData;
}

interface FuseOptions {
  // Which beat to align on (default: 0, meaning both start together)
  readonly alignmentOffset?: number;
}
```

### Length Mismatch Handling (LCM)

When two paths have different lengths, the fuser computes the least common multiple of both lengths and tiles each path to fill the LCM duration. A 3-beat blue path and a 4-beat red path produce a 12-beat fused sequence.

```
blue: [B1, B2, B3] (length 3)
red:  [R1, R2, R3, R4] (length 4)
LCM = 12

fused blue: [B1, B2, B3, B1, B2, B3, B1, B2, B3, B1, B2, B3]
fused red:  [R1, R2, R3, R4, R1, R2, R3, R4, R1, R2, R3, R4]
```

If the LCM exceeds a reasonable limit (e.g., 64 beats), the fuser truncates to the shorter path's length and reports a warning rather than producing an unwieldy sequence.

### Input Normalization

- If both inputs are `SoloPropData`, use their embedded `handPath` for pairing computation and keep the prop-level data (orientation, turns) intact.
- If both inputs are `HandPathData`, the fuser produces a sequence with hand paths only. Prop-level fields (`orientation`, `turns`, `motionType`) are left undefined, to be filled by the user in the Assemble Lab or inferred by a future auto-orientation pass.
- Mixed inputs (`HandPathData` + `SoloPropData`) are accepted. The solo prop side keeps its prop data; the hand path side gets undefined prop fields.

### Step Pairings

The fuser generates `StepPairingData` for each beat of the result, pairing the blue and red steps. Content hashes are computed on the fused output so the result is ready for deduplication and save.

### Registration

`SequenceFuser` is registered in the DI container alongside the Fuse tab's other services. It has no side effects (pure data transformation) and no Firestore dependency.

---

## Cache Key: View Mode Injection

`CellCacheKeyDeriver` (used by `PreviewCellRenderer` and the browse cache) must include the active `BrowseViewMode` in its cache key. The same sequence data renders differently in props vs. hands mode, and as combined vs. solo. Without the view mode in the key, switching modes would serve stale cached thumbnails from the previous mode.

Cache key format: `{contentHash}:{subject}:{granularity}:{color}`

---

## Out of Scope

These are related but specced separately:

- **Fuse Tab UX** -- the creation interface for composing solo props into sequences
- **Hand Path Builder UX** -- the existing builder at `src/lib/features/hand-path-builder/` needs save flow integration (covered in Phase 5 above) but the builder UX itself is out of scope for this spec
- **Choreo Card V2 rendering** -- the visual design of hand path and solo prop cards
- **Public sharing URLs** -- short codes for sharing individual hand paths or solo props
- **Equivalence grouping** -- grouping solo props that appear in multiple sequences
