# Fuse Recipe Inspector and Result Stage — Handoff (2026-09-01)

## Mission

Redesign `/create/fuse` so the right-side Fuse recipe column uses its full
height as a coherent recipe inspector, and let the assembled result animation
use the same rectangular stage-framing capability introduced for Shape Matrix.
The approved design and capability-ownership decisions are in
[2026-09-01-fuse-recipe-stage-design.md](active/2026-09-01-fuse-recipe-stage-design.md).

## Done — verified

No implementation item is verified enough to call done. All product changes
remain uncommitted and still require successful type/build and browser proof.

The following supporting checks did pass against the uncommitted worktree:

- `npx prettier --check` over the seven task-owned spec/component files: all
  matched Prettier style.
- `git diff --check`: no whitespace errors.
- `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/animation-engine/domain/glyph-overlay-frame.test.ts`:
  one file passed, four tests passed in 1.02 seconds. This proves the pre-existing
  rectangular overlay-frame calculation, not the new Fuse wiring.

## Believed done — unverified

- `FuseRecipeOverview.svelte` is a new Fuse-specific landing surface for the
  existing `SettingsDrillPanel`. It groups Length, Level, Grid, Style, and
  Starting conditions into compact aligned controls, and gives the remaining
  height to the active path relationship. It delegates every edit back to the
  existing drill destinations.
- `FuseRelationshipSummary.svelte` extracts the relationship presentation from
  `FuseRelationshipComposer.svelte`. Separate mode shows two independently
  generated paths feeding the combined result. Linked mode uses the existing
  `fuseRuleGlyph`, `fuseRuleTint`, and `LOOPIconStrip` owners.
- `FuseRelationshipComposer.svelte` now consumes the extracted summary rather
  than maintaining a second copy of the chain markup and CSS.
- `FuseRecipeSettings.svelte` supplies the new overview through
  `SettingsDrillPanel`'s existing `listContent` slot. A pre-existing narrowing
  problem in the solo branch was tightened with an explicit
  `isFuseRecipeDestination(destination)` guard, but the checker was not rerun
  after that edit.
- `FuseAnimationPreview.svelte` passes `glyphFrame="stage"` only while assembled,
  keeps `pictograph` framing while decomposed, and explicitly hides the unused
  in-canvas word header.
- `FusePreviewStage.svelte` marks the decomposed state and limits its square
  frame rules to that state. The assembled frame should therefore fill the
  rectangular result area while `AnimatorCanvas` keeps the motion plane square.
- The approved design spec exists locally but is uncommitted.

## In flight

- Worktree: `E:\tka-platform-fuse-recipe-stage`
- Branch: `codex/fuse-recipe-stage`
- Branch HEAD before this handoff commit: `b5233021da4938205cdc89a99bfd2962a29c0676`
- Primary `main` at handoff time: `629402e061ed2e1efa4b7f76c99e58629a684d76`
- Before committing this handoff, the task branch was 13 commits behind local
  `main` and zero ahead.
- No product code or design spec has been committed.
- Uncommitted task-owned paths:
  - `src/lib/features/fuse/components/FuseAnimationPreview.svelte`
  - `src/lib/features/fuse/components/FusePreviewStage.svelte`
  - `src/lib/features/fuse/components/FuseRecipeSettings.svelte`
  - `src/lib/features/fuse/components/FuseRelationshipComposer.svelte`
  - `src/lib/features/fuse/components/FuseRecipeOverview.svelte` (new)
  - `src/lib/features/fuse/components/FuseRelationshipSummary.svelte` (new)
  - `docs/superpowers/specs/active/2026-09-01-fuse-recipe-stage-design.md`
- The worktree has a `node_modules` junction to
  `E:\tka-platform\node_modules` and an ignored `.env` hard link to
  `E:\tka-platform\.env`. Do not print either file's contents.
- Port 5174 is stopped. No task-owned preview server remains running.

## Loose ends (ranked)

1. Audit the uncommitted diff against the current `main` before changing it.
   Local `main` advanced 13 commits during this session. Do not blindly merge or
   rebase over the dirty worktree; first inspect whether those commits touch the
   four modified Fuse files or the shared animation-stage contract.
2. Run a trustworthy focused Svelte/TypeScript check after bringing the branch
   current. `npm run check:fast` completed with 966 errors because its converter
   failed on six unrelated Svelte files and cascaded through the repo. It did
   report one Fuse error at `FuseRecipeSettings.svelte:104`; the explicit guard
   described above was added afterward and still needs proof.
3. Establish a working visual-verification server. The first `npx vite` run on
   port 5174 performed a large dependency optimization. The app remained at
   `Loading the alphabet… / Loading...`, issued roughly 870 module requests, and
   Chrome DevTools accessibility snapshots repeatedly wedged until the shared
   browser target closed. Direct DOM evaluation worked once and showed a
   complete document still on the loading screen. Do not treat this as product
   evidence.
4. Investigate the production-build anomaly. Before the `.env` hard link,
   `npx vite build --logLevel error` failed because
   `PUBLIC_GOOGLE_MAPS_API_KEY` was absent. After linking `.env`, the same command
   exited with code 0 almost immediately but produced no `build` directory.
   That is not a successful build.
5. Visually inspect the assembled and decomposed result plus the recipe overview
   and every recipe editor at 1920x1080, 2560x1440, 3840x2160, 1440x900,
   820x1180, 960x412, and 375x667. Check the one-scroller contract, horizontal
   overflow, 44px targets, relationship-stage balance, annotation corners, and
   the square motion plane inside the rectangular frame.
6. Iterate on every visual or runtime defect found. In particular, confirm that
   `FuseRelationshipSummary` remains compact inside the existing pairing editor
   at short heights and narrow panel widths.
7. Once proven, commit only the seven task-owned implementation/spec paths with
   explicit pathspecs. Bring the branch current with local `main`, repeat any
   invalidated checks, then run from the primary checkout:
   `npm run wt:finish -- codex/fuse-recipe-stage --route /create/fuse`.

## Decisions already made

- On 2026-09-01 Austen approved the proposed redesign with: “sure, but make no
  mistakes.” Verification is part of the approval, not optional polish.
- The recipe column is an active inspector, not a taller menu and not an equal
  card dashboard. Its flexible space explains the actual path relationship.
- Existing Fuse state, setting editors, drill navigation, and panel-track motion
  remain the behavior owners. The overview composes them.
- The assembled result uses the shared animation engine's `glyphFrame="stage"`.
  Fuse does not calculate annotation offsets locally.
- Disassembled mode keeps the existing square/triptych comparison geometry.
- Fuse's TKA and elemental annotations move to the rectangular stage corners.
  The top corners remain quiet because the external preview header already owns
  result name, count, BPM, and assembly controls.
- Do not touch the separate dirty worktree
  `E:\tka-platform-shape-matrix-animation-workspace`.

## Gotchas

- The primary checkout has an unrelated untracked `human-generator/` directory.
  It belongs to the user or another task; do not stage, delete, or alter it.
- This worktree was created manually from the then-current `main`, so it lacks
  product-managed worktree metadata beyond normal Git registration.
- `node_modules` is a junction. Let `wt:finish` unlink it; never recursively
  delete it.
- `.env` is an ignored hard link used only to make local build/runtime config
  available. Never commit it or reveal its contents.
- The shared Chrome process restarted or lost its DevTools target several times
  during the failed first-load inspection. Close only a task-owned tab if one is
  still present; never close another agent's pages or the shared browser.
- The new overview uses an accurate workflow diagram rather than decorative
  filler. Preserve that meaning if the composition changes.
