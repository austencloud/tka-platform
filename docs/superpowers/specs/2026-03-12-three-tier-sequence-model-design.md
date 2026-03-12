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
- Mix of cardinal and intercardinal → `SKEWED`
- Any CENTER location → `CENTRIC`
- These are implied, not stored as primary data. The `impliedGridMode` field is a denormalized derivation for queries.

**Canonical form for hashing:**
- Locations joined with `|`: `"n|e|s|w"`
- Uses the GridLocation enum values (lowercase short forms)
- Deterministic: same trajectory always produces the same hash

**Rendering (choreo card):**
- Float arrows for location-to-location movement (the straight float arrow)
- Dash arrows for same-position holds (start == end)
- No arrow for static (single location, no movement)
- No props rendered. Neutral color (theme accent or gray).
- No glyph (letters require two hands)

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

**Canonical form for hashing:**
- Each step serialized as: `"startLoc:endLoc:motionType:rotDir:turns:startOri:endOri"`
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
  readonly duration: number;
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
  // readonly steps: readonly StepData[];           // REMOVED: derived from solo props + pairings
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

**The `deriveSteps()` function:**

```typescript
function deriveSteps(
  blueSoloProp: SoloPropData,
  redSoloProp: SoloPropData,
  stepPairings: readonly StepPairingData[]
): StepData[] {
  // Zips blue step i + red step i + pairing i → StepData
  // Rehydrates MotionData from SoloPropStepData (adds placement data, color, prop type from viewer prefs)
  // Produces the exact StepData[] type all existing consumers expect
}
```

This is a pure function. Existing consumers call it once and get the same `StepData[]` they've always worked with. Can be memoized in reactive state with `$derived`.

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

### Unified Query Layer

A single `IArtifactRepository` service queries across tiers:

```typescript
interface IArtifactRepository {
  // Tier-specific queries
  getHandPaths(filters: HandPathFilters): Promise<HandPathData[]>;
  getSoloProps(filters: SoloPropFilters): Promise<SoloPropData[]>;
  getSequences(filters: SequenceFilters): Promise<SequenceData[]>;

  // Cross-tier queries
  getSequencesUsingPath(pathHash: string): Promise<SequenceData[]>;
  getSequencesUsingSoloProp(soloHash: string): Promise<SequenceData[]>;

  // Save operations
  saveHandPath(path: HandPathData): Promise<void>;
  saveSoloProp(soloProp: SoloPropData): Promise<void>;
  saveSequence(sequence: SequenceData): Promise<void>;
}
```

### Security Rules

Hand paths and solo props follow the same ownership model as sequences:
- Users can read/write their own artifacts
- Public artifacts are readable by all, writable only by owner
- Publishing creates a copy in the public collection

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

All current consumers of `steps: StepData[]` must be updated to use `deriveSteps()`. These consumers include:

- **Sequence viewer** — animation playback
- **Choreo card renderer** — pictograph display
- **Sequence exporter** — file/image export
- **Generate panel** — sequence generation output
- **Assemble tab** — construction output
- **Animator canvas** — real-time animation
- **Browse gallery** — sequence cards

The `deriveSteps()` function returns the exact same `StepData[]` type, so the change at each call site is:
```typescript
// Before
const steps = sequence.steps;

// After
const steps = deriveSteps(sequence.blueSoloProp, sequence.redSoloProp, sequence.stepPairings);
```

This can be wrapped in a convenience function on the sequence itself or provided as a service.

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
