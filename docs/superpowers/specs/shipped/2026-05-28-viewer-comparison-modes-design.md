# Sequence Viewer — Comparison Modes (replace dual pane pickers)

**Date:** 2026-05-28
**Status:** Design — pending user review
**Area:** `src/lib/shared/sequence-viewer/`

## Problem

The side-by-side view exposes **two independent dropdown pickers** (`PaneContentSelector`, one per pane), each offering all four content types. This is wrong for a single-sequence viewer:

- It lets the user build nonsense layouts (2D+2D, card+card) — duplicate panes.
- Two symmetric "configure each slot" pickers feel like a miniature compose module. The viewer shows **one** sequence at a time; comparing two arbitrary panes is not its job.
- The intended primary view (animation left, card right) is buried behind two dropdown interactions.

Austen's framing: the four contents are not peers. Some pairings have real value; the duplicates have none. He wants the picker to feel intuitive and **not overwhelming** (the full 6-combo enumeration is too many options).

## Content families

- **Live views** — `animation` (2D), `animation-3d` (3D): the sequence playing.
- **Still views** — `card`, `mandala`: static lenses on the whole sequence.

Value ranking (Austen's words): 2D+Card (primary) > 3D+Card ≈ 2D+3D ("cool") ≈ 2D+Mandala > 3D+Mandala (small) > Card+Mandala (small).

## Solution — single "Comparison modes" bar

Replace **both** `PaneContentSelector` instances with **one** always-visible segmented row at the split-container level (reads like tabs, one tap, no menu to open).

```
   ┌─────────┬─────────┬────────┬────────────┐
   │ 2D+Card │ 3D+Card │ 2D+3D  │ 2D+Mandala │
   └────●────┴─────────┴────────┴────────────┘
        default
```

### Modes (value-ordered) and layout mapping

Animation is always on the **left**, still always on the **right** (per Austen). For 2D+3D, 2D (the familiar view) is left.

| Mode label   | `leftPane`      | `rightPane`     |
|--------------|-----------------|-----------------|
| 2D + Card    | `animation`     | `card`          |
| 3D + Card    | `animation-3d`  | `card`          |
| 2D + 3D      | `animation`     | `animation-3d`  |
| 2D + Mandala | `animation`     | `mandala`       |

Default mode: **2D + Card** (matches current default `{ animation, card }`).

### Dropped pairings

`3D + Mandala` and `Card + Mandala` are omitted (Austen rated both "small value"). They remain expressible in the underlying `SplitConfig` and can be re-added as mode entries later without schema change.

## Why this fixes the problem

- **No duplicate panes possible** — only valid pairs are expressible through the bar.
- **No "mini-compose" feel** — you pick *a comparison*, not two arbitrary slots.
- **No dropdown** — flat, glanceable, one tap. Directly answers "too many options."

## Components

### New: `ComparisonModeBar.svelte`
`src/lib/shared/sequence-viewer/components/ComparisonModeBar.svelte`

- Props: `current: ComparisonMode`, `onSelect: (mode: ComparisonMode) => void`.
- Renders a segmented row of mode chips. Extends the existing `selector-chip` visual language from `PaneContentSelector` (dark translucent pill, accent for active) — **not new infra**; reuses the established chip styling and design tokens.
- Active chip uses `aria-pressed`; row is `role="group"` / `aria-label="Comparison mode"`. No checkboxes.
- Hidden when a pane is focused/expanded (focus mode = looking at one thing) and during export (`isExporting`).

### Modified: `ViewerSplitPane.svelte`
- Remove the two `<PaneContentSelector>` usages (lines ~367, ~552) and the import.
- Render one `<ComparisonModeBar>` at the split-container level (top-center floating overlay), not inside either pane, so it survives focus-mode pane resizing.
- Derive `current` mode from `splitConfig` via `splitConfigToMode()`.
- On select, map mode → `{leftPane, rightPane}` and apply atomically.

### Modified: `viewer-state.svelte.ts`
- Add `setSplitConfig(config: SplitConfig)` for an atomic both-pane update + single persist (avoids the double-persist of calling `setSplitPaneContent` twice).
- Keep `setSplitPaneContent` (still used elsewhere / export paths).

### New mapping helpers (in `viewer-state-persistence.ts`)
```ts
export type ComparisonMode = '2d-card' | '3d-card' | '2d-3d' | '2d-mandala';

export const COMPARISON_MODE_LAYOUTS: Record<ComparisonMode, SplitConfig> = {
  '2d-card':    { leftPane: 'animation',    rightPane: 'card' },
  '3d-card':    { leftPane: 'animation-3d', rightPane: 'card' },
  '2d-3d':      { leftPane: 'animation',    rightPane: 'animation-3d' },
  '2d-mandala': { leftPane: 'animation',    rightPane: 'mandala' },
};

// Reverse-map a stored SplitConfig to the closest mode for highlighting.
// Falls back to '2d-card' when the stored config is a dropped/legacy pairing.
export function splitConfigToMode(config: SplitConfig): ComparisonMode { ... }
```

## State / persistence

- `SplitConfig { leftPane, rightPane }` is **unchanged** — it stays the stored shape and the contract `ViewerSplitPane`'s render switch reads. Each mode maps to a fixed `SplitConfig`.
- localStorage key `tka-viewer-split-config` unchanged. Existing stored configs (including dropped pairings) still load; `splitConfigToMode` resolves them to the nearest highlighted mode without mutating storage until the user picks.
- `videos` content type is untouched (already not in the picker).

## Render switch (untouched)

`ViewerSplitPane` already renders each pane by `splitConfig.leftPane` / `splitConfig.rightPane` (`animation` → `AnimatorCanvas`, `animation-3d` → `Viewer3DCanvas`, `card` → `ChoreoCard`, `mandala` → `MandalaPane`). No change to that logic — the bar only changes *which* `SplitConfig` is set.

## Out of scope

- Pane swap / drag-to-reorder (animation-left is fixed for now).
- Re-adding 3D+Mandala / Card+Mandala (trivial later; one entry each).
- Single-pane viewer modes (`animation`, `card`, etc.) — those are separate `ViewerMode` paths, not the split view.

## Testing

- Unit: `COMPARISON_MODE_LAYOUTS` round-trips through `splitConfigToMode` for all four modes; dropped/legacy configs resolve to a valid mode.
- Runtime: each mode renders the correct two panes (verify in browser on :5173 with a loaded sequence); active chip reflects persisted mode on reload; bar hides in focus mode and during export.
- Grep diff for `type="checkbox"` (none expected).
