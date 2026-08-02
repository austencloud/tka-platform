# Guide Codex Merge — Interactive Codex Inside the Reader, Codex Tab Retired

Date: 2026-07-10. Approved by Austen.

## Problem

- The guide's letter-catalog section is broken/incomplete: `bl-clubs`,
  `bl-buugeng`, `bl-triads`, `bl-fans`, `bl-mini-hoops` have no components
  (blank numbered placeholders); `bl-double-staff` / `bl-double-staff-36` are
  static staff-only print-sheet embeds with no interactivity and no companion
  hookup.
- The Learn module's Codex tab (CodexExplorer) already has the interactive
  experience (letter picker, live variation grid, codex-wide
  rotate/mirror/color-swap, diamond/box, visibility chips) — but lives in a
  separate tab and has NO prop switching.

Directive: put the codex experience inside the guide reader as the catalog
section, add prop switching, keep the right-side companion as the animator,
retire the Learn Codex tab.

## Design

### 1. GuideCodexPage (new interactive body page)

- Replaces the 7 manifest entries (`bl-double-staff`, `bl-double-staff-36`,
  `bl-clubs`, `bl-buugeng`, `bl-triads`, `bl-fans`, `bl-mini-hoops`) with ONE
  entry: `id: "codex"`, title "Codex", group "1.1". Deep link
  `/learn/guide/codex` (manifest ids are slugs automatically).
- **REVISED 2026-07-10 after Austen rejected v1** (v1 put an explorer-style
  layout + control bar ON the page, gray cells, broken layout): the page IS
  the printable codex — visually identical to the /guide/codex print sheets
  (white paper, CodexSheet/CodexBox/CodexCell grid, no on-page controls),
  serving print and interactive "identically". ALL interactivity lives in the
  reader's right companion panel, which swaps contextually (as it does for
  sequence animation): when the active page is the codex, the panel shows the
  codex controls.
- **Companion codex controls** (`GuideCodexControls`): prop selector (staff /
  club / buugeng / triad / fan / mini-hoop / hand), visibility toggles
  (glyph/grid/TKA/positions/reversals/non-radial), rotate/mirror/color-swap
  transforms (codex-wide, via `codex-pictograph-updater` semantics — this is
  how variations are browsed). Shared module-level `$state`
  (`guide-codex-state.svelte.ts`, localStorage-persisted) drives the sheet
  live; /print and /book render the same sheets with default state (staff,
  all layers visible, no transforms) — identical layout, byte-identical
  /guide/codex print route preserved via optional props with print defaults.
- **Companion = animator**: clicking a sheet cell emits the existing
  `GuideSequenceClick` with a one-step strip, key `codex-<letter>-<idx>`, and
  the selected prop. Payload `propType` widened from `"hand" | "staff"` to
  `PropType` (existing string callers keep working).
- Guide overrides do NOT apply to codex variations (dataset is canonical).

### 2. Learn Codex tab retirement

- `LearnTab.svelte`: remove `"codex"` from LearnMode/TAB_ORDER/branches.
- `tab-definitions.ts`: remove the LEARN module `id: "codex"` entry. Do NOT
  touch the Choreo Card module's separate `id: "codex"` ("Codex Print") entry.
- `navigation-coordinator.svelte.ts:371` learn list: drop `"codex"`.
- Voice control (`action-catalog.ts`, `navigation-sub-interpreter.ts`):
  "dictionary/reference" intents → navigate to the guide tab (mode `guide`),
  reader deep link `/learn/guide/codex` where a URL is usable.
- TIKA `app-capabilities-manifest.ts` `learn-codex` entry: repoint to the
  guide codex page.
- `screenshot-orchestrator.ts`: drop the `learn--codex` entry.
- `routes/test/codex-redesign`: delete (harness for the retired tab).
- Saved nav state: users with persisted `currentLearnMode === "codex"` must
  fall back gracefully (existing unknown-mode fallback or map to "guide").
- KEEP: `services/codex.ts`, `get-codex.ts`, `codex-pictograph-updater.ts`,
  letter-mapping repo (Quiz tab + win95 retro tutor depend on them);
  `CodexExplorer.svelte` itself is deleted once the guide page is live;
  `/guide/codex` print route and Choreo Card Codex Print stay.

## Testing

- `npm run check` clean; guide unit tests still pass.
- CDP: open `/learn/guide/codex` (via test harness), click a variation,
  companion animates; transforms + prop switch change the grid.
- Grep-proof: no remaining imports of `CodexExplorer`; Learn tab list has no
  codex; Choreo Card codex entry untouched.

## Non-goals

- Changing the /guide/codex print route or Choreo Card printing.
- Touching the Codex service layer used by Quiz/retro.
- Prop-specific placement tuning (renderer's existing prop support is used
  as-is).
