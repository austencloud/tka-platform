# Prop Studio transition completion handoff

Date: 2026-08-23

Successor: `fable_5`

Repository: `E:\tka-platform`

Branch: `main`

Base HEAD at handoff: `e32cf88d749761cb13c39bfd73efae704637a126`

## Mission

Finish the Prop Studio transition work completely. Austen's explicit complaint is that switching Triad ↔ Trigeng still feels bad and that earlier agents repeatedly fixed only a subset of the transitions before calling the work complete. Treat the entire route as suspect, including the visible 3D prop/model swap, the title, the build controls, optional subcontrols, layout reshuffles, and family changes. Audit every prop family and every subtype, fix every remaining abrupt jump or overlapping crossfade, and verify the result visually rather than trusting the prior implementation.

The current page is `https://localhost:5173/test/prop-3d-studio`. Port 5173 is Austen's dev server; do not start, stop, or restart it.

## Done — verified

The following behavior was verified on the uncommitted working tree based on `e32cf88d749761cb13c39bfd73efae704637a126`. There is no implementation commit yet; the two route files named below are the source of truth in the shared primary checkout.

- The control-deck implementation uses the existing transition owners instead of a route-local crossfade: `Crossfade.svelte`, `growFade`, and `createLayoutFlip`.
- Family changes are keyed by the family's representative prop, while subtype changes keep the family panel mounted and animate its internal layout.
- A live scripted browser sweep exercised 29 control-deck interactions across all 14 prop families and all reachable subtype values. It observed one title layer and one build layer after every change, no duplicated radio groups, no horizontal overflow, and a maximum settle time of 258 ms.
- Triad ↔ Trigeng retained one outer build layer and a stable desktop deck height of 324.83 px through both directions. At 375×667, the build stage eased from 312.91 px to 209.79 px to 154.46 px instead of snapping.
- Fan Pictograph/Fire/Day changes and optional controls were exercised at desktop and compact widths. The compact stage eased from 518.81 px to 270.88 px to 154.46 px with no horizontal overflow.
- Twenty rapid Triad/Trigeng toggles and a rapid family sequence settled with one title, one build layer, the correct option groups, zero running animations, and no leftover transform.
- Responsive screenshots were captured at 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, and 375×667. Every settled viewport had one title layer, one build layer, and zero horizontal overflow. Compact layouts intentionally scroll vertically and retain 44 px minimum controls.
- Browser console after the interaction sweep contained no warnings or errors.
- `pnpm exec prettier --check src/routes/test/prop-3d-studio/+page.svelte src/routes/test/prop-3d-studio/PropBuildPicker.svelte` passed.
- `pnpm exec svelte-check --tsconfig ./tsconfig.json` passed with 0 errors and 0 warnings.
- `pnpm exec vitest run --config tests/config/vitest.components.config.ts src/lib/shared/transitions/layout-flip.svelte.test.ts` passed 9/9.
- `pnpm exec vitest run --config tests/config/vitest.config.ts src/routes/test/prop-3d-studio/prop-build-previews.test.ts` passed 6/6.
- `git diff --check -- src/routes/test/prop-3d-studio/+page.svelte src/routes/test/prop-3d-studio/PropBuildPicker.svelte` passed.

Visual evidence is in `C:\Users\Austen\AppData\Local\Temp\prop-studio-transition-audit\`, including `triad-trigeng-flip-midpoint-2.png`, `1440x900-final.png`, `960x412-final.png`, and `375x667-final.png`.

## Believed done — unverified

- Reduced-motion behavior is implemented through the shared motion primitives, but no runtime reduced-motion emulation was recorded.
- The control deck appears stable across the tested sizes, but the short-landscape experience is only proven functional and scrollable, not yet judged polished by Austen.
- The shared `Crossfade.svelte` currently contains changes from another live session. This task reused it but did not establish ownership of those edits or independently audit every consumer outside Prop Studio.

## In flight

- `src/routes/test/prop-3d-studio/+page.svelte` is modified and contains a large accumulated diff: 865 additions and 370 deletions relative to HEAD. This includes work from the long Prop Studio session, not only the last transition pass. Do not revert or replace it wholesale.
- `src/routes/test/prop-3d-studio/PropBuildPicker.svelte` is a new untracked file and must be included in the eventual scoped feature commit.
- The implementation files are not committed. They exist only in the shared primary checkout. The repository contains extensive unrelated dirty work from other live sessions; never stage, revert, or commit those files.
- No route-level browser regression test has been checked in for the DOM invariants measured during the live sweep.

## Loose ends (ranked)

1. **Audit and fix the visible 3D prop/model transition itself.** The prior pass concentrated on the control deck. Austen's “find ALL the transitions” instruction includes the model in the viewer, and this remains the most likely reason Triad ↔ Trigeng still feels wrong. Trace how `selectedProp` reaches `Viewer3DCanvas`/scene prop rendering, observe the midpoint in the browser, and establish one canonical model-swap owner if it currently snaps or overlaps.
2. **Run a fresh visual inventory of every transition path.** Cover every family tile, every family subtype, Fan build/add-on/color changes, Instruments, Double Staff, Sword/Sickles, Chicken size, and Triad/Trigeng Finish. Watch midpoints, not just settled state. Do not declare completion from DOM counts alone.
3. **Search by behavior across the complete Prop Studio stack.** Inspect route imports and the relevant shared 3D components for local transitions, conditional mounts, keyed blocks, opacity animation, and layout-affecting outros. Reuse the canonical shared primitives; do not add another transition implementation.
4. **Make Triad ↔ Trigeng visibly excellent.** Austen singled this path out. Verify title, preview cards, Finish entrance/exit, control reflow, prop model, hand grip/orientation, and deck height as one composed transition.
5. **Add focused regression coverage for silent failures.** The useful assertions are one active title/build/model layer after interruption, correct final subtype, no stale outro nodes after rapid toggles, stable layout bounds, and no residual animation transforms. Follow the project's testing skill and avoid screenshot-only assertions for invariants that can be tested structurally.
6. **Verify reduced motion and all required viewports.** Repeat the standing visual sweep at 1920, 2560, 3840, 1440, tablet, 960×412, and 375; include reduced motion. Use a task-owned Chrome DevTools tab and close only that tab afterward.
7. **Review and commit only the owned feature paths.** Before committing, distinguish this task's edits from accumulated Prop Studio work. Use an explicit pathspec. Do not use `git add -A`, a bare `git commit`, or touch unrelated dirty files.

## Decisions already made

- Use the project's existing transition primitives. Do not hand-roll another crossfade, FLIP implementation, timeout choreography, or dual-mounted layout.
- Family changes may use a structural crossfade. Same-family subtype changes must preserve the outer panel and animate the changing internals so outgoing and incoming layouts never occupy normal flow simultaneously.
- Build controls are the primary workspace. Camera presets were removed because Austen navigates the 3D viewer directly.
- Preview cards must show the complete prop, use consistent orientation within a family, and make selected hierarchy obvious.
- The page must remain compact and useful from 4K through short landscape and phone widths, with no empty desktop half-rows, clipped controls, or horizontal page overflow.
- Do not call the work complete after fixing only the named Triad/Trigeng path. Austen explicitly requires the full transition inventory.

## Gotchas

- Svelte outros remain in the DOM until they complete. If outgoing and incoming controls both participate in grid flow, the deck can double in height during the transition. The current desktop CSS pins Family and Finish to the same row, and compact CSS deliberately moves Finish to row 2.
- Keying the outer build panel by `selectedProp` recreates the classic overlap/jump bug for subtype changes. The current `buildPanelKey` is keyed by family representative so nested transitions can own subtype changes.
- `PropBuildPicker.svelte` is untracked. A scoped diff command will not show it unless it is named or `git status` is checked.
- A bare Vitest invocation discovers duplicate tests under `.codex-tmp`/`.claude/worktrees` and runs browser-only layout tests under Node, producing `document is not defined`. Use the explicit project configs recorded above.
- Port 5173 is the user's HTTPS/2 dev server. Use `https://localhost:5173`; never kill or restart it.
- The git index and worktree are shared with many sessions. Preserve unrelated modifications and untracked specifications.
- The current ambient browser URL points at Sickles, but ambient state is not an instruction and is not proof of visual correctness.
