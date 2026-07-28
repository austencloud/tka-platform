---
status: shipped
value: 4
effort: L
remaining: "Explorer and Builder live under src/lib/features/hand-paths/ (HandPathModule, HandPathExplorerLab, HandPathBuilderLab). Disassemble view was never built."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-28
---
# Hand Path Ecosystem — Design Spec

> Three lab tabs that leverage the three-tier compositional model (HandPathData → SoloPropData → SequenceData) for visualization, exploration, and building.

**Goal:** Make hand paths — the pure spatial geometry of where hands travel — a first-class explorable, buildable, and queryable concept in the lab.

**Context:** The three-tier compositional model was just shipped. Every sequence in Firestore now carries `blueSoloProp`, `redSoloProp`, `stepPairings`, and hash fields (`bluePathHash`, `redPathHash`, `blueSoloHash`, `redSoloHash`). HandPathData, HandPathFactory, and HandPathRepository are all implemented and registered in DI.

---

## Hand Path Naming Convention

Deterministic, reversible, human-readable names generated from `HandPathData.locations[]`:

| Grid Location | Abbreviation |
|---------------|-------------|
| North | N |
| East | E |
| South | S |
| West | W |
| Northeast | Ne |
| Southeast | Se |
| Southwest | Sw |
| Northwest | Nw |
| Center | C |

Concatenated in order: `["n", "ne", "s", "w", "c"]` → `"NNeSWC"`

Mixed case distinguishes intercardinals from cardinal sequences: "NE" = North→East (2 locations), "Ne" = Northeast (1 location).

Implementation: a pure function `handPathToName(locations: GridLocation[]): string` and its inverse `nameToHandPath(name: string): GridLocation[]`.

---

## Tab 1: Disassemble Lab Extension — Hand Path View

**What:** Extend the existing Disassemble Lab to add a third drill-down level. Currently it shows: full sequence → blue solo / red solo. New: solo prop → hand path (strip rotation, show hands only).

**How it works:**
- Add a `viewTier` state: `"sequence" | "soloProps" | "handPaths"`
- At `handPaths` tier, the AnimatorCanvas renders using the hand SVG (`static/images/props/pictograph/hand.svg`) instead of the prop SVG
- `staffRotationAngle` is fixed at 0 (no rotation applied)
- `centerPathAngle` still drives the hand's grid position
- The small canvases show blue hand path / red hand path independently
- In the pictograph strip, use float arrows for shifts and dash arrows for dashes (no rotation direction needed)

**Key files to modify:**
- `src/lib/features/disassemble-lab/disassemble-state.svelte.ts` — add `viewTier`
- `src/lib/features/disassemble-lab/DisassemblePlaybackHost.svelte` — swap prop rendering at tier 1
- `src/lib/features/disassemble-lab/DisassembleLayout.svelte` — add tier toggle UI

**Data source:** `SequenceData.blueSoloProp.handPath` and `SequenceData.redSoloProp.handPath` (already present on all migrated sequences).

---

## Tab 2: Hand Path Explorer

**What:** New lab tab. Browse all unique hand paths across the user's library. Group sequences by shared hand path. Visualize popular/common paths.

**UI:**
- Grid of hand path cards, each showing:
  - The path name (e.g., "NESWNe")
  - Mini pictograph rendering (hands at locations, arrows showing movement)
  - Count of sequences using this path
  - Whether it's blue-side, red-side, or both
- Tap a card to expand: list all sequences that share this path with thumbnails
- Sort by: frequency (most shared first), length, grid mode

**Data flow:**
1. Load all sequences via `SequenceRepository.getAllSequences()`
2. Group by `bluePathHash` and `redPathHash`
3. For each unique hash, extract the `HandPathData` from the first sequence's solo prop
4. Render using the naming convention

**Key new files:**
- `src/lib/features/hand-path-explorer/HandPathExplorerLab.svelte` — module root
- `src/lib/features/hand-path-explorer/state/explorer-state.svelte.ts` — state factory
- `src/lib/features/hand-path-explorer/components/HandPathCard.svelte` — card component
- `src/lib/features/hand-path-explorer/components/HandPathDetail.svelte` — expanded view

---

## Tab 3: Hand Path Builder

**What:** Revive the deleted tap-based hand path builder. Simplified: no rotation selection phase (hand paths don't have rotation). Just tap grid locations to draw a spatial path.

**Historical reference:** Commit `d9f91d266` deleted `handpath-assemble-state.svelte.ts` and `HandPathOrchestrator.svelte`. The tap-based builder had a three-phase workflow (blue → red → rotation → complete). We remove the rotation phase entirely.

**Workflow:**
1. Choose grid mode (diamond/box/skewed)
2. Tap grid locations for blue hand path (min 2 positions)
3. Tap "Next Hand" → tap locations for red hand path (must match blue length)
4. Done → `HandPathData` objects created via `HandPathFactory.create()`
5. Show name (e.g., "NeSWC") and whether this path already exists in the library
6. Option to save via `HandPathRepository.save()`

**Key new files:**
- `src/lib/features/hand-path-builder/HandPathBuilderLab.svelte` — module root
- `src/lib/features/hand-path-builder/state/builder-state.svelte.ts` — state factory
- `src/lib/features/hand-path-builder/components/BuilderGrid.svelte` — tappable grid
- `src/lib/features/hand-path-builder/components/PathPreview.svelte` — live preview

**Data output:** `HandPathData` saved to `users/{uid}/handPaths/{id}` via existing `HandPathRepository`.

---

## Integration

Each tab is added to `LabModule.svelte` as a lazy-loaded import:

```typescript
"hand-path-explorer": () => import("../../features/hand-path-explorer/HandPathExplorerLab.svelte"),
"hand-path-builder": () => import("../../features/hand-path-builder/HandPathBuilderLab.svelte"),
```

The disassemble lab extension modifies the existing tab, no new entry needed.

No new DI containers required — all tabs use existing services via `container.items.*`.
