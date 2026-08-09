# Duration Editing Audit — Handoff (2026-08-08)

## Mission

Make duration editing in Create understandable and recoverable. Austen reported that the current flow is difficult, noted that drag-to-resize already exists, and supplied a screenshot where the Sequence Actions panel had closed but the workspace remained trapped in the duration preview. This session was a read-only audit. No governing design spec exists yet; the proposed spec path is `docs/superpowers/specs/2026-08-08-create-duration-editing-design.md`.

## Done — verified

- Traced the stuck-workspace path in the current source. `SequenceActionsPanel.svelte` enters global preview state from `handleDuration()` at lines 537-545. Its Back action calls `exitSubView()`, which cancels preview at lines 460-480, while the subview X calls the generic `handleClose` at lines 921-928. `SequenceActionsCoordinator.svelte` handles that close by calling only `panelState.closeSequenceActionsPanel()` at lines 33-40. `closeSequenceActionsPanel()` only clears the panel-open flag at lines 725-727 of `panel-coordination-state.svelte.ts`, and `closeAllPanels()` also leaves all three duration-preview fields untouched at lines 478-504. `CreationWorkspaceArea.svelte` continues rendering `DurationPreviewWorkspace` whenever the surviving preview flag and sequence are truthy at lines 49-51 and 101-104. Evidence: direct source reads on 2026-08-08.
- Located the regression boundary. Commit `ab65ec6e39` (`feat(sequence-actions): inline pattern editors as in-panel drill-down`) removed `handleDurationDrawerClose()`, which had called `exitDurationPreviewMode(false)`, and replaced the dedicated duration drawer with a local inline subview whose X uses the generic close path. Evidence: `git show --stat --oneline ab65ec6e39` plus `git show --unified=5 ab65ec6e39 -- src/lib/features/create/shared/components/sequence-actions/SequenceActionsPanel.svelte` on 2026-08-08.
- Mapped the three current duration interfaces. Per-step drag lives in `DurationResizeHandle.svelte` and `WorkspaceGrid.svelte`; exact per-step adjustment lives in `DurationControl.svelte`; sequence-wide patterns live in `DurationPatternView.svelte`. The resize handle is rendered only for the selected step at `WorkspaceGrid.svelte` lines 509-519. The pattern flow replaces the normal workspace with a separate animation and read-only width timeline through `DurationPreviewWorkspace.svelte`. Evidence: direct source reads on 2026-08-08.
- Checked existing focused state coverage. `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/create/construct-option-audition-panel-state.test.ts` passed one file and all 3 tests on 2026-08-08. The suite proves duration preview and Construct option audition are mutually exclusive, but it has no assertion for closing Sequence Actions while duration preview is active.

## Believed done — unverified

- The supplied screenshot is consistent with the orphaned global preview state described above: the right-side editor is gone while `DurationPreviewWorkspace` still occupies the left workspace. The state was not reproduced through an interactive browser in this session, so treat the source trace as the confirmed defect path and the screenshot match as a strong inference.
- The recommended interaction model below has not been usability-tested with Austen. It is the audit outcome, not an approved design.

## In flight

- Checkout: `E:\tka-platform`, branch `main`. No branch or worktree was created for this task.
- No duration source file was modified. This handoff document is the only file owned by this task.
- The shared worktree contains many pre-existing edits and untracked files from other sessions. Do not stage, revert, format, or commit them.
- Before this handoff commit, `main` was two commits ahead of `origin/main`: `8582f5a8a0` and `e7c6187467`. They are unrelated to duration editing and were already present when this handoff began.

## Loose ends (ranked)

1. Write the governing design spec at `docs/superpowers/specs/2026-08-08-create-duration-editing-design.md` and present it to Austen for explicit approval before changing source. The recommended target is one canonical duration editor: keep the editable timeline visible; expose a clear grip and duration value on the selected step; preview continuously during drag; commit one undoable change on release; retain keyboard and exact-number entry; apply sequence-wide patterns against that same timeline; make Back, X, and Cancel all revert an uncommitted preview; reserve animation playback as supporting feedback instead of replacing the editor.
2. Fix the lifecycle invariant at the state owner, not only in the X button. Any path that closes Sequence Actions or opens a mutually exclusive panel must cancel an active duration preview and clear `isDurationPreviewMode`, `previewSequence`, and `originalSequence`. Review `closeSequenceActionsPanel()` and `closeAllPanels()` in `src/lib/shared/create/state/panel-coordination-state.svelte.ts`, plus `SequenceActionsCoordinator.svelte` and the local subview cleanup in `SequenceActionsPanel.svelte`.
3. Remove the competing mental models. Decide in the spec whether `DurationPreviewWorkspace.svelte` becomes an optional animation pane or is retired. Do not maintain a second read-only timeline beside the editable `WorkspaceGrid`. Treat `DurationControl.svelte` as the precision control for the selected timeline step and `DurationPatternView.svelte` as a bulk operation on the same duration data.
4. Add regression coverage before the source fix. At minimum, assert that closing Sequence Actions and calling `closeAllPanels()` both cancel duration preview; Apply preserves the previewed result; Back/X/Cancel revert; opening another panel cannot leave `CreationWorkspaceArea` in preview mode. Add focused component coverage for the X path and pointer/keyboard coverage for `DurationResizeHandle.svelte`.
5. Verify the approved implementation at runtime. Exercise select-step → drag → release, exact entry, pattern preview → Apply, pattern preview → Back, pattern preview → X, tab change, and opening another panel. Check undo/redo after per-step and bulk changes. Visual changes require the repository viewport sweep and screenshots; interactive browser actions require Austen's permission in the active conversation.

## Decisions already made

- On 2026-08-08, Austen said the whole duration-modification experience was difficult and asked for an audit aimed at making it intuitive.
- Drag-to-modify duration already exists. Extend that behavior and its discoverability; do not build another parallel per-step duration mechanism.
- Austen reported the workspace-stuck state as a bug and supplied the screenshot. Recoverability is part of the required outcome, not optional polish.
- No implementation was approved in this conversation. Keep source changes behind the approval gate after the design spec is reviewed.

## Gotchas

- The core defect is split ownership. `subView` is local component state, but duration preview is global panel state. Closing the component can discard the local state without ending the global preview session.
- `CreationWorkspaceArea.svelte` does not require the Sequence Actions panel to be open before rendering `DurationPreviewWorkspace`. Repair the lifecycle rather than adding a presentation-layer condition that hides stale state.
- Back and Apply already end preview; X does not. A button-only patch would still miss external close paths, panel replacement, and any future coordinator close.
- Preview and persistence are distinct. `DurationPatternView.svelte` emits preview results continuously, while `handleDurationApply()` owns the undo snapshot and active-sequence update. Avoid writing preview results into the active sequence before Apply or creating multiple undo entries during drag.
- The drag handle has pointer and keyboard behavior and a 48 px pseudo-element hit area, but it appears only after step selection. Improve its visual affordance without breaking adjacent-cell selection at narrow widths.
- Desktop enters the special preview only when `isSideBySideLayout` is true. Mobile follows a different flow, so the approved design and tests must cover both instead of fixing only the screenshot layout.
