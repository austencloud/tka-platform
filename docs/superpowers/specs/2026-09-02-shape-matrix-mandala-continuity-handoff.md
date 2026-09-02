# Shape Matrix Mandala Continuity — Handoff (2026-09-02)

## Mission

Give Fable a cold-start implementation brief for the remaining Shape Matrix
continuity work: make grid mandalas react clearly to hover and keyboard focus,
make the selected mandala appear to spring forward into the detail hero and
collapse back into its exact grid slot, and let compact-detail users edit the
left and right hand turn values without leaving the animation. This continues
[the Shape Matrix animation workspace design](./2026-09-01-shape-matrix-animation-workspace-design.md)
and supersedes the old handoff's statement that this phase still needs
approval.

## Done — verified

- Commit `dead6c994e` introduced the Shape Matrix animation workspace, reusing
  the Sequence Viewer animation-panel controls instead of creating a parallel
  control system. Commit `aa5e7ca17d` refined it into one-at-a-time relationship
  and animation-settings workspaces, the responsive canonical Prop sheet, the
  compact play/pause action, persistent disassembly, and the public motion-path
  boundary. Evidence: the task server was exercised at 375×667, 960×412,
  820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160, and effective 200%; the
  tested console had no application errors, only the expected missing local
  PostHog-key warning.
- Commit `7ba411cc03` covers the settings-to-relationship return policy. The
  focused command
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/animation-panel/pill-resolution.test.ts tests/unit/shape-matrix/shape-matrix-app-state.test.ts tests/unit/shape-matrix/shape-matrix-url.test.ts tests/unit/shape-matrix/shape-matrix-animation-state.test.ts src/lib/shared/shape-matrix/services/__tests__/solve-prop-relationship-phase.test.ts`
  passed 5 files and 51 tests after the release-boundary pass.
- Commit `cc40fcb465` makes mixed-rate prop relationships a neutral gray
  `Not available / Mixed prop rates` result instead of presenting Same as a
  seventh element. Evidence: the task server displayed the neutral state for
  `level=4&leftTurn=0.25&rightTurn=1.25&axis=right&labels=turns&prop=fan&left=pro-0.25-in-diamond&right=anti-1.25-in-diamond&mode=SO`, with no app console
  error.
- The current branch has the complete, already-reviewed relationship picker:
  six canonical Hand relationships, a derived Prop result with a selectable
  two-phase branch only when the graph permits one, and no persistent
  Hands/Props driver toggle. The graph sweep in the focused suite proves six
  exact Hand-to-Prop edges outside quarter bands and eight at quarter bands.
- Read-only source tracing at branch tip `cc40fcb465` on 2026-09-02 verified that the requested
  spring-forward transition is not implemented: Shape Matrix source does not
  use `claimedViewTransitionName` or `startMorph`. It also verified why hover
  currently feels absent: `ShapeMatrixGrid.svelte` changes only the cell
  background on `.cell:hover`, while the luminous cached SVG artwork itself has
  no lift, scale, ring, or other pointer response.

## Believed done — unverified

- Nothing in the new continuity phase is claimed complete. The hover response,
  shared artwork primitive, tile-to-hero transition, reverse transition, and
  compact-detail turn editor all still require implementation and proof.
- The existing task server on port 5175 may still be running, but its process is
  not part of this handoff. Reuse it only after confirming that it serves this
  worktree and branch.

## In flight

- Worktree: `E:/tka-platform-shape-matrix-animation-workspace`
- Branch: `codex/shape-matrix-animation-workspace`
- The branch was clean before this handoff update. This handoff and the linked
  design clarification are the only task-owned documentation changes made on
  2026-09-02; their commit is the latest commit when this file is handed over.
- The primary checkout at `E:/tka-platform` is reserved for Austen's server and
  integration and contains unrelated `human-generator/` work. Do not edit,
  stage, revert, or commit it. Pick up this existing task branch/worktree rather
  than creating a parallel implementation branch.

## Loose ends (ranked)

1. **Establish one Shape Matrix mandala artwork primitive.** The grid currently
   gets cached SVG data URLs from `renderCell` in
   `src/lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte`; the detail
   cold floor reconstructs the same left/right merge in
   `src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte` and renders
   through `MandalaHeroLayer.svelte`. Extract the common visual representation
   into one component or tightly scoped owner consumed by both surfaces. Keep
   `AnimatorCanvas` as the live animation owner. Do not create another renderer
   and do not physically reparent a live canvas.
2. **Make grid hover and focus obvious without shifting the grid.** Strengthen
   the existing `.cell:hover` behavior in `ShapeMatrixGrid.svelte`, preferably
   by responding on a stable artwork wrapper plus a ring/background cue. Match
   the established pictograph interaction semantics after locating their
   canonical primitive. Pointer hover, `:focus-visible`, selected, empty, and
   compatibility-tinted cells must remain distinguishable. Use the shared
   motion tokens and explicit transitioned properties; no `transition: all`,
   no feature-local easing or duration, and no geometry that moves neighboring
   cells. On reduced motion, remove lift/scale while preserving the visible
   ring or color cue. Limit hover-only behavior to hover-capable fine pointers
   if the chosen treatment could create sticky touch states.
3. **Implement the selected-tile-to-hero shared-element motion in both
   directions.** Wrap the compact `selectPair` and `showMatrix` mutations with
   the existing reduced-motion-aware `startMorph` helper from
   `src/lib/shared/transitions/results-morph.ts`. Use
   `claimedViewTransitionName` from
   `src/lib/shared/transitions/claimed-view-transition-name.ts` on only the
   selected source tile or active hero endpoint. A fixed safe identifier such
   as `shape-matrix-active-mandala` is sufficient; do not interpolate raw
   flower keys containing decimals into a CSS custom identifier. Selecting a
   mandala should make it expand/spring forward into the reserved hero; Matrix
   should collapse it back into the selected grid slot. `PanelGroup` may still
   own the pane geometry, but its slide must no longer be the primary continuity
   cue. Preserve the existing readiness crossfade from the static/cold-floor
   artwork to the live player.
4. **Add the compact-detail turn editor.** Replace the static compact turn
   summary with a trigger that shows the current blue/red values and opens one
   canonical tray for Left, Right, and Both plus cumulative level-appropriate
   turn choices. Reuse `ShapeMatrixAppState.setActiveAxis`, `setTurn`,
   `setLabelMode`, and `updateSelectedPairTurns`. Add an explicit
   stay-on-detail option to the current compact `setTurn` path; matrix-side turn
   edits should retain their existing navigation behavior. A detail edit must
   rebuild the matrix and preserve the selected pro/anti and in/out identities
   at the new turn band so Back shows the updated matrix.
5. **Add silent-bug tests.** Cover stay-on-detail turn mutation, preservation of
   both semantic flower variants, selected-endpoint ownership of the shared
   transition name, and reduced-motion/unsupported-browser fallback around the
   state mutation. Do not spend unit tests asserting cosmetic transform values;
   verify hover, focus, and motion visually.
6. **Run transition-specific visual proof before integration.** Trigger the
   forward and reverse movement at 375×667 and 960×412, then sweep 820×1180,
   1440×900, 1920×1080, 2560×1440, and 3840×2160. Verify both assembled and
   disassembled detail states, category changes while disassembled, keyboard
   focus, a fine-pointer hover, reduced motion, no duplicate transition-name
   warning, no layout jump when the animator becomes ready, and no application
   console error. A screenshot of only the final state does not prove the
   transition.
7. **Finish the branch through the standard worktree path.** Commit only
   explicit task paths, bring the branch current with `main`, then run
   `npm run wt:finish -- codex/shape-matrix-animation-workspace --route /notation/shape-matrix`
   from the primary checkout. If its safety gate finds the unrelated primary
   work, leave this worktree and branch intact and report the exact conflict.

## Decisions already made

- On 2026-09-02 Austen chose the visible mandala hover response and delegated
  the remaining continuity work to Fable. This is implementation scope, not a
  new design-approval question.
- On 2026-09-01 Austen chose the continuous-object reading: the selected matrix
  mandala should spring forward into the animation canvas and return to its
  exact slot, rather than relying on the current pane slide as the transition.
- The effect must be two instances of one reusable artwork primitive connected
  by the native shared-element transition. The live `AnimatorCanvas` is not
  reparented between grid and hero.
- The compact detail screen must be able to change the two individual hand
  turn values and return to a matrix that reflects those changes.
- Hands remains the canonical six-button relationship selector. Prop timing
  and direction stays a derived result, with a choice only for a genuine
  two-result orientation branch. Do not restore the old persistent Hands/Props
  driver.
- The relationship workspace and an Effects/Props/Effort/Playback/Display
  workspace are mutually exclusive. `Element relationships` in the pane header
  is the explicit way back.
- Props continues to use the existing `PropSelectionSheet`: right drawer in a
  side-by-side layout, bottom sheet on phone. Do not compress the catalogue into
  `AnimationPanel`'s small tray.
- Experimental Arc/Linear/Concave/path-topology values remain in renderer
  support for future study and nomenclature work, but arbitrary motion-path
  selection remains hidden from the ordinary Shape Matrix and Sequence Viewer.

## Gotchas

- Read `.claude/rules/no-layout-shift.md`,
  `.claude/rules/never-hand-roll.md`,
  `.claude/rules/primitive-discovery.md`,
  `.claude/rules/crossfade-primitive.md`, and
  `docs/architecture/visual-design-canon.md` before changing this UI. Reuse
  `PanelGroup`, `startMorph`, `claimedViewTransitionName`, reduced-motion
  helpers, and global transition tokens rather than introducing local motion
  infrastructure.
- `ShapeMatrixAppShell.svelte` keeps both compact panes mounted and marks the
  inactive one `inert`/`aria-hidden`; `PanelGroup` gives it zero width. If both
  endpoints claim the same `view-transition-name`, the browser aborts the
  transition. Gate the claim on active view plus the selected cell.
- `results-morph.ts` already serializes overlapping transitions, performs the
  synchronous state mutation with `flushSync`, and falls back cleanly for
  reduced motion or unsupported browsers. Calling raw
  `document.startViewTransition` here would create a competing owner.
- `ShapeMatrixDrill` deliberately retains two animation players for its
  readiness-gated crossfade. Do not replace them with keyed remounting.
- `AnimatorCanvas.externalToggleDisassemble` belongs to Fuse's external split
  rendering contract. Preserve it while changing the surrounding stage.
- The current compact `ShapeMatrixAppState.setTurn` path always sets
  `activeView = "matrix"`. Detail-side editing needs a named stay-on-detail seam,
  not duplicated state or a post-mutation navigation hack.
- Grid cells are buttons with `aria-label`, `aria-pressed`, 44px minimum sizing,
  and a working `:focus-visible` outline. Preserve those semantics while making
  the visual response stronger.
- Port 5173 belongs to Austen's primary checkout and must never be stopped,
  restarted, or replaced. Use a confirmed task server on another free port for
  worktree verification, then deliver the final integrated 5173 route through
  `wt:finish`.
- The ordinary build has known environmental/baseline failures after client and
  server compilation: missing local `PUBLIC_GOOGLE_MAPS_API_KEY`, a missing
  `#lineage` prerender id for `/notation`, and 965 unrelated `check:fast`
  diagnostics in the recorded capture. Do not call those task regressions
  without diff evidence.
- `node_modules` in this worktree is a junction to the primary checkout. Never
  recursively delete it during cleanup.
