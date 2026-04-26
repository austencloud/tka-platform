# Unified Conjoined Grid Tab — Design Spec

## Goal

Merge the Conjoined Lab (Level 7) and Multi-Grid Lab into a single "Conjoined Grid" tab in the Levels module. Combines Multi-Grid's N-grid topology framework with Conjoined Lab's real pictograph data pipeline and overlap detection.

## Context

This tab is the prototype for production L7 conjoined grid support. Eventually every sequence will be viewable in conjoined form, and the Assemble tab will support building sequences that use conjoined grids natively — transitioning in and out of single-grid and multi-grid modes seamlessly.

## Architecture

**Base: Multi-Grid's topology framework.** The TopologyBuilder, TopologyRenderer, TopologyPositionEnumerator, and TopologyCanvas provide the N-grid infrastructure. The Conjoined Lab's CSV data pipeline and overlap detection are grafted onto this foundation.

### Component Hierarchy

```
ConjoinedGridTab.svelte          ← new unified entry point
  ConjoinedGridControls.svelte   ← topology presets, mode toggle, playback, navigation
  ConjoinedGridCanvas.svelte     ← renders grids + real pictograph props + junction overlaps
```

### Services (reused from existing code)

| Service | Source | Role |
|---------|--------|------|
| TopologyBuilder | multi-grid | Build N-grid arrangements from presets or fluent API |
| TopologyRenderer | multi-grid | Compute viewBox, coordinate transforms, grid positions |
| TopologyPositionEnumerator | multi-grid | Enumerate all (blue, red) position pairs across grids |
| TopologyPropLoader | multi-grid | Load prop SVGs with color + caching |
| TopologyBetaSeparator | multi-grid | Visual separation for overlapping beta props |
| ConjoinedLayoutCalculator | conjoined-lab | Grid position calculations for 2-grid arrangements |
| letterQueryHandler | shared (DI) | Load all pictograph variations from CSV |
| pictographPreparer | shared (DI) | Convert CSV data to render-ready format |

### New Services

| Service | Role |
|---------|------|
| JunctionOverlapDetector | Generalize conjoined lab's 2-grid overlap detection to N junctions. For each junction point, check if any prop's end position lands within tolerance of the junction. |
| PictographTopologyMapper | Map a pictograph's blue/red props onto a topology's grids. For a 2-grid topology: blue on grid A, red on grid B. For N grids: distribute props based on grid assignment rules. |

## Data Flow

### Browse Pictographs Mode

1. User selects topology preset (default: 2-grid horizontal chain)
2. TopologyBuilder creates GridTopology with junction points
3. letterQueryHandler loads all pictograph variations for the topology's grid mode(s)
4. PictographTopologyMapper assigns each pictograph's props to grids
5. User navigates pictographs (prev/next, or overlap-only filter)
6. For each pictograph, JunctionOverlapDetector flags junction collisions
7. ConjoinedGridCanvas renders grids with real SVG props at calculated positions

### Explore Positions Mode

1. User selects topology preset
2. TopologyPositionEnumerator generates all (blue, red) position pair combinations
3. Playback auto-cycles through pairs, or user clicks to place manually
4. JunctionOverlapDetector flags overlaps at each junction
5. ConjoinedGridCanvas renders props at enumerated positions

### Mode Toggle

A segmented control switches between "Browse" and "Explore":
- **Browse**: Real pictograph data, letter navigation, overlap filtering
- **Explore**: Synthetic position pairs, playback controls, click-to-place

Both modes share the same canvas, topology, and overlap detection.

## State

```typescript
// Topology
selectedPresetId: string           // which topology preset
topology: GridTopology             // derived from preset via TopologyBuilder

// Mode
activeMode: "browse" | "explore"

// Browse mode state
allPictographs: PictographData[]   // loaded from CSV
selectedPictographIndex: number
showOverlapsOnly: boolean
overlappingIndices: number[]       // derived: indices where junction overlap detected

// Explore mode state
allPairs: PositionPair[]           // derived from topology
currentPairIndex: number
isPlaying: boolean
playbackSpeed: number
manualPlacement: boolean
manualBlueRef: GridLocation | null
manualRedRef: GridLocation | null

// Shared
junctionOverlaps: JunctionOverlap[] // derived: active overlaps for current state
```

## Topology Presets

Carry over all 9 Multi-Grid presets. The 4 Conjoined Lab layout arrangements (left-right, top-bottom, diagonals) map to 2-grid chain presets with different conjoined edges.

| Preset | Grids | Description |
|--------|-------|-------------|
| 2-chain-h | 2 | Horizontal chain (default, matches conjoined lab's left-right) |
| 2-chain-v | 2 | Vertical chain (matches conjoined lab's top-bottom) |
| 2-chain-diag | 2 | Diagonal chain |
| 3-chain | 3 | Three grids in a row |
| 3-row | 3 | Three grids in a column |
| 2x2 | 4 | 2x2 grid arrangement |
| box | 4 | Box arrangement |
| mixed-2 | 2 | Diamond + Box mixed modes |
| mixed-3 | 3 | Diamond + Box + Diamond chain |

## Junction Overlap Detection

Generalized from conjoined lab's 2-grid logic:

1. For each junction in the topology, get the world-space coordinate
2. For the current pictograph (browse mode) or position pair (explore mode), get each prop's end position in world-space
3. If any prop's end position is within tolerance (5px equivalent in abstract coords) of a junction point, flag it
4. Overlap = two props from different grids both ending at the same junction

Output: `JunctionOverlap[]` with junction ID, involved grids, involved prop colors, distance.

## UI Layout

Desktop: canvas left (flex: 1), controls right (320px sidebar).
Mobile: canvas top (40vh), controls bottom (scrollable).

### Controls Sidebar

1. **Topology preset selector** (dropdown)
2. **Mode toggle** (Browse / Explore segmented control)
3. **Browse mode controls** (when active):
   - Pictograph navigation (prev/next, index display)
   - "Overlaps only" toggle with count badge
   - Overlap navigation (prev/next overlap)
   - Copy metadata button
4. **Explore mode controls** (when active):
   - Playback controls (play/pause, step, speed slider)
   - Pair index input
   - Placement mode toggle (auto-cycle vs click-to-place)
   - Blue/Red placement selector (when manual)
5. **Junction overlap indicator** (shared, both modes):
   - List of active overlaps with junction ID and involved props
   - Visual highlight on canvas at overlap points

## Migration

### What gets deleted
- `src/lib/features/conjoined-lab/` (7 files) — functionality absorbed
- `src/lib/features/multi-grid-lab/MultiGridLabModule.svelte` (1 file) — entry point replaced
- Multi-Grid lab tab entry in LAB_TABS
- Level 7 (conjoined) tab entry in LEVELS_TABS

### What gets kept
- `src/lib/shared/multi-grid/` (all services, components, domain) — reused as-is
- ConjoinedLayoutCalculator — may be useful for 2-grid-specific layout math

### What gets created
- `src/lib/features/conjoined-grid/ConjoinedGridTab.svelte`
- `src/lib/features/conjoined-grid/components/ConjoinedGridControls.svelte`
- `src/lib/features/conjoined-grid/components/ConjoinedGridCanvas.svelte`
- `src/lib/features/conjoined-grid/services/contracts/IJunctionOverlapDetector.ts`
- `src/lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector.ts`
- `src/lib/features/conjoined-grid/services/contracts/IPictographTopologyMapper.ts`
- `src/lib/features/conjoined-grid/services/implementations/PictographTopologyMapper.ts`
- `src/lib/features/conjoined-grid/domain/types.ts`
- `src/lib/features/conjoined-grid/state/conjoined-grid-state.svelte.ts`

### Tab registration
Replace Level 7 tab in LEVELS_TABS with:
```typescript
{
  id: "conjoined-grid",
  label: "Conjoined Grid",
  icon: '<i class="fas fa-link" aria-hidden="true"></i>',
  description: "N-grid topology explorer with real pictograph data",
  color: "#10b981",
  gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
}
```

Remove multi-grid from LAB_TABS.

## Success Criteria

1. All 9 topology presets render correctly with real pictograph data (in browse mode)
2. Overlap detection works at every junction point, not just 2-grid
3. Playback auto-cycles through position pairs with correct rendering
4. Click-to-place works on any grid's hand points
5. Mode toggle switches between browse and explore without losing topology state
6. `npm run check` passes, `npm run build` passes
