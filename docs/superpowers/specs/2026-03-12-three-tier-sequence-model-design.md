# Three-Tier Compositional Sequence Data Model

**Date:** 2026-03-12
**Status:** Approved
**Feedback:** xCuEgJ7uU6IQWPkDke23

## Problem

The TKA platform only represents full two-hand sequences. A sequence's internal structure (each hand's independent motion path) is implicit, buried inside `StepData.motions`. This means:

- The assemble tab treats one-hand builds as "incomplete work" rather than valid artifacts
- Hand paths (pure spatial trajectories) have no formal representation
- Solo prop sequences (one hand with full motion data) can't be saved, browsed, or shared
- "Find all sequences using this hand path" requires decomposing every sequence at query time
- The data model hides the fundamental truth: a sequence IS two hands paired

## Solution

Compositional data model where each tier contains the tier below it:

```
HandPathData (spatial trajectory)
  ↑ contained by
SoloPropData (one hand + motion details)
  ↑ paired into
SequenceData (two hands + letter assignments)
```

Solo props are the source of truth for per-hand motion data. The combined `StepData[]` view that renderers consume is derived, not stored.

---

## Type Definitions

### Tier 1: HandPathData

The spatial skeleton. Where does a single hand travel through space?

```typescript
// domain/models/HandPathData.ts

interface HandPathData {
  readonly id: string;
  readonly locations: readonly GridLocation[];

  // Content-addressable identity
  readonly contentHash: string;  // XXH128 of "n|e|s|w", Base62-encoded

  // Derived query fields (denormalized for Firestore)
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly length: number;
  readonly bigrams: readonly string[];          // ["n_e", "e_s", "s_w"]
  readonly uniqueLocations: readonly GridLocation[];
  readonly impliedGridMode: GridMode;           // derived: cardinals=diamond, intercardinals=box, mix=skewed, center=centric
  readonly isClosed: boolean;                   // first == last location

  // Metadata (when saved as independent artifact)
  readonly name?: string;
  readonly author?: string;
  readonly notes?: string;
  readonly thumbnails?: readonly string[];
  readonly dateCreated?: Date;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
}
```

**Grid mode derivation rules:**
- All cardinal locations (N, E, S, W) only → `DIAMOND`
- All intercardinal locations (NE, SE, SW, NW) only → `BOX`
- Mix of cardinal and intercardinal (no center) → `SKEWED`
- CENTER with cardinals only → `CENTRIC` (diamond-based centric)
- CENTER with intercardinals only → `CENTRIC` (box-based centric)
- CENTER with mixed cardinal/intercardinal → `CENTRIC` (skewed centric)
- The base grid mode (diamond/box/skewed) for centric paths can be derived by filtering out CENTER and checking the remaining locations
- These are implied, not stored as primary data. The `impliedGridMode` field is a denormalized derivation for queries.

**Canonical form for hashing:**
- Locations joined with `|`: `"n|e|s|w"`
- Uses the GridLocation enum values (lowercase short forms)
- Deterministic: same trajectory always produces the same hash

**Rendering (choreo card):**

Hand paths use the three HandMotionType families, derivable from consecutive location pairs:
- **Shift** (adjacent locations, e.g. S→W): rendered with float arrow (arc path, but no pro/anti distinction without rotation data)
- **Dash** (opposite locations, e.g. S→N): rendered with dash arrow (straight line across grid)
- **Static** (same location, e.g. S→S): no arrow

No props rendered. Neutral color (theme accent or gray). No glyph (letters require two hands).

The HandMotionType for each beat is derivable from the locations: adjacent = shift, opposite = dash, same = static. The arc direction (CW/CCW) for shifts is also derivable from the ordered pair.

### Tier 2: SoloPropData

One hand performing with a prop. Full motion data. No hand color. No letter.

```typescript
// domain/models/SoloPropStepData.ts

interface SoloPropStepData {
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly turns: number | "fl";
  readonly handPath?: HandPath | null;
  readonly skewSteps?: number | null;
  readonly skewDir?: SkewDirection | null;
  readonly duration: number;
}
```

```typescript
// domain/models/SoloPropData.ts

interface SoloPropData {
  readonly id: string;
  readonly steps: readonly SoloPropStepData[];
  readonly startLocation: GridLocation;
  readonly startOrientation: Orientation;

  // Content-addressable identity
  readonly contentHash: string;

  // Compositional: every solo prop contains its hand path
  readonly handPath: HandPathData;

  // Derived query fields (delegated from hand path + own data)
  readonly length: number;
  readonly bigrams: readonly string[];
  readonly impliedGridMode: GridMode;

  // Metadata
  readonly name?: string;
  readonly author?: string;
  readonly notes?: string;
  readonly thumbnails?: readonly string[];
  readonly dateCreated?: Date;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
}
```

**Key design decisions:**

1. **`SoloPropStepData` is NOT `MotionData`.** It strips rendering concerns: no `arrowPlacementData`, no `propPlacementData`, no `arrowLocation`, no `propType`, no `color`, no `isVisible`, no `gridMode`. Those are rehydrated at render time from viewer preferences and spatial calculations.

2. **Hand-agnostic.** No `MotionColor`. When combining two solo props into a full sequence, the user assigns which is blue (left hand) and which is red (right hand).

3. **Contains its `HandPathData`.** The hand path is extracted from `steps[].startLocation` and the final `steps[-1].endLocation`. This is structural, not a separate query.

4. **MotionType in solo props.** `SoloPropStepData` stores the full `MotionType` (pro/anti/float/dash/static). Pro vs anti is meaningful even without a second hand — it describes the prop's rotation relative to the hand's travel direction. Dash and static MotionTypes correspond directly to the dash and static HandMotionTypes (straight-line across grid, and no movement, respectively). Pro/anti only occur on shifts (arc movements to adjacent grid points).

**Canonical form for hashing:**
- Each step serialized as: `"startLoc:endLoc:motionType:rotDir:turns:startOri:endOri[:handPath[:skewSteps:skewDir]]"`
  - `handPath`, `skewSteps`, `skewDir` included when non-null (they affect motion identity)
- Steps joined with `|`
- Includes start position: `"startLoc:startOri|step1|step2|..."`

**Rendering (choreo card):**
- One prop with full motion arrows (pro/anti/float/dash/static)
- Other side of the grid is empty
- No glyph (letters require two hands)
- Color: neutral (not blue/red)

### Tier 3: SequenceData (Refactored)

Both hands. Both props. Letter assignments. The existing model, restructured.

```typescript
// Additions to existing SequenceData

interface StepPairingData {
  readonly letter: Letter | null;          // null = unmapped combination
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly startPosition: GridPosition | null;  // two-hand spatial relationship (alpha3, beta5, etc.)
  readonly endPosition: GridPosition | null;
  // Duration is NOT stored here — derived from solo prop steps (blue's duration is authoritative)
}

interface SequenceData {
  // === EXISTING FIELDS (unchanged) ===
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly intendedWord?: string;
  readonly word: string;
  readonly thumbnails: readonly string[];
  readonly isFavorite: boolean;
  readonly isCircular: boolean;
  readonly loopType?: LOOPType | null;
  readonly orientationCycleCount?: 1 | 2 | 4;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly canonicalSignature?: string;
  readonly canonicalOffset?: number;
  readonly author?: string;
  readonly level?: number;
  readonly dateAdded?: Date;
  readonly birthday?: Date;
  readonly createdAt?: Date;
  readonly gridMode?: GridMode;
  readonly timeSignature?: TimeSignatureKey;
  readonly notes?: string;
  readonly effortTimeline?: EffortTimeline | null;
  readonly intendedProp?: { ... } | null;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
  readonly ownerAvatarUrl?: string;
  readonly performanceVideoUrl?: string;
  readonly animatedSequenceUrl?: string;
  readonly animationFormat?: "webp" | "gif";
  readonly performanceVideoPath?: string;
  readonly animatedSequencePath?: string;
  readonly sequenceLength?: number;
  readonly difficultyLevel?: string;

  // === NEW: Compositional structure ===
  readonly blueSoloProp: SoloPropData;
  readonly redSoloProp: SoloPropData;
  readonly stepPairings: readonly StepPairingData[];

  // === NEW: Content hashes for cross-tier queries ===
  readonly bluePathHash: string;
  readonly redPathHash: string;
  readonly blueSoloHash: string;
  readonly redSoloHash: string;

  // === REMOVED ===
  // readonly steps: readonly StepData[];           // DERIVED (not persisted): populated at read time from solo props + pairings
  // readonly startPosition?: StartPositionData;    // REMOVED: derived from solo props' start states
  // readonly startingPosition?: StartPositionData; // REMOVED: legacy alias
  // readonly startingPositionGroup?: GridPositionGroup; // REMOVED: derived from start positions
}
```

**Start position derivation:**
- Blue start: `blueSoloProp.startLocation` + `blueSoloProp.startOrientation`
- Red start: `redSoloProp.startLocation` + `redSoloProp.startOrientation`
- Grid position group (alpha/beta/gamma/etc.): derived from the spatial relationship between the two start locations
- `StartPositionData` as a standalone type is no longer stored; it's computed when needed

**The `IStepDeriver` service:**

Step derivation requires rendering infrastructure (arrow placement calculators, prop placement calculators, viewer preferences for prop type and grid mode). This makes it a DI service, not a pure function.

```typescript
// services/contracts/IStepDeriver.ts
interface IStepDeriver {
  deriveSteps(
    blueSoloProp: SoloPropData,
    redSoloProp: SoloPropData,
    stepPairings: readonly StepPairingData[],
    viewerPrefs: ViewerPreferences
  ): StepData[];

  deriveStartPosition(sequence: SequenceData): StartPositionData;
}
```

Dependencies: `IArrowLocationCalculator`, `IPropPlacementCalculator`, viewer settings (prop type, grid mode, colors).

Produces the exact `StepData[]` type all existing consumers expect. Can be called once and memoized in reactive state with `$derived`.

**Transitional `steps` getter:**

During migration, `createSequenceData()` attaches a getter via `Object.defineProperty` that calls `deriveSteps()` internally. This lets consumers migrate incrementally:

```typescript
// Works during transition — delegates to deriveSteps() under the hood
const steps = sequence.steps;

// Final form — explicit, no magic
const steps = stepDeriver.deriveSteps(sequence.blueSoloProp, sequence.redSoloProp, sequence.stepPairings, prefs);
```

The getter is removed once all consumers are migrated.

---

## Content-Addressable Identity

### Hashing Strategy

**Algorithm:** XXH128 (128-bit non-cryptographic, current best for speed + collision resistance)
**Encoding:** Base62 (22 characters, URL-safe, human-readable)
**Library:** `xxhash-wasm` (WASM-based, works in browser and Node)

### Canonical Forms

| Tier | Canonical String | Example |
|------|-----------------|---------|
| HandPath | locations joined with `\|` | `"n\|e\|s\|w"` |
| SoloProp | `"startLoc:startOri\|step1\|step2\|..."` where each step is `"sLoc:eLoc:mType:rDir:turns:sOri:eOri"` | `"n:in\|n:e:pro:cw:1:in:out\|..."` |
| Full Sequence | existing `canonicalSignature` (rotation-invariant hash) | unchanged |

### Deduplication Policy

Content hashes are **queryable fields**, not document IDs. Each user's saved artifact gets its own document ID. This allows:
- Two users to save the same hand path with different names
- A user to rename their saved path without changing its identity
- Query "does this exact path exist?" via hash lookup
- Query "all sequences using this path" via `bluePathHash` / `redPathHash` fields

### Denormalized Query Fields

Stored alongside content for Firestore queryability:

**HandPathData:**
- `bigrams: ["n_e", "e_s", "s_w"]` — `array-contains` for sub-sequence matching ("paths where N is followed by E")
- `uniqueLocations: ["e", "n", "s", "w"]` — sorted, for "paths visiting these positions"
- `startLocation`, `endLocation` — direct field queries
- `length` — filter by path length
- `impliedGridMode` — filter by grid mode
- `isClosed` — filter circular paths

**Full SequenceData:**
- `bluePathHash`, `redPathHash` — "all sequences using Zan's diamond"
- `blueSoloHash`, `redSoloHash` — "all sequences using this exact solo prop"

---

## Persistence & Firestore Schema

### Collections

Separate Firestore collections per tier (Firestore-idiomatic: separate indexes, separate security rules):

```
users/{uid}/handPaths/{pathId}        — private hand paths
users/{uid}/soloProps/{soloPropId}     — private solo props
users/{uid}/sequences/{seqId}         — private sequences (existing, refactored)

publicHandPaths/{pathId}              — public hand path gallery
publicSoloProps/{soloPropId}          — public solo prop gallery
publicSequences/{seqId}              — public sequence gallery (existing)
```

### Per-Tier Repositories

Each tier gets its own repository (per project naming conventions — name by what it does):

```typescript
// services/contracts/IHandPathRepository.ts
interface IHandPathRepository {
  get(id: string): Promise<HandPathData | null>;
  getByHash(contentHash: string): Promise<HandPathData | null>;
  list(filters: HandPathFilters): Promise<HandPathData[]>;
  save(path: HandPathData): Promise<void>;
  delete(id: string): Promise<void>;
}

// services/contracts/ISoloPropRepository.ts
interface ISoloPropRepository {
  get(id: string): Promise<SoloPropData | null>;
  getByHash(contentHash: string): Promise<SoloPropData | null>;
  list(filters: SoloPropFilters): Promise<SoloPropData[]>;
  save(soloProp: SoloPropData): Promise<void>;
  delete(id: string): Promise<void>;
}
```

The existing `ISequenceRepository` gains cross-tier query methods:

```typescript
// Added to existing ISequenceRepository
getByPathHash(pathHash: string): Promise<SequenceData[]>;
getBySoloHash(soloHash: string): Promise<SequenceData[]>;
```

### Security Rules

Hand paths and solo props follow the same ownership model as sequences:
- Users can read/write their own artifacts
- Public artifacts are readable by all, writable only by owner
- Publishing creates a copy in the public collection

### Document Size Estimate

A 16-beat sequence with full compositional structure:
- 2x `SoloPropData` with 16 steps each: ~32 step objects × ~120 bytes = ~3.8 KB
- 2x `HandPathData` with locations + bigrams: ~0.5 KB each = ~1 KB
- 16x `StepPairingData`: ~80 bytes each = ~1.3 KB
- 4x content hashes (22 chars each): ~0.1 KB
- Existing metadata (thumbnails, tags, notes, video URLs): ~2-5 KB
- **Total: ~8-12 KB per document**

Firestore's 1 MiB limit is >80x larger than the worst case. Even a hypothetical 128-beat sequence would be ~60 KB. No risk.

---

## Circular & LOOP Semantics

Properties that span both hands (and thus only exist at Tier 3):

| Property | Tier | Rationale |
|----------|------|-----------|
| `isClosed` | HandPathData (Tier 1) | Per-hand: first location == last location |
| `isCircular` | SequenceData (Tier 3) | Combined: start position == end position for BOTH hands + letter-level check |
| `loopType` | SequenceData (Tier 3) | Requires combined letter word to detect LOOP patterns |
| `orientationCycleCount` | SequenceData (Tier 3) | Depends on both hands' orientation patterns together |
| `canonicalSignature` | SequenceData (Tier 3) | Rotation-invariant hash of combined sequence |

A solo prop can be "closed" (returns to start location + orientation) but cannot be "circular" in the TKA sense — circularity is a two-hand property that requires the combined grid position to cycle.

---

## MCP Server Integration

The MCP server's sequence builder (`mcp-server/src/core/sequence-builder.ts`) produces `MotionData` arrays directly. Generated sequences must be converted to the three-tier model before being handed to the Scribe app.

**Conversion point:** After the MCP server returns raw `MotionData[]` per hand, a `ISequenceComposer` service:
1. Converts blue `MotionData[]` → `SoloPropData` (strips rendering fields, builds hand path)
2. Converts red `MotionData[]` → `SoloPropData`
3. Computes step pairings (letters already resolved by the builder)
4. Assembles full `SequenceData`

This conversion lives in the Scribe app, not in the MCP server. The MCP server's output format doesn't change — the Scribe app's ingestion layer handles the transformation.

---

## The Combine Operation

### Input
Two `SoloPropData` (hand-agnostic) + user's color assignment (which is blue, which is red).

### Process

1. **Validate step count** — must match (step-locked). If different lengths, reject with clear error.
2. **Assign colors** — user picks which solo prop becomes blue hand, which becomes red.
3. **Compute step pairings** for each beat index `i`:
   a. Determine `GridPosition` from both hands' locations at beat `i` (spatial relationship lookup)
   b. Attempt letter resolution via MCP domain service (async)
   c. Detect reversals by comparing beat `i` to beat `i-1` per hand
   d. Carry duration from solo prop steps (must match; if different, use blue's)
4. **Derive grid mode** — from the combined locations of both hands
5. **Derive word** — concatenate resolved letters (null letters become `?` placeholder)
6. **Construct SequenceData** with both solo props, step pairings, and sequence-level metadata

### Unmapped Letters

Some two-hand combinations may not yet have letter assignments in the TKA alphabet. These get `letter: null` in the pairing. The word will contain `?` placeholders. This is valid — the sequence is structurally complete, just awaiting alphabet expansion.

### Combine UI Location

The combine operation lives in the **Create module** (assemble tab or a dedicated "combine" panel). The flow:
1. User browses their solo prop palette
2. Selects two solo props
3. Assigns blue/red
4. Previews the combined result (with any unmapped beats highlighted)
5. Saves as a full sequence

---

## Browse & Save UX

### Construction Palette (Hand Paths & Solo Props)

Located in the **Create module**, separate from the main gallery. This is the workshop, not the museum.

- Card-based browse grid (same layout as sequence gallery)
- Choreo card rendering for each tier (see Rendering section)
- Filters: grid mode, length, start/end position, contains position
- Search by name
- Actions: combine, duplicate, delete, rename, publish

### Main Gallery (Full Sequences)

Unchanged. Full sequences only. No hand paths or solo props cluttering the gallery.

### Save Flow

When a user creates a hand path or solo prop (via assemble tab or extraction):
1. Compute content hash
2. Check if identical artifact exists in user's collection (hash match)
3. If exists: offer to view existing or save as new (different name/notes)
4. If new: save with auto-generated name (can rename later)

### Extraction

Any full sequence can be decomposed into its constituent hand paths and solo props. This is structural field access:
- `sequence.blueSoloProp` → save as independent solo prop
- `sequence.blueSoloProp.handPath` → save as independent hand path

The extraction is available from the sequence detail view (context menu or dedicated button).

### Random Combination

"Grab two random hand paths and combine" workflow:
1. User clicks "random combine" in the construction palette
2. System selects two random hand paths of the same length
3. Constructs solo props with default motion data (float arrows, no rotation)
4. Combines into a full sequence
5. User can refine or discard

---

## Migration Strategy

### Existing 600 Sequences

One-time migration script that transforms each existing `SequenceData`:

1. **Extract blue MotionData** from each step → `SoloPropStepData[]`
2. **Extract red MotionData** from each step → `SoloPropStepData[]`
3. **Build HandPathData** for each hand (extract locations from steps)
4. **Build SoloPropData** for each hand (steps + hand path + start state)
5. **Build StepPairingData[]** (letters, reversals, grid positions from existing steps)
6. **Compute content hashes** for all tiers
7. **Write refactored SequenceData** with compositional structure

### Consumer Migration

All current consumers of `steps: StepData[]` must be updated. The transitional getter (see "Transitional `steps` getter" above) prevents a Big Bang migration — consumers work unchanged during transition and are migrated incrementally to explicit `IStepDeriver` calls.

Known consumer categories (814 `.steps` references across 222 files):

- **Sequence viewer** — animation playback (`AnimatorCanvas`, `DisassembleTransition`)
- **Choreo card renderer** — pictograph display (`ChoreoCard`, sequence viewer components)
- **Sequence exporter** — file/image export
- **Generate panel** — sequence generation output
- **Assemble tab** — construction output
- **Animator canvas** — real-time animation
- **Browse gallery** — sequence cards
- **Sequence encoder/decoder** — URL sharing (`SequenceEncoder`)
- **Canonical signature computation** — equivalence detection
- **LOOP detection** — circular pattern analysis
- **Reversal detection** — per-step reversal flags
- **Effort timeline** — phrase-level effort mapping
- **`createSequenceData()` / `addStepToSequence()` / `removeStepFromSequence()`** — factory and mutation helpers (must be rewritten for compositional model)

The transitional getter means each of these can be migrated independently without blocking others.

### StartPositionData Migration

Current code accesses `sequence.startPosition` or `sequence.startingPosition`. These become derived:
```typescript
function deriveStartPosition(sequence: SequenceData): StartPositionData {
  // Compute from blueSoloProp.startLocation/startOrientation
  // + redSoloProp.startLocation/startOrientation
}
```

---

## Assemble Tab Changes

The assemble tab already works per-hand with `BuilderStep[]`. Current flow:

```
BuilderStep[] (per-hand) → BuilderStepConverter → MotionData[] → StepData[]
```

New flow:

```
BuilderStep[] (per-hand) → BuilderStepConverter → SoloPropStepData[] → SoloPropData
```

When only one hand is built: the result is a valid `SoloPropData` that can be saved independently. The assemble tab acknowledges this as a completed artifact, not an incomplete sequence.

When both hands are built: the combine operation pairs them into a `SequenceData`.

---

## Disassemble Relationship

The existing disassemble animation (visual effect of splitting a sequence into pieces) maps directly to the compositional decomposition. The animation can now be backed by real structural data:
- Disassemble a full sequence → visually separate into two solo prop choreo cards
- Disassemble a solo prop → visually separate into a hand path + motion overlay

This is a future enhancement, not part of this spec's scope.

---

## Scope Summary

### In Scope
1. Type definitions: `HandPathData`, `SoloPropStepData`, `SoloPropData`, `StepPairingData`
2. Refactored `SequenceData` with compositional structure
3. `deriveSteps()` and `deriveStartPosition()` functions
4. Content hashing infrastructure (XXH128 + Base62)
5. Hand path / solo prop extraction from existing sequences
6. Combine operation (two solo props → full sequence)
7. Migration script for existing 600 sequences
8. Consumer migration (all `steps[]` call sites → `deriveSteps()`)
9. Firestore collections and security rules for new artifact types
10. `IArtifactRepository` unified query service
11. Construction palette browse UI for hand paths and solo props
12. Choreo card rendering for hand paths and solo props
13. Assemble tab updates (solo prop as valid output state)
14. Bigram/query field computation

### Out of Scope (Future Work)
- Random combination workflow
- Disassemble animation backed by structural data
- Public sharing infrastructure for hand paths and solo props
- Algorithmic tagging/classification of hand paths
- Hand path similarity/distance metrics
- Level 7+ conjoined grid hand paths
