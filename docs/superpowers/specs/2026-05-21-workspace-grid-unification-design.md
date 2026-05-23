# Workspace Grid Unification

## Problem

Three workspace grid components (`StandardGrid`, `TimelineGrid`, `SpotlightGrid`) independently define the same visual contract — background color, gap handling, border suppression, step animations, scroll wrapper, mandala fill, context menu, reduced-motion rules. ~150 lines of CSS and ~30 lines of script are copy-pasted across files with no shared contract.

This caused a real bug: `TimelineGrid` had `gap: 1px` while `StandardGrid` had `gap: 0`. On the Celestial (light) background, the sky bled through the 1px gaps between cells. The fix had to be applied to `TimelineGrid` independently — and `SpotlightGrid` still has the same `gap: 1px` bug (though it's dead code).

## Audit

`SpotlightGrid` is dead code. `isSpotlightMode` is declared as a prop with `default: false` in `StepGrid.svelte` but no parent ever passes `true`. Delete it.

That leaves two real components:

| Concern | StandardGrid | TimelineGrid | Same? |
|---|---|---|---|
| Scroll wrapper (`.step-grid-scroll`) | 40 lines | 40 lines (identical) | YES |
| Background fill | `var(--dm-pictograph-bg)` | `var(--dm-pictograph-bg)` | YES |
| Gap | `0` | `0` (was `1px`) | YES (after fix) |
| Border radius + overflow | `6px` + `hidden` | `6px` + `hidden` | YES |
| `--pictograph-border: none` | via `:global()` | via CSS var on cell | YES (different mechanism) |
| Clearing animation | `.clearing` class | `.clearing` class | YES |
| `.step-container` base + animation states | ~50 lines | ~50 lines (identical) | YES |
| `@keyframes` (2 animations) | 26 lines | 26 lines (identical) | YES |
| `@media (prefers-reduced-motion)` | 4 lines | 4 lines (identical) | YES |
| Mandala fill cells | Column empties | Start-column empties | DIFFERENT placement |
| Mandala context menu script | 30 lines | 30 lines (identical) | YES |
| `MandalaShow` type + constants | 3 lines | 3 lines (identical) | YES |
| **Layout strategy** | CSS Grid (`display: grid`) | Flexbox rows (`display: flex`) | DIFFERENT |
| Duration resize handles | None | DurationResizeHandle | DIFFERENT |
| Selected/practice highlight | Delegates to StepCell | Border-box gradient on cell | DIFFERENT |

~170 lines are identical. ~30 lines differ (layout + duration handles + highlight style).

## Design

Merge `StandardGrid` and `TimelineGrid` into a single `WorkspaceGrid.svelte`. Delete `SpotlightGrid.svelte`.

### Structure

```
WorkspaceGrid.svelte
├── Shared scroll wrapper
├── Shared grid surface (visual contract)
│   ├── {#if isTimelineMode}
│   │   ├── Start column (fixed width)
│   │   ├── Flexbox rows with duration-proportional cells
│   │   └── Duration resize handles
│   │
│   ├── {:else}   (standard mode)
│   │   ├── CSS Grid with uniform cells
│   │   └── Start position in grid cell (1,1)
│   │
│   └── Mandala fill cells (mode-aware placement)
│
├── Shared context menu
└── Shared keyframes + reduced-motion
```

### Visual contract (shared, defined once)

```css
.grid-surface {
  gap: 0;
  background: var(--dm-pictograph-bg, #0a0a0f);
  border-radius: 6px;
  overflow: hidden;
  --pictograph-border: none;
}

.grid-surface.clearing {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}
```

### Layout fork (the only divergence)

**Standard mode:** `display: grid; grid-template-columns: repeat(N, minmax(0, size));`

**Timeline mode:** `display: flex; flex-direction: row;` with nested `.timeline-rows` containing `.timeline-row` flex children. Each cell width = `calc(var(--cell-size) * var(--duration-multiplier))`.

### Props

Union of StandardGrid + TimelineGrid props, with timeline-specific ones optional:

- `isTimelineMode: boolean` (default false)
- `timelineRows`, `timelineUnitSize`, `timelinePadding` — only used when timeline mode
- `onDurationChange` — only used when timeline mode
- `gridLayout` — only used in standard mode (TimelineGrid uses `timelineUnitSize` directly)
- Everything else shared: `steps`, `startPosition`, `displayState`, `scrollState`, `selectedStepNumber`, etc.

### StepGrid.svelte changes

Remove `SpotlightGrid` import and the `isSpotlightMode` prop/branch. Replace `StandardGrid`/`TimelineGrid` conditional with single `WorkspaceGrid`:

```svelte
<WorkspaceGrid
  {steps}
  {startPosition}
  {isTimelineMode}
  {gridLayout}
  {timelineRows}
  {timelineUnitSize}
  {timelinePadding}
  {displayState}
  {scrollState}
  ...shared props...
  bind:scrollContainerRef
/>
```

### Files affected

| File | Action |
|---|---|
| `WorkspaceGrid.svelte` | CREATE — merged component |
| `StandardGrid.svelte` | DELETE |
| `TimelineGrid.svelte` | DELETE |
| `SpotlightGrid.svelte` | DELETE |
| `StepGrid.svelte` | UPDATE — remove spotlight branch, import WorkspaceGrid |

### PictographRenderer.svelte

Keep the `var(--pictograph-border, ...)` CSS custom property approach. WorkspaceGrid sets `--pictograph-border: none` on the grid surface, cascading to all children. No `:global()` needed.

## Risks

- **Regression in timeline-specific behavior** (duration resize handles, selected step gradient). Mitigated by preserving exact same markup + CSS within the timeline branch.
- **Component size** (~350-400 lines). Acceptable — the split into three components was premature and caused more harm (divergence bugs) than the file size would.

## Success criteria

1. `WorkspaceGrid.svelte` renders identically to current StandardGrid in standard mode
2. `WorkspaceGrid.svelte` renders identically to current TimelineGrid in timeline mode
3. No visible gaps on any background theme (especially Celestial)
4. Duration resize handles work in timeline mode
5. Clearing animation works in both modes
6. Mandala fill cells appear correctly in both modes
7. `npm run check` passes
8. StandardGrid, TimelineGrid, SpotlightGrid deleted with no remaining imports
