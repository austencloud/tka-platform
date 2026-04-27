# Arrange Sidebar — Icon Rail + Pill Unification

**Date**: 2026-04-27
**Status**: Design — awaiting review

## Problem

The Arrange tab sidebar (CellEditorPanel) was rebuilt with a 5-pill tab nav that duplicated shared Viewer components instead of reusing them. 9 duplicate files were created. The implementation doesn't match the v4 mockups. Layout is cramped (pills can't fit "PLAYBACK" text), playback controls are in the wrong place, and a ModeToggle was added that nobody asked for.

## Decision

**Option B: Icon Rail + Breadcrumb** — selected over Option A (reuse Viewer's 3/2 grid pills) because:
- 44px vertical rail is the 2026 standard (VS Code, Figma, Discord, Linear)
- Breadcrumb enables natural scope drill-down (Grid → Cell → Layer)
- More vertical body space than pill grid
- Icons-only rail works at any sidebar width

## Architecture

### Layout

```
┌──────────────────────────────────────┐
│ ArrangeSidebar                       │
│ ┌──┬───────────────────────────────┐ │
│ │  │ Breadcrumb: Grid > Cell 3     │ │
│ │  ├───────────────────────────────┤ │
│ │  │ Layers: [L1 LOVE 8b] [+Add]  │ │
│ │  ├───────────────────────────────┤ │
│ │⚡│                               │ │
│ │🎨│    Active Pill Body           │ │
│ │▶ │    (scrollable)               │ │
│ │👁│                               │ │
│ │⬇ │                               │ │
│ │  ├───────────────────────────────┤ │
│ │  │ [Download Arrangement]        │ │
│ └──┴───────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ GridLayoutControls (collapsed)   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Layers section** sits between breadcrumb and pill body (per v4 mockup). Compact layer chips: color dots + sequence name + beat count + copy/remove buttons. "Add Layer (2/4)" button. Visible at Cell scope, hidden when drilled into Layer/Hand/Tip. This reuses the existing `LayerSection` from CellEditorPanel.

Transport controls (play/pause, scrubber, BPM chips) remain below the grid in `PlaybackBar.svelte`. They are NOT part of the sidebar.

### New Component: `IconRailNav.svelte`

Location: `src/lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte`

Shared component — not Arrange-specific. Consumes the same `PillSpec[]` as `DownloadPillNav`.

```typescript
interface IconRailNavProps {
  pills: PillSpec[];
  activeId: PillId | null;
  onSelect: (id: PillId) => void;
  onNavMount?: (el: HTMLElement) => void;
}
```

- 44px wide vertical rail
- Each pill renders as icon-only button (icon from `PillSpec.icon`)
- Active state: left-border accent (2px, `--pill-accent` color) + filled background
- Tooltip on hover showing label + summary
- Same keyboard nav as DownloadPillNav: arrow keys (up/down instead of left/right), Home/End
- `aria-pressed` pattern (same as DownloadPillNav, not tabs)
- `prefers-reduced-motion` respected

### New Component: `ScopeBreadcrumb.svelte`

Location: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ScopeBreadcrumb.svelte`

Arrange-specific — the Viewer doesn't have scope hierarchy.

```typescript
type ScopeLevel = "grid" | "cell" | "layer" | "hand" | "tip";

interface BreadcrumbSegment {
  level: ScopeLevel;
  label: string;
  icon?: string;          // e.g. color dot for hand/tip
}

interface ScopeBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onNavigate: (level: ScopeLevel) => void;
}
```

Renders: `Grid` › `Cell 3` › `L1` › `Left` › `Thumb` — each segment clickable to navigate up. Per v4 mockup, hand segments show prop color dots, tip segments show tip color dots. Only renders segments down to current scope depth.

### Shared Code Reuse

| Shared artifact | Location | Reuse |
|---|---|---|
| `PillId`, `PillSpec`, `buildPillSpecs` | `pill-nav/pill-types.ts` | Direct import |
| `pill-nav.css` | `pill-nav/pill-nav.css` | Import for accent glow variables, motion prefs |
| `PillBody.svelte` | `pill-nav/PillBody.svelte` | Body wrapper (desktop variant) |
| `pill-summaries.ts` | `pill-nav/pill-summaries.ts` | Summary text patterns |

### Pill Bodies — What Goes Where

Each pill body reuses existing section components. No new section components needed.

**Effects** (`PillId: "effects"`)
- `UnifiedEffectsSection` — effect type grid, trail mode, tip effect map, scope selector, channel matrix
- Summary: active effect name (e.g. "Fire", "None")

**Effort** (`PillId: "effort"`, label: "Style" in Arrange context)
Per v4 mockup, Style panel contains four subsections in order:
1. `TransformSection` — Mirror, Flip, Rotate, Swap, Rewind, Shift buttons (2×3 grid)
2. `ColorsSection` — prop color combo chips (Default Blue/Red, Alt 1, etc.)
3. `UnifiedEffortSection` — effort level, per-tip effort grid
4. **Visibility toggles** — Blue eye / Red eye buttons (per v4, lives here not in Display)
- Summary: effort level + color combo name (e.g. "Linear · Blue/Red")

**Playback** (`PillId: "playback"`)
- `SpeedSection` — speed multiplier display + slider (0.25x–2.0x) + preset buttons
- `OffsetSection` — beat offset increment/decrement
- `skipStartPosition` toggle (currently on PlaybackBar — move reference here, keep toggle functional in both places)
- Summary: speed + offset (e.g. "1.0x · +0")

**Display** (`PillId: "display"`)
- `DisplaySection` — Animation vs Choreo Card media type
- Summary: media type (e.g. "Animation")

**Export** (`PillId: "export"`)
- Download Arrangement button (primary action)
- Frame rate chips (30/60/120 fps)
- Resolution chips
- Summary: resolution + fps (e.g. "1080p · 30fps")

### Scope Behavior

The breadcrumb controls which scope the pill bodies edit:

| Scope | What changes |
|---|---|
| Grid | Global defaults — all cells inherit unless overridden |
| Cell | Per-cell overrides for selected cell |
| Layer | Per-layer overrides for selected layer within cell |

Currently `GridCell` has per-cell fields (`effect`, `speedMultiplier`, `effort`, etc.) and `TunnelLayerConfig` has per-layer fields (`beatOffset`, `propColors`, `transformStack`). The breadcrumb reads the correct scope from `cell-editor-panel-state.svelte.ts` which already has `scopeLevel` state.

### Looping Model

**Already implemented.** `CellCanvas.svelte:142` wraps each layer independently via modulo: `layerBeat % actualBeats`. Different-length sequences loop at their own pace. `skipStartPosition` (global toggle, defaults true) controls seamless loop vs showing start pose.

**No changes needed** for the sidebar unification. Future enhancement: per-cell `loopMode: "loop" | "hold"` to clamp at final beat instead of wrapping, for cases where a performer holds a pose while others continue.

## Cleanup — Files to Delete

All 9 duplicates in `cell-editor/pill-nav/`:
- `types.ts` — duplicate of shared `pill-types.ts`
- `ModeToggle.svelte` — unwanted Simple/Advanced toggle
- `PillNav.svelte` — inferior 5-in-a-row layout
- `ScopeSelector.svelte` — **KEEP** (segmented scope control for Cell/Layer/Hand/Tip within pill bodies). Rewire imports from duplicate `types.ts` to shared `pill-types.ts`. Different from breadcrumb — breadcrumb navigates hierarchy, ScopeSelector sets edit scope within a pill body.
- `bodies/EffectsPillBody.svelte` — replaced by direct `UnifiedEffectsSection` use
- `bodies/StylePillBody.svelte` — replaced by direct section composition
- `bodies/PlaybackPillBody.svelte` — replaced by direct section composition
- `bodies/DisplayPillBody.svelte` — replaced by direct `DisplaySection` use
- `bodies/ExportPillBody.svelte` — replaced by direct export controls

## Files Modified

| File | Change |
|---|---|
| `pill-nav/IconRailNav.svelte` | **NEW** — shared icon rail component |
| `cell-editor/ScopeBreadcrumb.svelte` | **NEW** — Arrange-specific scope nav |
| `cell-editor/CellEditorPanel.svelte` | Rewrite: replace ChipGrid + duplicate pill-nav with IconRailNav + ScopeBreadcrumb + section composition |
| `cell-editor/state/cell-editor-panel-state.svelte.ts` | Cleanup: remove `usePillNav` flag, keep `activePill`/`scopeLevel` |
| `sidebar/ArrangeSidebar.svelte` | Minimal — CellEditorPanel still mounts here |
| `pill-nav/pill-nav.css` | Add `--rail-width`, `--rail-icon-size` variables |
| `pill-nav/pill-types.ts` | No changes needed — `PillId`/`PillSpec` already correct |

## Non-Goals

- Mobile layout for Arrange sidebar (desktop-only for now)
- Per-cell loop mode toggle (future enhancement)
- Grid-level default editing (future — requires scope propagation)
- Changing transport controls below grid
