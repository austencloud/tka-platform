# Unified Conjoined Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Conjoined Lab and Multi-Grid Lab into a single "Conjoined Grid" tab in the Levels module with both real pictograph browsing and position pair exploration.

**Architecture:** Multi-Grid's topology framework (TopologyBuilder, TopologyCanvas, TopologyRenderer) provides the N-grid infrastructure. Conjoined Lab's CSV data pipeline (letterQueryHandler, pictographPreparer) and overlap detection are grafted on. A new JunctionOverlapDetector generalizes overlap detection to N junctions. A PictographTopologyMapper assigns pictograph props to grids.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, existing multi-grid + pictograph services

**Spec:** `docs/superpowers/specs/2026-03-26-unified-conjoined-grid-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/features/conjoined-grid/domain/types.ts` | Unified domain types (modes, overlap results, mapper output) |
| `src/lib/features/conjoined-grid/services/contracts/IJunctionOverlapDetector.ts` | Interface: detect prop overlaps at junction points |
| `src/lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector.ts` | Implementation: generalized N-junction overlap detection |
| `src/lib/features/conjoined-grid/services/contracts/IPictographTopologyMapper.ts` | Interface: map pictograph props onto topology grids |
| `src/lib/features/conjoined-grid/services/implementations/PictographTopologyMapper.ts` | Implementation: assign blue/red to grids based on topology |
| `src/lib/features/conjoined-grid/state/conjoined-grid-state.svelte.ts` | Reactive state factory (topology, mode, browse, explore, overlaps) |
| `src/lib/features/conjoined-grid/components/ConjoinedGridControls.svelte` | Sidebar controls: topology selector, mode toggle, browse/explore controls |
| `src/lib/features/conjoined-grid/ConjoinedGridTab.svelte` | Entry point: wires state + canvas + controls |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/shared/navigation/config/tab-definitions.ts` | Replace level7 entry in LEVELS_TABS with conjoined-grid; remove multi-grid from LAB_TABS |
| `src/lib/features/levels/LevelsModule.svelte` | Replace level7 tabComponent with conjoined-grid |
| `src/lib/features/lab/LabModule.svelte` | Remove multi-grid tabComponent |
| `messages/en.json` | Add conjoined-grid tab translation keys |

### Reused As-Is (no changes)
| File | Used For |
|------|----------|
| `src/lib/shared/multi-grid/components/TopologyCanvas.svelte` | N-grid SVG rendering with junction masking |
| `src/lib/shared/multi-grid/services/implementations/TopologyBuilder.ts` | Build topologies from presets |
| `src/lib/shared/multi-grid/services/implementations/TopologyRenderer.ts` | ViewBox + coordinate transforms |
| `src/lib/shared/multi-grid/services/implementations/TopologyPositionEnumerator.ts` | Enumerate position pairs |
| `src/lib/shared/multi-grid/services/implementations/TopologyPropLoader.ts` | Load prop SVGs |
| `src/lib/shared/multi-grid/services/implementations/TopologyBetaSeparator.ts` | Beta separation calculation |
| `src/lib/shared/multi-grid/domain/constants/TopologyPresets.ts` | 9 topology presets |

### Deleted After Merge
| File | Why |
|------|-----|
| `src/lib/features/conjoined-lab/` (7 files) | Functionality absorbed into conjoined-grid |
| `src/lib/features/multi-grid-lab/MultiGridLabModule.svelte` | Entry point replaced |

---

### Task 1: Domain Types + JunctionOverlapDetector

**Files:**
- Create: `src/lib/features/conjoined-grid/domain/types.ts`
- Create: `src/lib/features/conjoined-grid/services/contracts/IJunctionOverlapDetector.ts`
- Create: `src/lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector.ts`
- Test: `tests/unit/conjoined-grid/JunctionOverlapDetector.test.ts`

- [ ] **Step 1: Create domain types**

```typescript
// src/lib/features/conjoined-grid/domain/types.ts
import type { PointRef, Junction } from "$lib/shared/multi-grid/domain/models/GridTopology";

export type ConjoinedGridMode = "browse" | "explore";

export interface JunctionOverlap {
  readonly junction: Junction;
  readonly blueRef: PointRef;
  readonly redRef: PointRef;
  readonly distance: number;
}

export interface PropPlacement {
  readonly blue: PointRef;
  readonly red: PointRef;
}
```

- [ ] **Step 2: Create IJunctionOverlapDetector interface**

```typescript
// src/lib/features/conjoined-grid/services/contracts/IJunctionOverlapDetector.ts
import type { GridTopology } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { JunctionOverlap, PropPlacement } from "../../domain/types";

export interface IJunctionOverlapDetector {
  detectOverlaps(topology: GridTopology, placement: PropPlacement): JunctionOverlap[];
}
```

- [ ] **Step 3: Write failing test**

```typescript
// tests/unit/conjoined-grid/JunctionOverlapDetector.test.ts
import { describe, it, expect } from "vitest";
import { JunctionOverlapDetector } from "$lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector";
import { TopologyBuilder } from "$lib/shared/multi-grid/services/implementations/TopologyBuilder";
import { TopologyPresets } from "$lib/shared/multi-grid/domain/constants/TopologyPresets";

describe("JunctionOverlapDetector", () => {
  const detector = new JunctionOverlapDetector();

  it("detects overlap when blue and red both end at junction", () => {
    // 2-grid horizontal chain: grid "a" east = grid "b" center
    // junction is at a:e / b:c
    const topology = TopologyPresets.twoChainHorizontal();
    const overlaps = detector.detectOverlaps(topology, {
      blue: { gridId: "a", location: "e" },
      red: { gridId: "b", location: "c" },
    });
    expect(overlaps.length).toBe(1);
    expect(overlaps[0]!.junction.refs.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty when props are not at junctions", () => {
    const topology = TopologyPresets.twoChainHorizontal();
    const overlaps = detector.detectOverlaps(topology, {
      blue: { gridId: "a", location: "n" },
      red: { gridId: "b", location: "s" },
    });
    expect(overlaps.length).toBe(0);
  });

  it("detects overlap on 3-grid chain", () => {
    const topology = TopologyPresets.threeChain();
    // Middle grid junctions: g0:e=g1:c and g1:e=g2:c
    const overlaps = detector.detectOverlaps(topology, {
      blue: { gridId: "g0", location: "e" },
      red: { gridId: "g1", location: "c" },
    });
    expect(overlaps.length).toBe(1);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test -- --run tests/unit/conjoined-grid/JunctionOverlapDetector.test.ts
```

- [ ] **Step 5: Implement JunctionOverlapDetector**

```typescript
// src/lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector.ts
import type { GridTopology, PointRef, Junction } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { IJunctionOverlapDetector } from "../contracts/IJunctionOverlapDetector";
import type { JunctionOverlap, PropPlacement } from "../../domain/types";

export class JunctionOverlapDetector implements IJunctionOverlapDetector {
  detectOverlaps(topology: GridTopology, placement: PropPlacement): JunctionOverlap[] {
    const overlaps: JunctionOverlap[] = [];

    for (const junction of topology.junctions) {
      const blueAtJunction = this.refMatchesJunction(placement.blue, junction);
      const redAtJunction = this.refMatchesJunction(placement.red, junction);

      if (blueAtJunction && redAtJunction) {
        overlaps.push({
          junction,
          blueRef: placement.blue,
          redRef: placement.red,
          distance: 0,
        });
      }
    }

    return overlaps;
  }

  private refMatchesJunction(ref: PointRef, junction: Junction): boolean {
    return junction.refs.some(
      (jRef) => jRef.gridId === ref.gridId && jRef.location === ref.location
    );
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- --run tests/unit/conjoined-grid/JunctionOverlapDetector.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/conjoined-grid/domain/ src/lib/features/conjoined-grid/services/ tests/unit/conjoined-grid/
git commit -m "feat(conjoined-grid): add domain types and JunctionOverlapDetector"
```

---

### Task 2: PictographTopologyMapper

**Files:**
- Create: `src/lib/features/conjoined-grid/services/contracts/IPictographTopologyMapper.ts`
- Create: `src/lib/features/conjoined-grid/services/implementations/PictographTopologyMapper.ts`

- [ ] **Step 1: Create interface**

```typescript
// src/lib/features/conjoined-grid/services/contracts/IPictographTopologyMapper.ts
import type { GridTopology } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PropPlacement } from "../../domain/types";

export interface IPictographTopologyMapper {
  /**
   * Map a pictograph's blue/red end positions to grid:location refs in the topology.
   * For 2-grid topologies: blue maps to first grid, red maps to second grid.
   * Returns null if the pictograph's positions can't be mapped to this topology.
   */
  mapToTopology(pictograph: PictographData, topology: GridTopology): PropPlacement | null;
}
```

- [ ] **Step 2: Implement**

```typescript
// src/lib/features/conjoined-grid/services/implementations/PictographTopologyMapper.ts
import type { GridTopology } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { IPictographTopologyMapper } from "../contracts/IPictographTopologyMapper";
import type { PropPlacement } from "../../domain/types";
import type { GridLocation } from "$lib/shared/render/core/types";

export class PictographTopologyMapper implements IPictographTopologyMapper {
  mapToTopology(pictograph: PictographData, topology: GridTopology): PropPlacement | null {
    const blueEnd = pictograph.motions?.blue?.endLocation?.toLowerCase() as GridLocation | undefined;
    const redEnd = pictograph.motions?.red?.endLocation?.toLowerCase() as GridLocation | undefined;

    if (!blueEnd || !redEnd || topology.grids.length < 2) return null;

    // For 2-grid topologies: blue on first grid, red on second grid
    const gridA = topology.grids[0]!;
    const gridB = topology.grids[1]!;

    return {
      blue: { gridId: gridA.id, location: blueEnd },
      red: { gridId: gridB.id, location: redEnd },
    };
  }
}
```

- [ ] **Step 3: Verify**

```bash
npm run check 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/conjoined-grid/services/
git commit -m "feat(conjoined-grid): add PictographTopologyMapper"
```

---

### Task 3: State Factory

**Files:**
- Create: `src/lib/features/conjoined-grid/state/conjoined-grid-state.svelte.ts`

- [ ] **Step 1: Create state factory**

The state factory manages all reactive state for the unified tab. It receives DI services as arguments (per project pattern). It manages:
- Topology selection + building
- Mode toggle (browse/explore)
- Browse mode: pictograph loading, navigation, overlap filtering
- Explore mode: position pair enumeration, playback, click-to-place

Key dependencies to inject:
- `letterQueryHandler` (load CSV pictographs)
- `pictographPreparer` (prepare pictograph for rendering)
- `TopologyPositionEnumerator` (enumerate position pairs)
- `JunctionOverlapDetector` (detect overlaps)
- `PictographTopologyMapper` (map pictographs to grids)

The state factory should export a `createConjoinedGridState()` function that returns a plain object with getter accessors (per project state management pattern in `.claude/rules/state-management.md`).

Key state fields:
```
topology, selectedPresetId, activeMode,
allPictographs, selectedPictographIndex, showOverlapsOnly, overlappingIndices,
allPairs, currentPairIndex, isPlaying, playbackSpeed,
manualPlacement, manualBlueRef, manualRedRef,
currentPlacement (derived from mode), junctionOverlaps (derived)
```

Key methods:
```
selectPreset(id), setMode(mode),
nextPictograph(), prevPictograph(), goToOverlap(direction),
play(), pause(), stepForward(), stepBack(), setSpeed(ms),
placeBlue(ref), placeRed(ref), toggleManualPlacement(),
loadPictographs()
```

- [ ] **Step 2: Verify types compile**

```bash
npm run check 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/conjoined-grid/state/
git commit -m "feat(conjoined-grid): add reactive state factory"
```

---

### Task 4: Controls Component

**Files:**
- Create: `src/lib/features/conjoined-grid/components/ConjoinedGridControls.svelte`

- [ ] **Step 1: Create controls component**

Sidebar controls with sections:

1. **Topology preset selector** — dropdown of all 9 presets from TopologyPresets
2. **Mode toggle** — "Browse" / "Explore" segmented control
3. **Browse mode** (shown when mode === "browse"):
   - Pictograph counter: "42 / 523"
   - Prev/Next buttons
   - "Overlaps only" toggle button with count badge
   - Overlap navigation: prev/next overlap (shown when overlaps filter active)
4. **Explore mode** (shown when mode === "explore"):
   - Play/Pause button
   - Step backward/forward buttons
   - Speed slider (100ms - 2000ms)
   - Pair counter: "7 / 256"
   - Manual placement toggle
   - Blue/Red placement selector (when manual active)
5. **Junction overlap indicator** (always visible):
   - Count of active overlaps
   - List of junction IDs with overlap

Props: receives the state object from the state factory.

Follow existing control patterns from MultiGridLabModule's TopologyControls and ConjoinedLabModule's ConjoinedControls. Use theme variables, 44px min touch targets, segmented control pattern.

- [ ] **Step 2: Verify**

```bash
npm run check 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/conjoined-grid/components/
git commit -m "feat(conjoined-grid): add controls component"
```

---

### Task 5: Entry Point + Tab Registration

**Files:**
- Create: `src/lib/features/conjoined-grid/ConjoinedGridTab.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/levels/LevelsModule.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte`
- Modify: `messages/en.json`

- [ ] **Step 1: Create ConjoinedGridTab.svelte**

Entry point component that:
1. Resolves DI services (letterQueryHandler, pictographPreparer from container)
2. Creates state via `createConjoinedGridState(services)`
3. Calls `state.loadPictographs()` on mount
4. Renders layout: TopologyCanvas (flex: 1) + ConjoinedGridControls (320px sidebar)
5. Passes state-derived props to TopologyCanvas (topology, blueRef, redRef, prop data, beta offset)
6. Passes state to controls
7. Mobile responsive: stack vertically below 768px

- [ ] **Step 2: Replace level7 tab in LEVELS_TABS**

In `src/lib/shared/navigation/config/tab-definitions.ts`, replace the `level7` entry in LEVELS_TABS with:
```typescript
{
  id: "conjoined-grid",
  label: "Conjoined Grid",
  icon: '<i class="fas fa-link" aria-hidden="true"></i>',
  description: "N-grid topology explorer with real pictograph data",
  color: "#10b981",
  gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
},
```

- [ ] **Step 3: Update LevelsModule.svelte**

Replace the level7 entry in tabComponents:
```typescript
// Before:
level7: () => import("$lib/features/conjoined-lab/ConjoinedLabModule.svelte"),
// After:
"conjoined-grid": () => import("$lib/features/conjoined-grid/ConjoinedGridTab.svelte"),
```

- [ ] **Step 4: Remove multi-grid from Lab**

In `src/lib/features/lab/LabModule.svelte`, remove the `"multi-grid"` entry from tabComponents.

In `src/lib/shared/navigation/config/tab-definitions.ts`, remove the `multi-grid` entry from LAB_TABS.

- [ ] **Step 5: Add i18n keys**

In `messages/en.json`:
```json
"tab_levels_conjoined_grid": "Conjoined Grid",
"tab_levels_conjoined_grid_desc": "N-grid topology explorer with real pictograph data"
```

- [ ] **Step 6: Verify**

```bash
npm run check 2>&1 | tail -10
npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(conjoined-grid): wire unified tab into Levels module"
```

---

### Task 6: Delete Old Code + Final Verification

**Files:**
- Delete: `src/lib/features/conjoined-lab/` (7 files)
- Delete: `src/lib/features/multi-grid-lab/MultiGridLabModule.svelte`

- [ ] **Step 1: Check for remaining references to conjoined-lab**

```bash
grep -rl 'conjoined-lab' src/ --include='*.ts' --include='*.svelte'
```

The TopologyCanvas.svelte imports `STRICT_HAND_POINT_COORDS` from conjoined-lab. Move this constant to the conjoined-grid domain types or to the shared multi-grid domain before deleting.

- [ ] **Step 2: Move STRICT_HAND_POINT_COORDS and EDGE_OPPOSITES**

Move `STRICT_HAND_POINT_COORDS` and `EDGE_OPPOSITES` from `src/lib/features/conjoined-lab/domain/types.ts` to `src/lib/features/conjoined-grid/domain/types.ts`. Update the import in `src/lib/shared/multi-grid/components/TopologyCanvas.svelte`.

- [ ] **Step 3: Check for DI registrations**

```bash
grep -r 'conjoinedLayout\|ConjoinedLayout' src/lib/shared/di/ --include='*.ts'
```

If `conjoinedLayoutCalculator` is registered in a DI container, decide whether to keep it (useful for 2-grid calculations) or remove it.

- [ ] **Step 4: Delete old directories**

```bash
rm -rf src/lib/features/conjoined-lab
rm -rf src/lib/features/multi-grid-lab
git add -A
```

- [ ] **Step 5: Verify no broken references**

```bash
grep -r 'conjoined-lab' src/ tests/ --include='*.ts' --include='*.svelte' -l
grep -r 'multi-grid-lab' src/ tests/ --include='*.ts' --include='*.svelte' -l
npm run check 2>&1 | tail -10
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(conjoined-grid): delete old conjoined-lab and multi-grid-lab"
```
