# Ocean Performer Command Bar Opus Test Handoff (2026-08-17)

## Mission

Give the standalone Ocean 3D experience at `https://localhost:5173/test/ocean-scene` a cold visual and interaction acceptance pass. The scene, performer loading path, and performer command bar have had several implementation passes. Austen wants fresh Opus eyes on the integrated result before this work is considered settled. The command bar contract lives in [2026-08-14-performer-command-bar-design.md](./2026-08-14-performer-command-bar-design.md).

## Done: verified

### Performer command bar implementation

- Commit: `954f5c4a49` (`feat(3d): performer command bar`), present on `origin/main`.
- The command bar now has a responsive 520px to 720px detail panel, stable performer selection, explicit All Performers scope, labeled tabs, Prop and Effects drill-downs, the canonical sequence picker, avatar selection, visible removal, 44px targets, and keyboard navigation.
- `PerformerHubDetail.svelte` dropped from 1,438 lines to about 650 lines. Avatar, identity, sequence, and prop-family responsibilities now have their own components.
- Proof from the implementation session: `npm run check` reported `svelte-check found 0 errors and 0 warnings`.
- Proof from the implementation session: `npx vitest run --config tests/config/vitest.config.ts tests/unit/3d/state/performer-manager-count-transition.test.ts` passed 4 of 4 tests.
- Live runtime proof at the desktop viewport used in the session: detail width `600.9375px`, `clientWidth=601`, `scrollWidth=601`, tab minimum height `44px`, opaque black backing, and no browser console errors or warnings.
- Live scope proof: after adding a second performer and entering All Performers, selecting Guitar returned `aria-pressed="true"` and Guitar was the only pressed prop. The scene was restored to one performer with Staff selected afterward.

### Performer transition and render-budget work

- Commit: `5c6ae8f862` (`feat(3d-viewer): improve performer transitions and render budgets`), present on `origin/main`.
- It added interruptible performer layout transitions, shared grid resources, performer light pooling, avatar-swap render budgets, and focused regression tests for performer addition and avatar swaps.
- The focused count-transition suite was rerun after the command bar changes and passed 4 of 4 tests. The full transition and render-budget test set was not rerun during the command bar session.

### Ocean depth and framing

- Commit: `ed40cdb6d2` (`feat(ocean): refine 3D scene depth and framing`), present on `origin/main`.
- Austen accepted the corrected direction in the live scene after clarifying that the water needed to feel deeper, with the surface farther above the performers rather than closer.
- This remains a visual acceptance claim. There is no current calibrated screenshot or world-space depth readout proving exactly 25 feet.

### Seven-dimension audit pipeline

- Commit: `609b48747b` (`chore(agents): tighten audit skills and evidence scripts`), present on `origin/main`.
- Svelte 5 is retired from audit scoring. The active dimensions are Architecture, Code Quality, Accessibility, UX States, UI Consistency, Performance, and Security.
- Proof from `E:\shared-packages\packages\code-quality`: `npm test` passed 9 of 9 tests, including a Windows regression test proving the CSS evidence helpers emit clean JSON without Unix `grep`.
- A read-only evaluator re-audited the performer command bar after the fixes and returned A+ in all seven active dimensions with no issues.
- The tracker record for `shared/3d` carries the note that this A+ result is scoped to the performer command bar. Do not treat it as an A+ audit of every file under `shared/3d`.

## Believed done: unverified

- Exact 4K behavior. The width clamp and no-overflow math were verified at a roughly 1767px-wide viewport, but the final tokenized surface was not inspected at 3840x2160.
- Mobile and tablet composition. The same content is intended to fit the full-width mobile sheet through container queries, but the final extracted components were not visually accepted at 820px, 960x412, or 375px.
- First-load avatar smoothness. Hover prewarming, request identity checks, and failure feedback are implemented. The final pass did not record a frame timeline for every uncached avatar model.
- Black-frame elimination during rapid avatar hover and selection. No black frame appeared during the live spot checks, but the behavior was inconsistent before the fixes and needs a deliberate stress pass.
- Eight-performer stage fit. Layout transitions and automatic positions are implemented, but the final command bar session did not add performers 1 through 8 while watching every transition and stage boundary.
- The integrated Ocean scene still needs a subjective visual grade. Austen's target is at least 9 out of 10.

## In flight

- Primary repository: `E:\tka-platform`, branch `main`.
- The performer command bar, depth, and transition commits listed above are already on `origin/main`. Their files are clean in this checkout.
- At handoff time, local `main` is ahead of `origin/main` by two unrelated commits: `4d2bfe7a8b` and `b4835ae9d8`. The working tree also contains many unrelated edits and an unrelated staged deletion of `PostStudioDeliveryPanel.svelte`. Do not reset, clean, reformat, stage broadly, or include those changes in an Ocean commit.
- Shared package repository: `E:\shared-packages`, branch `main`. The code-quality source changes and `packages/code-quality/test/` remain uncommitted there among extensive unrelated background and scene-3d work. Preserve all of it. The TKA repository already contains the synchronized audit scripts in `609b48747b`.

## Loose ends, ranked

### 1. Run the Opus visual and interaction acceptance matrix

Use the existing HTTPS dev server on port 5173. Do not start, stop, or restart Austen's server.

Test the following in order:

1. Open `https://localhost:5173/test/ocean-scene` and wait for the loading curtain to finish.
2. Judge the integrated scene at the current desktop size before touching controls. Check perceived water depth, performer visibility, stage fit, contrast, and whether the command bar competes with the scene.
3. Repeat at 1920, 2560, and 3840 widths, then 1440 desktop, 820 tablet, 960x412, and 375 mobile. Use browser viewport emulation. Do not resize Austen's browser window.
4. Add performers one at a time through 8. Watch for a full-scene pause, stage overflow, camera jumps, performer overlap, lighting pops, or a performer landing off-stage.
5. Click the selected performer twice. It must remain selected. Only the All Performers button may enter group scope.
6. Exercise every tab. Verify Prop family drill-down and Back, Planes, Effort descriptions, the full Effects gallery and focused editor, Avatar, and Sequence picker. The panel should not develop horizontal or nested scrolling.
7. In All Performers scope, change Prop, Effort, Avatar, Planes, and Effects. Each control must show the value actually applied to the group. Mixed values must not lie by highlighting a single value.
8. Remove a middle performer, not only the last performer. Confirm surviving identities and avatar synchronization are unchanged.
9. Stress avatars. Sweep the pointer across many avatar cards, select an uncached model, immediately select another, and repeat after the models are cached. Look for a black frame, model flash, stale selection, console error, or scene freeze.
10. Test keyboard-only use. Tab into the command bar, use arrow keys in tabs, avatars, and efforts, open and close each drill-down, operate removal confirmation, and confirm visible focus throughout.
11. Leave the best diagnostic state open in the app browser and write a ranked punch list. Include measured frame evidence for any claimed stutter and exact viewport dimensions for layout findings.

### 2. Decide whether the shared code-quality package changes need their own commit

The source-of-truth package changes under `E:\shared-packages\packages\code-quality` are still dirty. They should be separated from the unrelated background and scene-3d work before any commit. Do not commit that repository wholesale.

### 3. Correct any acceptance failures at their existing owner

- Shell and scope: `PerformerHub.svelte`, `PerformerSpine.svelte`, `PerformerHubDetail.svelte`.
- Avatar loading: `PerformerAvatarPicker.svelte`, `AvatarSwapTransition.svelte`, and the scene-3d avatar cache path.
- Props: `PropFamilyPicker.svelte` and the prop display registry.
- Effects: `EffectsSettingsPanel.svelte`, the effect registry, `EffectPresetsSection.svelte`, and `EffectControlStack.svelte`.
- Performer count and layout: `performer-manager.svelte.ts`, `viewer-3d-state.svelte.ts`, and the shared scene-3d formation owner.
- Do not create parallel state, a second prop picker, or another effects registry.

## Decisions already made

- On 2026-08-14, Austen required the ocean to feel about 25 feet deep. Moving the surface closer is the wrong direction.
- On 2026-08-14, Austen required a standalone full 3D experience with viewer parity, including performers, props, effects, avatars, and sequence choice.
- On 2026-08-14, Austen set the quality target at 9 out of 10 or better.
- On 2026-08-14, Austen required performer addition and avatar changes to feel butter smooth, with no one-second scene freeze and no intermittent black flicker.
- On 2026-08-14, Austen asked for a wider performer panel on large 4K monitors, minimal scrolling, and drill-down pages instead of expanding rows or nested scrollers.
- On 2026-08-14, Austen removed Svelte 5 from the audit pipeline because that area has been A+ for a long time.
- On 2026-08-17, Austen requested a saved handoff/spec and specifically asked for Opus eyes on testing.

## Gotchas

- Port 5173 is Austen's HTTPS server. `http://localhost:5173` is wrong, and server lifecycle commands are forbidden.
- The current checkout is shared by live agents. The dirty files and staged deletion are not part of this handoff.
- The command bar surface uses shared `--theme-*`, `--surface-*`, `--semantic-*`, and `--prop-*` tokens. Its black backing is intentional so the live scene cannot wash through the controls.
- Adaptive quality can change DPR while the ocean runs. Record frame timing and the active quality state before calling a DPR change a regression.
- First-time model decode and GPU upload are different from cached avatar switching. Test both and label findings accurately.
- Avatar hover prewarming is intentionally silent. A real click failure must preserve the current avatar and show user-facing feedback.
- Exact screenshot capture was unavailable in the Codex in-app browser used during the last pass. That is the main reason this handoff calls for fresh Opus visual verification.
