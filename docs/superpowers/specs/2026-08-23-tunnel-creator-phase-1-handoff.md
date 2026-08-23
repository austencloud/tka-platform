# Tunnel Creator Phase 1 — Handoff (2026-08-23)

## Mission

Build a dedicated Tunnel authoring tab inside Create that combines complete
two-prop sequences into a multi-performer composition. The visible first step
has two performers, but the state, composition, persistence, and renderer
contracts must scale to eight without another model replacement. Phase 1 brings
Tunnel up to Generate recipe parity for each performer; later phases add Shape
Matrix/source tools, the full roster, and result/recovery parity. The approved
design and four manual gates live in
[`docs/superpowers/specs/active/2026-08-21-tunnel-creator-design.md`](active/2026-08-21-tunnel-creator-design.md).

## Done — verified

All items below are verified in the live working tree but are **uncommitted**
(commit SHA: none). Do not describe them as shipped.

### Scalable composition domain and transform correctness

- `TunnelComposition` owns an ordered stable-ID performer roster; sources may
  be independent or derived. The model validates up to eight authored
  performers, rejects relationship cycles, and computes the least common
  multiple of source lengths and speeds.
- An 8-step sequence paired with a 10-step sequence resolves to a 40-step
  composition cycle instead of trying to force either source through the
  other's generation expansion.
- Pairing transforms and formation placement are separate. The layer builder
  exposes `performerSequence` after source transforms and before formation
  transforms, normalizing derived grid/arrow fields after each operation. This
  is the fix for the 45-degree pairing that entered box mode while its arrows
  remained at diamond locations.
- Evidence:
  `pnpm exec vitest run tests/unit/tunnel-composition.test.ts --exclude ".codex-tmp/**" --exclude ".claude/worktrees/**"`
  passed 7/7 on 2026-08-23 as part of the five-file Tunnel run (38/38 tests
  passed outside the separately configured handoff file).
- Primary files:
  `src/lib/shared/sequence-viewer/tunnel/tunnel-composition.ts`,
  `src/lib/shared/sequence-viewer/tunnel/tunnel-layer-builder.ts`, and
  `tests/unit/tunnel-composition.test.ts`.

### Performer-scoped Phase 1 state and draft recovery

- The creator state is an ordered performer-slot collection rather than
  `lead`/`partner` storage, while the current UI still presents two slots.
- Every slot retains a picked/generated origin, independent source, stable ID,
  timing, and a bounded Previous stack (12 entries).
- Separate and Linked modes preserve the independent Performer 2 source; Linked
  rebuilds Performer 2 whenever Performer 1 changes.
- Draft schema version 3 persists the composition, source snapshots, Previous
  history, source origin, pairing rule, editing identity, open workspace panel,
  and active generation target. Versions 1 and 2 migrate forward.
- A newly opened browser tab restored a persisted 40-step Performer 1 and its
  open generation recipe on 2026-08-22. Actual Vite HMR while editing source
  was not repeated after the final sizing change.
- Evidence:
  - `tunnel-creator-draft.test.ts` 4/4 passed.
  - `tunnel-relationship-rule.test.ts` 1/1 passed.
  - `tunnel-creator-state.test.ts` 6/6 passed.
  - `pnpm exec vitest run tests/unit/tunnel-creator-handoff.test.ts --environment jsdom --exclude ".codex-tmp/**" --exclude ".claude/worktrees/**"`
    passed 2/2.
- Primary files: the untracked directory
  `src/lib/features/create/tunnel/`, especially
  `state/tunnel-creator-state.svelte.ts`,
  `domain/tunnel-creator-draft.ts`, and `TunnelTab.svelte`.

### Hosted Generate recipe and instance-scoped animation

- Each independent performer can choose an existing sequence, generate
  immediately with the current recipe, open generation settings, or restore
  Previous.
- Tunnel hosts the existing `GeneratePanel`; it does not reimplement recipe
  controls. `GeneratePanel` now exposes a bindable `generateCurrent` action so
  the performer card's Generate button runs the exact open recipe.
- Embedded generation receives an instance-scoped `GenerationAnimationTarget`.
  It clears/prepares the chosen performer's `StepGrid`, avoiding the old global
  window events that would animate neighboring workbenches.
- The generation panel remains mounted, slides into the right-hand inspector on
  large displays, and becomes the existing Create drawer on smaller displays.
  Tunnel settings and Pairing use the same non-obscuring right-hand track.
- Loop configuration reconciliation preserves an exact requested length when a
  selected LOOP rhythm can be fitted. The pure rhythm owner passed 8/8 tests;
  the 10-step integration test exists but currently hits the protobuf test
  environment issue recorded under Gotchas before collecting tests.
- Primary files:
  `src/lib/features/create/generate/components/GeneratePanel.svelte`,
  `src/lib/features/create/generate/state/generate-actions.svelte.ts`,
  `src/lib/features/create/generate/state/generate-config.svelte.ts`,
  `src/lib/features/create/tunnel/components/TunnelLayout.svelte`, and
  `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`.

### Live performer notation and responsive grid sizing

- Performer panels use the shared live `StepGrid` and `WordLabel`, not static
  Choreo Card screenshots. Generated and transformed sources therefore update
  their SVG props, grid mode, arrows, mandalas, and generation reveal in place.
- Repeated display words use the canonical simplifier (`JΦJΦJΦJΦ` displays as
  `JΦ`) and appear in the notation's existing word rail instead of duplicated
  metadata below the performer name. Word simplifier tests passed 34/34.
- The workbench `.scroll-wrapper` remains because it reserves hover/selection
  breathing room and provides vertical scrolling. Tunnel now requests the
  shared grid's readability profile: four step columns on wide cards, three at
  the screenshot-sized card, and two at phone widths.
- Pure layout evidence on 2026-08-22:
  - 8 steps in a 585×402 sizing box changed from 5 total columns at 108px to
    4 total columns at 136px.
  - 40 steps in a 950×349 sizing box changed from 9 total columns at 61px to
    5 total columns at 178px.
  - `tests/unit/create-workspace-grid-layout.test.ts` passed 20/20.
- Runtime visual evidence on 2026-08-22 used a task-owned Chrome DevTools tab at
  1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, and 375×667.
  Settled cells measured 152px, 158px, and the 200px ceiling at the three 4K
  tiers. There was no document horizontal overflow and no console warning or
  error. Temporary frames remain at
  `C:\Users\Austen\AppData\Local\Temp\tunnel-grid-exact-*.webp` if Windows has
  not cleaned them.
- Primary files:
  `src/lib/features/create/tunnel/components/TunnelPerformerCard.svelte`,
  `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`,
  and `tests/unit/create-workspace-grid-layout.test.ts`.

### Current compile state

- `pnpm exec svelte-check --tsconfig ./tsconfig.json` reported 0 errors and 0
  warnings on 2026-08-23.
- Prettier reported all three files touched by the final grid-sizing pass clean:
  `StepGrid.svelte`, `TunnelPerformerCard.svelte`, and
  `create-workspace-grid-layout.test.ts`.

## Believed done — unverified

- Phase 1 appears functionally complete, but Austen has not performed the final
  manual acceptance gate after the most recent persistence, generation-button,
  transform-normalization, and grid-sizing fixes.
- Full recipe parity is achieved by hosting `GeneratePanel`, but every recipe
  control has not been clicked inside both performer scopes in one final run.
- Draft restoration has been observed on a new browser tab, but true hot module
  replacement should still be triggered while the generation panel is open to
  prove the panel, performer target, both sources, and Previous history survive
  together.
- Tunnel settings and Pairing visually use the inline inspector at large sizes,
  but the final acceptance run should reopen each one while both performer
  notation cards are populated and confirm the cards plus animation remain in
  view.
- Save/share/reopen/export parity is Phase 4. `Open viewer`/`Preview changes`
  is wired now, but it is not a substitute for that later acceptance gate.

## In flight

- Branch: `main`.
- Base HEAD when this handoff was written:
  `2613cdcea50c95bf551d46d37b46537258c3d038`.
- `origin/main` matched that SHA before the handoff commit.
- No branch or worktree was created.
- The entire `src/lib/features/create/tunnel/` directory is untracked. It is the
  easiest part of this work to lose accidentally.
- Also untracked and central:
  `src/lib/shared/sequence-viewer/tunnel/tunnel-composition.ts`,
  `tests/unit/tunnel-composition.test.ts`,
  `tests/unit/tunnel-creator-handoff.test.ts`, and the approved active design
  spec.
- Modified tracked files used by this feature include the Generate panel/config
  and actions, Create routing/shell files, `StepGrid.svelte`,
  `WorkspaceGrid.svelte`, the tunnel layer builder/controller/art view, Tunnel
  collection persistence/opening, and several Viewer integration files.
- The checkout contains hundreds of unrelated modified, deleted, staged, and
  untracked files from concurrent work. Some adjacent Create, Viewer, Tunnel
  Collection, and shared primitive files are mixed-ownership. Inspect hunks
  before attributing or committing them.
- Never run `git add .`, `git add -A`, a bare `git commit`, reset, checkout, or
  cleanup commands in this checkout. Commit only explicit audited paths.

## Loose ends (ranked)

1. **Run Austen's Phase 1 acceptance gate and stop for his verdict.** Explain it
   like this:
   1. Open **Create**, then choose **Tunnel** in the Create navigation.
   2. Select **Separate** at the top.
   3. In **Performer 1**, click **Generation settings** (sliders), change a
      clearly visible recipe item such as Length, then click the large green
      **Generate** button in the right panel.
   4. In **Performer 1**, click the pink dice **Generate** button again and then
      the clock **Previous** button; confirm the previous pictographs return.
   5. In **Performer 2**, generate a different sequence or choose one with the
      folder button.
   6. Switch to **Linked**, open **Edit pairing**, choose a 45-degree rotation,
      and confirm Performer 2's notation and the tunnel animation both update;
      arrows and box/diamond mode must agree.
   7. Reopen **Tunnel settings** and confirm it uses the same right-hand track,
      leaving notation and animation visible on a large screen.
   8. With the generation panel still open, cause one ordinary source-file HMR
      (or let the next coding edit do it). Confirm the panel, selected performer,
      both sequences, and Previous still exist.
      Do not start Phase 2 until Austen explicitly accepts this phase.
2. **Resolve or accurately quarantine the Generate config test collector
   failure.** Running
   `generate-config-noop-writes.test.ts` currently fails during module import
   with `TypeError: util.Long.fromNumber is not a function` inside
   `protobufjs`, before its five tests collect. The pure loop rhythm suite is
   green, but the exact 10-step `createGenerationConfigState` integration case
   still needs executable proof.
3. **If Phase 1 is accepted, begin Phase 2 from the approved spec:** expose the
   full interactive two-hand Shape Matrix, explicit matrix result and hand-path
   mode, then Build/Adjust/Inspect/Save routes while keeping the selected
   performer's live notation and tunnel animation visible. Reuse the existing
   Shape Matrix and Create source-tool owners; do not build parallel controls.
4. **Before any feature commit, audit mixed shared-file hunks.** The user asked
   for implementation phases, not a broad shared-checkout commit. Split only
   after ownership is known, and keep all unrelated staged changes intact.

## Decisions already made

- On 2026-08-21 Austen chose a dedicated Tunnel tab inside Create. Fuse remains
  one-hand-plus-one-hand into one complete performer; Tunnel combines complete
  performers into an ensemble.
- The model scales to eight authored performers from day one even though the
  current UI exposes two.
- The performers are **Performer 1** and **Performer 2**. Do not call Performer
  1 “Lead,” and do not place red/blue dots beside performer names; red and blue
  mean right/left props elsewhere in the product.
- There is one sequence chooser per performer card. The result preview does not
  present a duplicate chooser.
- With only Performer 1 selected, immediately animate Performer 1 on the right
  and show guidance to choose Performer 2. Do not hide the animation behind an
  empty result state.
- Performer cards show the same live workbench notation behavior as Generate,
  including generation reveal, prop changes, transformed arrows/grid mode,
  mandalas, QR treatment where the shared grid owns it, and simplified word
  display.
- The action that opens recipe controls is **Generation settings**. The dice
  **Generate** action always generates immediately from the current recipe;
  opening a panel and generating must not be two meanings of the same click.
- Settings, Pairing, and Generation slide into a right-hand workspace track on
  large displays so the notation cards and animation remain visible. Smaller
  screens use the existing Create drawer/bottom-sheet behavior.
- Unequal source lengths are valid. The composition plays until the least common
  multiple returns the cast to the seam; 8 against 10 is 40 steps.
- The `.scroll-wrapper` is not to be removed. It owns safe overflow and hover
  breathing room. Tunnel requests a different shared grid sizing policy.
- Work proceeds in four phases with a manual Austen gate after every phase.

## Gotchas

- The active design's early “First release” paragraph still contains the word
  **Lead**. The later user decision and current code/tests supersede that stale
  wording: use Performer 1.
- Port 5173 is Austen's HTTPS/2 VS Code server. Never start, stop, or kill it;
  use `https://localhost:5173/create/tunnel`.
- Vitest discovers copies in `.codex-tmp` and `.claude/worktrees` unless both
  are explicitly excluded. Those copies can fail because they lack generated
  `.svelte-kit/tsconfig.json` files.
- `tests/unit/tunnel-creator-handoff.test.ts` needs
  `--environment jsdom`; default Node mode has no `sessionStorage`.
- The shared Chrome debug profile was at 90% page zoom during the last visual
  pass. DevTools emulation values had to be multiplied by 0.9 to obtain exact
  CSS `innerWidth` targets. Always query `innerWidth` rather than trusting the
  requested emulation string blindly.
- The generation drawer is deliberately kept mounted. Unmounting it discards
  recipe UI state and recreates the “first click opens, later click generates”
  confusion.
- Do not return embedded generation to global `prepare-sequence-animation` /
  `clear-sequence-animation` events. The instance-scoped animation target is
  what prevents one performer generation from animating another grid.
- Do not display the fully formation-placed sequence in Performer 2's notation
  card. Use `performerSequence`; the final `sequence` includes formation
  placement intended only for the animation layer.
- The draft storage key remains `tka-create-tunnel-draft-v1` while the payload
  schema is version 3. Treat the key as a stable storage address, not its schema
  version.
