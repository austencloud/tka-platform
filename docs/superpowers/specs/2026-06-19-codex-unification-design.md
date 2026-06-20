# Codex Unification — Design

**Date:** 2026-06-19
**Status:** Approved design, pre-plan
**Author:** Austen + Claude

## Problem

The platform has two overlapping letter browsers built on the same data layer
(`CodexLetterMappingRepo` / `letterQueryHandler`):

- **Learn Codex** (`features/learn/codex/`) — overview grid (one glyph per
  letter, canonical Type 1–6 rows) → click → slide to `LetterDetailView`. Carries
  transform ops (rotate / mirror / colorswap / orientation) and learn integration
  (i18n, toast, haptics).
- **Lab Pictograph Explorer** (`features/lab/tabs/pictograph-explorer/`) —
  sidebar letter picker → all variations of the selected letter render inline,
  with rich controls (visibility toggles, turns override, Diamond↔Box live
  elemental reclassification, light/dark). Recently fixed to use the canonical
  Kinetic Alphabet letter set (`letter.ts`, verified via Flow Arts MCP
  `list_available_letters`).

This is duplication: two implementations, two homes, drifting capabilities. The
explorer has the better per-letter controls; the codex has the better transform
ops and integration. Neither persists view state across reloads.

## Decision

Unify into **one sidebar-model explorer** that becomes the learn **Codex tab**.
The lab Pictograph Explorer tab is retired. IA candidate B (sidebar → all
variations inline) won a real-component comparison at `/test/codex-ia` over
A (drill) and C (inline-expand).

## Disposition

| Action | Files |
|---|---|
| **New** — unified component | `src/lib/features/learn/codex/components/CodexExplorer.svelte` (promoted from `PictographExplorerLab`, enhanced) |
| **New** — persisted view state | `src/lib/features/learn/codex/state/codex-explorer-state.svelte.ts` |
| **Salvage in** | `CodexControlPanel` transform ops; canonical Type 1–6 row/section + type-color logic from `CodexPictographGrid` |
| **Delete husks** | `CodexTab.svelte`, `CodexComponent.svelte`, `LetterDetailView.svelte`, `CodexPictographGrid.svelte` |
| **Keep (data layer)** | `codex` service, `CodexLetterMappingRepo`, `letterQueryHandler`, `Canvas2DDirectRenderer`, `pictographPreparer`, `codex-state.svelte.ts` (transform-op methods) |
| **Retire lab tab** | remove `tab-definitions.ts` `pictograph-explorer` entry (~line 1097) + the id→component mapping + delete `src/lib/features/lab/tabs/pictograph-explorer/` |
| **Rewire** | `LearnTab.svelte` "codex" mode renders `CodexExplorer` instead of `CodexTab` |
| **Cleanup** | delete throwaway `src/routes/test/codex-ia/` (harness + `CodexInlineExpand.svelte`) once the IA is settled |

The data-layer transform methods already live in `codex-state.svelte.ts`
(`rotateAllPictographs`, `mirrorAllPictographs`, `colorSwapAllPictographs`) via
the `codex` service — reuse them; do not reimplement.

## Component architecture — `CodexExplorer.svelte`

Three regions, container-query layout (sidebar collapses above the grid on
narrow viewports, as the explorer does today).

### Sidebar (left)
- **Search box** (top): jump-to-letter filter over the letter buttons. Plain
  text input filtering the rendered button set — not a chip.
- **Letter map:** canonical Type 1–6 sections, color-coded per type (colors from
  the salvaged `CodexPictographGrid.letterTypeSections`: T1 `#36c3ff`,
  T2 `#6F2DA8`, T3 `#26e600`, T4 `#26e600`, T5 `#00b3ff`, T6 `#eb7d00`).
  **Text-glyph** letter buttons (decided — not mini-pictograph thumbnails).
  Letter set = the canonical alphabet already wired into the explorer
  (`LETTER_GROUPS`: A–V; W X Y Z Σ Δ Θ Ω; their `-` cross-variants; Φ Ψ Λ;
  Φ- Ψ- Λ-; α β γ).
- **Controls:** grid-mode (Diamond/Box `SegmentedControl`); visibility toggles
  (`FilterChipBase mode="toggle"` — see Primitives); transform ops (salvaged
  `CodexControlPanel`: rotate / mirror / colorswap / orientation); turns
  override (existing stepper); light/dark (`SegmentedControl`).

### Main pane (right)
- All variations of the selected letter, rendered through the real pipeline
  (`Canvas2DDirectRenderer` + `pictographPreparer`), one canvas per variation,
  as the explorer does today.
- Header: selected letter, variation count, grid mode.
- **Variation filter is DEFERRED** to a follow-up pass (out of scope here).

### State — `createCodexExplorerState()`
Factory + getters pattern (matches `code-style` / `state-management` skills).
Holds: `selectedLetter, gridMode, visibility{showGrid,showTKA,showTnD,
showElemental,showPositions,showReversals,showNonRadialPoints}, isDarkMode,
blueTurnsOverride, redTurnsOverride, searchTerm`.

**Persistence:** an `$effect` serializes the durable subset
(`selectedLetter, gridMode, visibility, isDarkMode, blueTurnsOverride,
redTurnsOverride`) to `localStorage` under a single key; init reads it back.
Reference pattern: `features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`
(`$effect` + `JSON.stringify` + `localStorage.setItem`). `searchTerm` is
session-only (not persisted). This is view chrome → localStorage, NOT Firebase
(Firebase is reserved for user collections).

## Data flow

1. Init: state factory loads persisted prefs; `letterQueryHandler
   .getAllPictographVariations(gridMode)` loads the dataframe; renderer
   initializes.
2. Select letter → `variations = allPictographs.filter(p => p.letter === sel)`.
3. Transform op → apply codex-service transform to the selected letter's
   variation array → re-render.
4. Turns override → clone variation, set turns, recompute `endOrientation`
   (`calculateEndOrientation`), re-render (existing logic, preserved).
5. Grid-mode change → reload dataframe for the new mode (elemental glyph
   reclassifies), re-render.
6. Any durable state change → `$effect` writes localStorage.

## Primitives & rules compliance

- **Visibility toggles** → `FilterChipBase mode="toggle"`
  (`shared/browse/components/filter-chips/FilterChipBase.svelte`), per
  `chip-primitives.md` (independent booleans, many-on). Today they are raw
  `<button class="toggle-btn">` — route them through the primitive.
- **Grid-mode + light/dark** → `SegmentedControl` (single-select), already used.
- **No checkboxes** anywhere (`no-checkboxes.md`).
- **No new renderer / picker** — reuse `letterQueryHandler`,
  `Canvas2DDirectRenderer`, `pictographPreparer`, `SegmentedControl`,
  `CodexControlPanel` (`never-hand-roll.md`).
- **No layout shift** on selection/count changes — reserve space for the
  worst-case header/count (`no-layout-shift.md`; `tabular-nums` on counts).

## Error handling

- Renderer / dataframe load failures: existing try/catch in the explorer's
  `init`/`renderAll`, surfaced via the codex's `error` + toast path salvaged
  from `CodexTab` (`toast.error`).
- Letter with no variations: existing "No variations found" empty state.
- Corrupt localStorage: guard the parse; fall back to defaults on throw.

## Testing / verification

- Type: `npm run check` green.
- Runtime: learn → Codex tab renders the unified explorer; every canonical
  letter (all 6 types, incl. `-` cross-variants) selects and renders its
  variations; transform ops mutate the shown variations; toggles/turns/grid-mode
  behave; reload restores persisted prefs.
- Retirement: lab Pictograph Explorer tab gone from the lab nav; no dead
  references (`npm run check` + grep for deleted symbols).
- Evidence per `verification-protocol.md` (runtime query / screenshot), not
  assertion.

## Out of scope (follow-ups)

- Main-pane variation filter (position / orientation / turns).
- Mini-pictograph-thumbnail sidebar density toggle.
- The third print/artboard codex in `(public)/guide/codex/` — different purpose
  (static reference sheets), untouched.
