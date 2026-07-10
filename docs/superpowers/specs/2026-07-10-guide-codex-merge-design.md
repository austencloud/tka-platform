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
- Composes the Learn codex's real pieces (reuse, don't fork):
  `CodexSheetPicker`, the variations grid pattern (live `PictographContainer`
  per variation), `CodexControlPanel` (rotate/mirror/color-swap via
  `codex-pictograph-updater.ts`, applied to picker + variations together),
  `SegmentedControl` Diamond/Box, visibility chips (`FilterChipBase`).
  Data: `letterQueryHandler.getAllPictographVariations(gridMode)` (live app
  dataset, not letters.json).
- **Prop selector** (new capability): staff / club / buugeng / triad / fan /
  mini-hoop / hand — a `SegmentedControl` or chip row mapping to `PropType`
  values applied to every rendered `PictographData` (motions' `propType`) in
  picker, variations, and the companion payload. Persisted with the page's
  view state (localStorage, mirroring codex-explorer-persistence).
- **Companion = animator**: clicking a variation emits the existing
  `GuideSequenceClick` with a one-step strip for that variation, `key`
  `codex-<letter>-<variationIndex>`, and the selected prop. Widen the payload's
  `propType` from `"hand" | "staff"` to `PropType` (map through the companion →
  InlineAnimationPlayer chain; existing "hand"/"staff" callers keep working).
- Unlike artboard pages, this page is NOT print-faithful — it's an interactive
  app page inside the reader. /print and /book render the existing static
  codex sheets in its place (keep DoubleStaffCodexT12/36 wired for print-only
  if trivially possible; otherwise print shows the placeholder — print
  faithfulness for the codex remains the /guide/codex route's job).
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
