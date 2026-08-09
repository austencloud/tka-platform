# Create Duration Editing — Design Spec (2026-08-08)

Status: IMPLEMENTED 2026-08-08 (approved "go forth"). Lifecycle fix + tests in
`14069b0..e72ed4a4a7`; DurationPreviewWorkspace retired (option a); preview
renders on the editable timeline; grip + duration chip shipped. Verified at
runtime (X-close recovery, pattern preview → timeline) and across the viewport
sweep. Known pre-existing gap: the panel's persisted duration subview restores
after a full page reload without re-entering preview mode, so pattern changes
in that stale subview don't preview until Back → Duration re-entry.
Origin: read-only audit handoff `2026-08-08-duration-editing-audit-handoff.md`.

## Problem

Duration editing in Create is hard to understand and can strand the workspace.

1. **Three competing mental models.** Per-step drag (`DurationResizeHandle.svelte`
   in `WorkspaceGrid.svelte`), exact per-step entry (`DurationControl.svelte`),
   and sequence-wide patterns (`DurationPatternView.svelte`) each present
   duration differently. The pattern flow replaces the editable workspace with a
   separate animation plus a read-only width timeline
   (`DurationPreviewWorkspace.svelte`), so the user edits in one surface and
   previews in another.
2. **Stuck-workspace bug (confirmed).** Duration preview is global panel state
   (`isDurationPreviewMode` / `previewSequence` / `originalSequence` in
   `src/lib/shared/create/state/panel-coordination-state.svelte.ts`), but the
   Sequence Actions duration subview is local component state. Only the Back
   path (`exitSubView()`, SequenceActionsPanel.svelte:471-473) cancels preview.
   The subview X routes to the generic `handleClose`;
   `SequenceActionsCoordinator.svelte` handles it by calling only
   `closeSequenceActionsPanel()` (line 725-727 of panel-coordination-state),
   which clears just the open flag. `closeAllPanels()` (lines 478-515) also
   leaves the three preview fields untouched. `CreationWorkspaceArea.svelte`
   renders `DurationPreviewWorkspace` whenever the surviving preview flag and a
   sequence are truthy — so closing the panel via X, panel replacement, or any
   coordinator close leaves the workspace trapped in preview.
   Regression boundary: `ab65ec6e39` removed `handleDurationDrawerClose()`
   (which called `exitDurationPreviewMode(false)`) when the duration drawer
   became an inline subview.

## Decisions already made (Austen, 2026-08-08)

- The whole duration-modification experience is difficult; make it intuitive.
- Drag-to-modify already exists — extend it and its discoverability; do NOT
  build another parallel per-step duration mechanism.
- The stuck workspace is a bug; recoverability is a required outcome.

## Design: one canonical duration editor

The editable timeline (`WorkspaceGrid`) is the single surface where duration is
seen and changed. Everything else operates on it, never beside it.

1. **The timeline stays visible and editable at all times** during duration
   work — per-step drag, exact entry, and pattern application all act on the
   same timeline the user is looking at.
2. **Selected step shows a clear grip and its duration value.** The existing
   `DurationResizeHandle` (pointer + keyboard, 48px hit area) is the mechanism;
   improve its visual affordance so it reads as draggable without hunting.
   Do not break adjacent-cell selection at narrow widths.
3. **Continuous preview during drag; one undoable commit on release.** Preview
   results never write into the active sequence before commit, and a drag never
   creates multiple undo entries. (`handleDurationApply()` remains the owner of
   the undo snapshot and active-sequence update.)
4. **Exact-number entry stays.** `DurationControl` is the precision control for
   the selected timeline step — same data, same commit semantics.
5. **Sequence-wide patterns apply against the same timeline.**
   `DurationPatternView` is a bulk operation on the same duration data; while a
   pattern preview is active, the timeline itself shows the previewed widths.
6. **Animation is supporting feedback, not the editor.** Decide between:
   - (a) retire `DurationPreviewWorkspace` entirely, or
   - (b) keep it as an optional playback pane alongside — never instead of —
     the editable timeline.
   Recommendation: (a) unless playback during pattern preview proves its worth;
   a second read-only timeline beside the editable grid is explicitly out.
7. **Every exit path recovers.** Back, X, Cancel, tab change, panel close, and
   opening any mutually exclusive panel all revert an uncommitted preview.

## Lifecycle invariant (the bug fix)

Fix at the state owner, not the X button: any path that closes Sequence
Actions or opens a mutually exclusive panel must cancel an active duration
preview — clearing `isDurationPreviewMode`, `previewSequence`, and
`originalSequence`.

- `closeSequenceActionsPanel()` and `closeAllPanels()` in
  `panel-coordination-state.svelte.ts` call `exitDurationPreviewMode(false)`
  (or equivalent inline reset) when preview is active.
- `SequenceActionsPanel.svelte`'s local subview cleanup and
  `SequenceActionsCoordinator.svelte`'s close handler are reviewed so no path
  bypasses the invariant.
- Do NOT paper over it with a presentation-layer condition in
  `CreationWorkspaceArea.svelte` (e.g. requiring the panel to be open) — the
  stale state itself must end.

## Scope

Both layouts. Desktop enters the special preview only when
`isSideBySideLayout`; mobile follows a different flow. The design and its tests
cover both, not just the screenshotted layout.

## Test plan (regression coverage lands BEFORE the source fix)

State-level (extend `tests/unit/create/` panel-state coverage):
- Closing Sequence Actions cancels duration preview.
- `closeAllPanels()` cancels duration preview.
- Apply preserves the previewed result; Back/X/Cancel revert to the original.
- Opening another panel cannot leave the workspace rendering preview.

Component-level (per `component-test-discipline.md`, this is test-on-fix):
- The subview X path ends preview.
- Pointer and keyboard coverage for `DurationResizeHandle.svelte`.

## Runtime verification (after implementation)

Exercise: select step → drag → release; exact entry; pattern preview → Apply;
pattern preview → Back; pattern preview → X; tab change mid-preview; opening
another panel mid-preview. Check undo/redo after per-step and bulk changes.
Visual changes take the full viewport sweep per
`visual-verification-mandatory.md`.

## Out of scope

- Any new duration input mechanism beyond the three existing surfaces.
- Changes to duration semantics, timing math, or the animation engine.
