# Composer Presentation Mockup for Fable — Handoff (2026-08-23)

## Mission

Continue the unlisted Composer presentation at
`https://localhost:5173/composer/mockup`. Austen wants this test page to show
the real intended product experience at a glance. The latest pass replaces the
fake repeated “Replace beat 8” interaction with the production Construct
picker, production StepGrid arrival animation, and the existing teaching
ghost. Read the earlier
[presentation handoff](./2026-08-21-composer-presentation-mockup-handoff.md),
the [feature truth matrix](<../../../src/routes/(public)/composer/feature-truth-matrix.md>),
and the amended
[Construct attract design](./shipped/2026-07-19-construct-attract-demo-design.md)
before editing. The public `/composer` route is not the target until Austen
explicitly approves promotion.

## Done — verified

### Committed baseline

- Commit `2c432e6d6e` (`feat(composer): add honest presentation mockup`) owns
  the original noindex mockup route and carried-sequence page structure. Its
  route returned HTTP 200 from the HTTPS development server during the baseline
  verification recorded in the 2026-08-21 handoff.
- Commit `1d0318bbc1` (`docs(composer): ground claims and direct 3d showcase`)
  owns the initial truth ledger and 3D presentation direction. The 2026-08-21
  handoff records the evidence audit that produced them.
- Local `main` and `origin/main` both pointed at
  `c65de34bd0d91aaedfef95d27a0bdbcf1f07d58d` when this handoff was written.
  `git rev-list --left-right --count origin/main...HEAD` returned `0 0`.

### Current working-tree proof

The implementation below is verified but uncommitted, so it is listed under
**In flight** instead of being assigned a false commit SHA.

- On 2026-08-23, this configured focused run passed 4 files and 13 tests:

  ```text
  pnpm exec vitest run --config tests/config/vitest.config.ts \
    tests/unit/composer-presentation-state.test.ts \
    tests/unit/create/step-grid-arrival-state.test.ts \
    "src/routes/(public)/composer/_sections/__tests__/construct-attract-act.test.ts" \
    tests/unit/composer-presentation-viewer-isolation.test.ts

  Test Files  4 passed (4)
  Tests       13 passed (13)
  ```

  The only stderr was the known benign warning about multiple Three.js
  instances.

- Prettier passed all 14 scoped Composer implementation, helper, test, and spec
  files on 2026-08-23. Stylelint passed the 5 scoped Svelte files.
- `STALE_REPLACEMENT_REFERENCES=0` for `ComposerBeatReplaceDemo`,
  `composer-beat-replacement`, and the visible text `Replace beat 8`.
- On 2026-08-22, real browser clicks selected a start and two successive valid
  options. The status advanced from `Choose beat 1` to `Choose beat 2` and then
  `Choose beat 3`. The production arrival stage reported
  `arrival-card ... entered landing`; the step grid grew from two to three
  cells; and the carried hero letters changed to alpha, A, and B.
- The focused ghost test proves one start pick plus four option picks. It also
  proves the focused story does not touch turn controls, filters, carousel
  paging, or prop controls.
- The working page was inspected at 375 x 667, 960 x 412, 820 x 1180,
  1440 x 900, 1920 x 1080, 2560 x 1440, and 3840 x 2160. No horizontal
  overflow was found. Evidence images remain under
  `C:\Users\Austen\AppData\Local\Temp\codex-composer-guided-build\`, including
  `phone-375-shell.webp`, `wide-phone-960-shell.webp`, `tablet-820.webp`, and
  the four `desktop-*-live.webp` captures.

## Believed done — unverified

- `onComposed` carries each newly built sequence into the page-level sequence,
  and the opening player visibly changed during a manual build. A complete
  frame-level click-through proving the same manual build in both Tunnel and 3D
  was not recorded.
- Generate calls the real orchestrator, separates a no-result draw from an
  engine or chunk failure, and sends its result through the same page callback.
  A fresh Generate-to-Tunnel-to-3D browser proof was not recorded after the
  latest shared-tree changes.
- The 3D demo now starts from an explicit non-persisting seed, changes the
  viewer environment instead of the old 2D background, and has scene,
  performer, and prop controls. Unit isolation coverage passes. It still needs
  an authenticated runtime comparison against deliberately non-default saved
  2D and 3D settings.
- Reduced-motion wiring now stops the hero, generated animation, mandala,
  tunnel, and 3D clocks. The live controls expose keyboard-accessible pause
  buttons and named segmented controls. Reduced-motion and keyboard-only
  browser passes were not rerun after every shared dependency changed.
- The seven viewport screenshots look coherent. Austen has not yet given the
  new guided builder a post-implementation approval.

## In flight

- Repository: `E:\tka-platform`.
- Branch: `main`. No branch or worktree was created.
- Baseline HEAD when this handoff was written:
  `c65de34bd0d91aaedfef95d27a0bdbcf1f07d58d`.
- The checkout contains hundreds of unrelated modifications, staged deletions,
  and untracked assets from other live sessions. Never reset, clean, or stage
  broadly.

### Composer-owned or Composer-specific working files

- Modified:
  - `src/routes/(public)/composer/mockup/+page.svelte`
  - `src/routes/(public)/composer/_components/Composer3DViewerDemo.svelte`
  - `src/routes/(public)/composer/_components/ComposerGenerateDemo.svelte`
  - `src/routes/(public)/composer/_components/ComposerTunnelDemo.svelte`
  - `src/routes/(public)/composer/_sections/ConstructSection.svelte`
  - `src/routes/(public)/composer/_sections/construct-attract-act.svelte.ts`
  - `src/routes/(public)/composer/_sections/__tests__/construct-attract-act.test.ts`
  - `src/routes/(public)/composer/feature-truth-matrix.md`
  - `docs/superpowers/specs/shipped/2026-07-19-construct-attract-demo-design.md`
- Untracked:
  - `src/routes/(public)/composer/_components/composer-3d-demo-state.ts`
  - `src/routes/(public)/composer/_components/composer-generation-failure.ts`
  - `tests/unit/composer-presentation-state.test.ts`
  - `tests/unit/composer-presentation-viewer-isolation.test.ts`
  - `tests/unit/composer-presentation-viewer-state.svelte.ts`

### Shared dependencies with overlapping owners

- Modified:
  - `src/lib/shared/landing/components/SequenceHeroDemo.svelte`
  - `src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte`
  - `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
  - `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`
  - `src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte`
- Untracked:
  - `src/lib/shared/3d/environments/domain/scene-environment.ts`

`Composer3DViewerDemo.svelte` and `composer-3d-demo-state.ts` directly depend on
the dirty viewer state and untracked scene-environment owner. The presentation
is not a self-contained commit until those shared owners land or their exact
changes are coordinated. Do not absorb those files into a Composer commit just
to make the import graph look complete.

## Loose ends (ranked)

1. Open `/composer/mockup`, inspect the guided builder in the current shared
   tree, and read Austen's next reaction before changing its structure again.
   He approved implementation, not promotion.
2. Reconcile ownership of `viewer-3d-state.svelte.ts`,
   `scene-environment.ts`, `StepGrid.svelte`, and `WorkspaceGrid.svelte`. Once
   their owners land, rerun the focused Composer proof and commit only explicit
   Composer paths.
3. Record one complete manual-build cascade: choose the start, add at least two
   beats, then confirm the same word and motion in the opening player, Tunnel,
   and 3D viewer.
4. Record one Generate cascade and exercise every 3D scene, performer-count,
   and prop control. Compare saved 2D background and 3D state before and after
   leaving the route.
5. Run reduced-motion, keyboard-only, WebGL2-unavailable, narrow-3D-gate,
   generator no-result, generator load failure, and lazy-import failure passes.
   Run Lighthouse only after the real 3D scene settles.
6. Decide whether the separate 3D showcase film in
   `2026-08-21-composer-3d-showcase-film-design.md` is still wanted. The live
   3D proof works without it; the film remains unimplemented.
7. After Austen explicitly approves the mockup, write a promotion plan for
   `/composer`. Do not replace the public route as an inferred next step.

## Decisions already made

- On 2026-08-22 Austen said the test page should look like the real intended
  page so he could understand it immediately. Route-local fake interactions
  are therefore the wrong direction when a production primitive exists.
- On 2026-08-22 Austen rejected the repeated “Replace beat 8” interaction. His
  reasons were specific: it skipped the OptionPicker-to-StepGrid arrival
  animation, changed choices without advancing the sequence, and removed the
  teaching ghost. He then explicitly said “do it” after the reuse plan was
  presented.
- The focused Construct story is start position, beat 1, beat 2, beat 3, beat
  4, then playback. Valid options may change after each pick because the real
  validity engine is deriving the next beat. The prompt must advance with the
  sequence.
- The existing `createConstructAttractAct` remains the behavior owner. Focused
  mode narrows its script; it does not create another ghost implementation.
- The existing `StepGrid` and `PictographArrivalStage` remain arrival owners.
  The obsolete beat-replacement helper and demo were removed.
- `ConstructSection` defaults to `presentationMode="full"`, preserving the
  current public `/composer` presentation. Only the mockup requests
  `presentationMode="guided-build"`.
- On compact layouts the grid and picker stack in one scroll. Tabs are hidden
  so the destination stays visible while a visitor chooses the next beat.
- One sequence continues through the page. Manual construction and generation
  both update that carried sequence.
- Public feature claims remain governed by
  `feature-truth-matrix.md`. Registration alone is not proof of a shipped
  capability.
- The current public `/composer` route remains untouched until Austen approves
  promotion.

## Gotchas

- Port 5173 is Austen's HTTPS/2 development server. Use
  `https://localhost:5173`; do not start, stop, restart, or kill it.
- Use the configured Vitest command. Raw `pnpm exec vitest run ...` without
  `tests/config/vitest.config.ts` fails before the viewer isolation suite with
  `ReferenceError: document is not defined` because that test relies on the
  configured jsdom environment.
- The repository-wide `pnpm check:fast` was globally red on 2026-08-22 from
  existing shared-checkout diagnostics, while the changed Composer files
  produced zero diagnostic lines. Do not treat global red as a Composer pass,
  and do not absorb unrelated fixes.
- The dedicated Chrome process was at 90 percent browser zoom during desktop
  proof. Exact CSS viewport mappings were 1296 x 810 emulation for 1440 x 900,
  1728 x 972 for 1920 x 1080, 2304 x 1296 for 2560 x 1440, and 3456 x 1944 for
  3840 x 2160. Mobile emulation used the requested dimensions directly.
- The ghost runs automatically on larger layouts. A real pointer or focus
  takeover parks it without resetting the visitor's current sequence. Use
  reduced motion or a deliberate takeover when a stable screenshot is needed.
- `onComposed` emits a new sequence after every added beat. The generated ID
  includes the raw word and step count so downstream reactive consumers update.
- The public route still uses the default full Construct presentation. A bug in
  guided mode should be fixed behind `presentationMode="guided-build"` unless
  the same defect is independently proven in the public mode.
- The visual evidence directory is temporary. Copy any screenshot needed for a
  durable review into a scoped evidence directory before relying on it in a
  commit or pull request.
- No expert-agent canon changed beyond the amended Construct design. No expert
  knowledge file needed an update for this handoff.
