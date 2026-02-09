# Level 6: Extended Dashes (Dash+/Dash++) Implementation Plan

**Status:** Design phase — concept documented, no code yet
**Created:** 2026-02-08
**Prerequisite:** Conjoined grid lab must graduate to production first

---

## The Concept

In Level 6 (conjoined grids), two grids share a junction point. This creates new straight-line paths that cross the grid boundary:

- **Dash+**: Perimeter of Grid A → center of Grid B (crosses junction)
- **Dash++**: Perimeter of Grid A → opposite perimeter of Grid B (crosses both grids)

These follow the same extension pattern as shifts gained at L4 (skew+/skew++). The rotation behavior is identical to standard dashes — they're straight lines, so no pro/anti/float distinction at base rotation.

**Letter classification is unaffected.** A dash+ is still a "dash" for letter typing. Existing letter set covers all cases.

---

## Design Decisions to Make First

Before writing any code, these questions need answers. Each is a conversation between Austen and Claude.

### Decision 1: Grid Location Addressing

**The problem:** Current `MotionData.startLocation` and `endLocation` use single-grid values (`"n"`, `"e"`, `"sw"`, `"c"`). A cross-grid dash needs to express "east on Grid A" → "west on Grid B".

**Options:**

| Option | Example | Pros | Cons |
|--------|---------|------|------|
| **A: Grid-qualified strings** | `"A:e"` → `"B:w"` | Explicit, self-documenting | Breaks every location parser in the codebase |
| **B: Separate grid field** | `{ grid: "A", location: "e" }` → `{ grid: "B", location: "w" }` | Clean separation, existing location values untouched | Adds a field to MotionData, all readers need updating |
| **C: Remote suffix** | `"e"` → `"w_remote"` | Minimal data model change | Ugly, unclear which grid "remote" means in multi-grid scenarios |
| **D: Absolute coordinates** | Each grid's points get unique IDs in the conjoined space | Future-proof for L8/L9 multi-plane | Most complex, biggest refactor |

**Recommended:** Option B. It's the cleanest separation of concerns. The `grid` field defaults to `undefined` (= "current grid" = backward compatible for L1-5). Only L6+ motions populate it.

### Decision 2: Hand Path Classification

**The problem:** Is dash+ a new hand path type, or a modifier on existing dash?

**Options:**

| Option | Representation | Analogy |
|--------|---------------|---------|
| **A: New hand path values** | `HandPath.DASH_PLUS`, `HandPath.DASH_PLUS_PLUS` | Like how `HASH_IN`/`HASH_OUT` are separate from `DASH` |
| **B: Modifier on dash** | `{ handPath: "dash", extension: "+" }` | Like how skews use `skewDir: "+"` and `skewSteps` on shifts |

**Recommended:** Option B. It mirrors how skews already work — shifts don't get new hand path types for skew+, they get a modifier. Dashes should follow the same pattern. This also means the letter classification logic doesn't change at all (it checks for "dash" hand path, not "dash+").

### Decision 3: Valid Cross-Grid Paths

**The problem:** Not every straight line between grids is a valid dash+/dash++. Which ones count?

**Constraints:**
- The line must be geometrically straight (not an arc)
- The line must pass through or near the junction point
- The start and end must be actual grid points

**Depends on grid arrangement.** For left-right arrangement with east junction:
- Dash++: Grid A east → Grid B west (straight horizontal line through junction)
- Dash+: Grid A east → Grid B center (diagonal line through junction)
- Possibly more depending on which diagonals we consider "straight enough"

**This needs visual prototyping** — draw the conjoined grid, mark all grid points, and identify which point-to-point lines are geometrically straight. The conjoined lab already has the layout infrastructure for this.

### Decision 4: Orientation Reference Point

**The problem:** Orientations are center-relative. A cross-grid motion starts on one grid (center A) and ends on another (center B). Which center defines the orientation?

**Options:**

| Option | Rule | Analogy |
|--------|------|---------|
| **A: Start grid's center** | Orientation measured from Grid A's center throughout | Simple, but end orientation is weird |
| **B: End grid's center** | Orientation measured from Grid B's center at arrival | Matches how the prop "belongs to" the destination grid |
| **C: Transition at junction** | Use Grid A's center until junction, Grid B's center after | Most physically accurate, most complex |
| **D: Conjoined center** | Define a new center point for the combined grid system | Clean but introduces a new reference frame |

**Recommended:** Decision deferred — this needs physical experimentation (spinning props between two imaginary grid centers) to determine what feels right.

---

## Implementation Phases

### Phase 0: Design Finalization (THIS PHASE)

- [x] Document the concept in tka-domain.md
- [x] Write this plan
- [ ] Austen reviews and makes decisions on the 4 design questions above
- [ ] Visual prototyping in conjoined lab — draw extended dash paths on the dual grid
- [ ] Validate with physical movement if possible

### Phase 1: Data Model Extension

**Depends on:** Decision 1 (grid addressing) and Decision 2 (hand path classification)

**Changes:**
- `MotionData` interface — add optional `grid` and `targetGrid` fields (or chosen addressing scheme)
- `HandPath` enum or type — add extension modifier (if Option B chosen for Decision 2)
- CSV format — extend to support cross-grid motions (new columns or notation)
- `CSVPictographParser` — parse the new format

**Backward compatible:** L1-5 data unchanged. New fields are optional with undefined = same grid.

**Files affected:**
- `src/lib/shared/pictograph/shared/domain/` — MotionData types
- `src/lib/shared/pictograph/shared/services/implementations/CSVPictographParser.ts`
- `packages/pictograph/src/domain/` — if pictograph package has its own types
- `mcp-server/src/core/` — MCP data structures

### Phase 2: Hand Path Detection

**Depends on:** Decision 3 (valid paths)

**Changes:**
- Add cross-grid dash pairs to `hand-path-constraint.ts`
- Update hand path detection to account for grid context
- Define which grid arrangements produce which valid dash+/dash++ paths

**Files affected:**
- `mcp-server/src/core/constraints/implementations/hand-path-constraint.ts`
- Conjoined lab domain logic

### Phase 3: Orientation Calculation

**Depends on:** Decision 4 (orientation reference point)

**Changes:**
- Orientation calculator needs to handle cross-grid motions
- May need a "conjoined orientation" mode that accounts for two center points
- Parity rules should still apply (dash+ is a straight line, same rotation algebra)

**Files affected:**
- `apps/scribe/src/lib/shared/render/core/calculations/orientation.ts`
- Related orientation propagation code

### Phase 4: Rendering

**Changes:**
- Arrow SVGs that span across the grid boundary
- Prop SVGs that animate from one grid to another
- The conjoined lab already renders dual grids — this adds cross-grid motion arrows

**Files affected:**
- Conjoined lab components
- Arrow rendering services (need cross-grid coordinate calculation)
- Possibly `@tka/pictograph` package if pictographs can show cross-grid motions

### Phase 5: Sequence Engine Integration

**Changes:**
- Position groups need cross-grid variants
- Transition validation for sequences containing extended dashes
- Letter lookup must recognize that dash+/dash++ still map to existing letters

**Files affected:**
- `src/lib/shared/sequence-engine/`
- `mcp-server/src/core/letter-transition-graph.ts`
- Variation dataframes (CSV data for cross-grid letter variations)

### Phase 6: Combinatorial Enumeration

**Changes:**
- Update the motion space count for L6 to include extended dash destinations
- Each perimeter point gains new dash destinations: remote center (dash+), remote opposite (dash++)
- The exact count depends on grid arrangement and which paths are valid

---

## What This Does NOT Change

- **The letter set.** No new letters needed. Dash+/++ are dashes for classification.
- **Rotation algebra.** Straight line = same parity rules as standard dash.
- **Turn counts.** Same turn progression applies.
- **Levels 1-5.** Completely unaffected. Extended dashes only exist when conjoined grids exist.

---

## Estimated Complexity

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 0 (design) | Low — conversations + prototyping | Low |
| Phase 1 (data model) | **High** — foundational, cascading changes | **High** — wrong choice here costs dearly |
| Phase 2 (hand paths) | Medium — new pairs, straightforward | Low |
| Phase 3 (orientation) | Medium-High — depends on Decision 4 | Medium — may need physical experimentation |
| Phase 4 (rendering) | Medium — conjoined lab has visual infra | Low |
| Phase 5 (sequence engine) | High — integration with existing transition system | Medium |
| Phase 6 (enumeration) | Low — math exercise | Low |

**Total estimate:** This is a multi-session project that should be tackled AFTER the conjoined lab itself is production-ready. The design decisions (Phase 0) can happen anytime.
