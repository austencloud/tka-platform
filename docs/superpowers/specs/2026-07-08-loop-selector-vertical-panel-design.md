# LOOP Selector → Thin Vertical Panel — Design

**Date:** 2026-07-08
**Status:** Draft (awaiting review)
**Area:** `src/lib/features/create/generate` — Generate tab LOOP type selector

## Problem

Tapping the **LOOP** card in the Generate tab opens a right-side panel
(`LOOPDrawer` → `LOOPExpandedOverlay`) whose content is jammed to the top, with
the rest of the panel transparent so the settings cards behind it bleed through.
A drag handle floats in that empty see-through zone, detached from any content.
It reads as unfinished and is inconsistent with the Customize panel, which pops
out from the same edge and looks correct.

## Root cause

The LOOP panel and the Customize panel use the **same `Drawer` primitive**
(`src/lib/shared/foundation/ui/Drawer.svelte`, right placement, side-by-side
layout). The difference is entirely in how each fills the drawer box:

| | CustomizeDrawer (correct) | LOOPDrawer (broken) |
|---|---|---|
| content wrapper | `.customize-drawer-content { height: 100% }` | `.loop-drawer-content` — no height, hugs content |
| inner overlay | `.customize-expanded-overlay { flex: 1; min-height: 0 }` | natural height; `grid-container { flex: 0 0 auto }` |
| backdrop | `customize-backdrop` spans sidebar→right, click-dismiss | base side-by-side backdrop only |
| result | fills full-height right panel | content pinned to top; transparent below |

In side-by-side mode the base CSS anchors a right drawer `top: --create-panel-top;
bottom: --create-panel-bottom` (`Drawer.css`), so the `<dialog>` **is**
full-height. Because `.loop-drawer-content` doesn't set `height: 100%`, the
gradient content only covers its own intrinsic height; the dialog's
`--sheet-bg: transparent` shows the page behind everything below it.

The handle (`.drawer-handle`, right placement) is positioned `top: 50%` of the
**full-height** dialog. Customize fills that height, so the handle lands beside
content. LOOP's content occupies only the top, so the handle floats at the
vertical center of the empty see-through region — the "weird handle."

Separately, the live LOOP panel is **content-sparse** (a 2-option mode toggle +
a 3×2 grid of 6 buttons). Even filled to full height it would leave a large
empty bottom, so filling alone fixes the bug but not the awkwardness.

## Decisions (locked with user, 2026-07-08)

1. **Form:** full-height right pop-out like Customize, but **thin**, with the 6
   LOOP types as a **vertical list** that fills the height. (Rejected: compact
   popover; minimal grid-fill.)
2. **Favorites:** rebuild into the new panel as a **compact chip row** of curated
   presets (star to pin), featured presets shown by default. (Rejected: drop;
   full preset cards; hide-until-starred.)
3. **Mode toggle:** keep **Single | Combo**, routed through the shared
   `SegmentedControl` primitive. (Rejected: unify into one novel list.)

## Design

### A. Drawer configuration (`LOOPDrawer.svelte`)

Mirror `CustomizeDrawer.svelte`:

- `.loop-drawer-content { height: 100% }` and override the overlay to
  `flex: 1; min-height: 0` (same pattern as
  `.customize-drawer-content > .customize-expanded-overlay`).
- Backdrop: give it a `loop-backdrop` class spanning
  `left: var(--desktop-sidebar-width, 0); right: 0; top: --create-panel-top;
  bottom: 0` (copy of the `customize-backdrop` rule) so a workspace click
  dismisses it.
- Width: cap thin —
  `.side-by-side-layout[data-placement="right"] { width: min(var(--create-panel-width, 400px), 400px); max-width: 100% }`.
  (Customize caps at 520; a single-column LOOP list wants ~400.)
- Keep the drag handle (default `dismissible`). It is the same handle Customize
  shows; once content fills the height it sits beside content, not in a void.

### B. Vertical-stack content (`LOOPExpandedOverlay.svelte` + `LOOPComponentGrid.svelte`)

- Add a prop `layout: "grid" | "list"` to `LOOPExpandedOverlay`, **default
  `"grid"`**. `LOOPDrawer` passes `layout="list"`. Default preserves the other
  two consumers unchanged: `LoopBentoBoard.svelte:319` and
  `routes/test/unified-generation/+page.svelte:314` (both call without the prop).
- `LOOPComponentGrid` gains the same `layout` prop. In `"list"` it renders a
  **single column** (`grid-template-columns: 1fr`) and passes
  `showDescription={true}` so each row uses `LOOPComponentButton`'s **existing**
  `with-description` horizontal layout (icon tile + label + description). No new
  button component — reusing what's built.
- Six description rows (from `loop-constants.ts`) fill the panel height:
  Rotated / Mirrored / Flipped / Swapped / Inverted / Rewound.
- Single mode: tap a row = apply immediately + close (existing `handleToggle`).
  Combo mode: rows multi-select with the existing check badge; Apply button
  stays pinned at the bottom, list scrolls between header and button.

### C. Quick Combos strip (favorites)

A compact horizontal wrap-row directly under the mode toggle, above the list.

- Data: `LOOP_PRESETS` (`loop-presets.ts`) — show `featured` presets by default;
  starred presets sort first. Persistence via `loop-favorites-manager.ts`
  (localStorage, keyed by preset `id`) — reused unchanged, gains a live consumer.
- Each chip: FontAwesome icon (via `FontAwesomeIcon`, **not** raw `{preset.icon}`
  text — `LOOPPresetCard.svelte:41` renders the icon name as literal text, a
  latent bug we avoid) + name; tap applies the combo
  (`preset.components` → `generateLOOPType` → `onChange` + close). A small star
  toggles favorite via `loopFavoritesManager.toggleFavorite(id)`.
- New lean component `LOOPQuickCombosStrip.svelte` (a chip row is a distinct,
  keep-separate chip type per `chip-primitives.md`; the base `FilterChipBase` is
  for filters, not preset-apply actions). Reason for new file: no existing
  component renders a preset-apply chip row correctly (the closest,
  `LOOPPresetCard`, has the icon bug and a full-width-row layout, and is
  orphaned).

### D. Mode toggle → SegmentedControl

Replace `LOOPModeSelector.svelte` usage in `LOOPExpandedOverlay` with
`SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`),
per `chip-primitives.md` (single-select group = SegmentedControl):

```svelte
<SegmentedControl
  options={[{ value: "single", label: "Single" }, { value: "combo", label: "Combo" }]}
  value={isMultiSelectMode ? "combo" : "single"}
  onchange={(v) => handleModeChange(v === "combo")}
  size="sm"
  color="accent"
/>
```

## Files

**Edit**
- `components/modals/LOOPDrawer.svelte` — drawer config (height, backdrop, width, `layout="list"`).
- `components/cards/LOOPExpandedOverlay.svelte` — `layout` prop; SegmentedControl; render `LOOPQuickCombosStrip` (list mode only).
- `components/modals/LOOPComponentGrid.svelte` — `layout` prop, single-column list mode.

**New**
- `components/modals/LOOPQuickCombosStrip.svelte` — compact preset chip row (reuses `LOOP_PRESETS`, `loop-favorites-manager`, `FontAwesomeIcon`, `generateLOOPType`).

**Delete (orphaned — grep-confirmed no live imports after the above)**
- `components/modals/LOOPSelectionPanel.svelte` — imported nowhere active (`LOOPCoordinator` comment confirms it was replaced by the in-place overlay).
- `components/modals/LOOPPresetsSection.svelte` — only used by `LOOPSelectionPanel`.
- `components/modals/LOOPModeSelector.svelte` — after the SegmentedControl swap, its only remaining consumer is `LOOPSelectionPanel` (also deleted).
- `components/modals/LOOPPresetCard.svelte` — only used by `LOOPPresetsSection`; superseded by the strip.

**Unchanged / reused (no edits)**
- `loop-favorites-manager.ts`, `loop-presets.ts`, `loop-constants.ts`,
  `LOOPComponentButton.svelte` (its `with-description` layout is reused as-is),
  `Drawer.svelte` / `Drawer.css`, `SegmentedControl.svelte`.

## Reuse justification (never-hand-roll)

- Panel: **reuse** `Drawer` primitive with the proven CustomizeDrawer config —
  no new drawer.
- Rows: **reuse** `LOOPComponentButton` `with-description` — no new button.
- Mode toggle: **reuse** `SegmentedControl` — deletes a hand-rolled toggle.
- Favorites data/persistence: **reuse** `LOOP_PRESETS` + `loop-favorites-manager`.
- Only genuinely new file is the chip strip, justified above (no correct existing
  preset-apply chip row).

## Deferred (out of scope)

- Saving **arbitrary** built combos as favorites. The store is keyed by curated
  preset `id`; free-combo persistence is its own scope.
- Any change to `LoopBentoBoard` / `test/unified-generation` (protected by the
  `layout` default).

## Verification plan

- `npm run check` clean (one full pass at the commit gate).
- Grep the diff: no new raw `class="chip"` filter buttons; no `type="checkbox"`;
  the four deleted files have no remaining importers.
- Runtime (dev :5174 or user check): open LOOP from Generate — panel fills the
  full-height thin right column, no see-through, handle beside content; 6 rows
  with descriptions; Single tap applies + closes; Combo multi-selects + Apply;
  Quick Combos chip applies a preset; star pins and persists across reload.
- Confirm `LoopBentoBoard` LOOP cell still renders the grid (default `layout`).

## Related

- `.claude/rules/chip-primitives.md`, `never-hand-roll.md`, `no-layout-shift.md`,
  `no-checkboxes.md`, `sequence-viewer-shell.md` (drawer-config-consistency precedent).
- Sibling pattern: `CustomizeDrawer.svelte` / `CustomizeExpandedOverlay.svelte`.
