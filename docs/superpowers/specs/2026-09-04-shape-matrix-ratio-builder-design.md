# Shape Matrix Theory Ratio Builder

**Date:** 2026-09-04  
**Status:** Approved for implementation

## Outcome

Theory mode presents its primary job directly: enter one prop-to-hand ratio for
the left-hand rows and another for the right-hand columns, then inspect the
resulting 4×4 grid. Both ratios stay visible and editable at the same time.

## Interaction contract

- Replace Theory's serial `Apply to` control and single ratio readout with a
  two-sided builder.
- Label the task `Build a 4×4 ratio grid` and explain that each number accepts
  a whole value from 0 through 15.
- Present `Left-hand rows` and `Right-hand columns` as separate, directly
  editable ratio groups with `against` between them.
- Expose `Prop rotations` and `Hand cycles` visually, not only through
  assistive labels.
- Keep valid changes live. While either field is blank or invalid, keep the
  last valid grid and show the existing specific validation message locally.
- Preserve reduced-ratio feedback without rewriting digits under the cursor.
- Give each side a `Use for both` action. It copies that side's valid ratio to
  both axes without creating a persistent hidden editing mode.
- When an editor has focus, emphasize the corresponding row or column headers
  without moving the grid. Text labels remain the primary axis cue; blue and
  red are supporting domain identity.
- Theory's standalone subtitle describes the activity instead of listing only
  the historical source ratios. Source attribution remains available through
  the existing original-source and About actions.
- On compact layouts, the header trigger says `Edit ratios` and shows the full
  left-against-right pair. Its popover stacks both editors and keeps the same
  labels and validation.

## Responsive composition

- Wide and standard desktop: one authored builder cell in the existing Theory
  ribbon, with both editors in one horizontal equation.
- Height-constrained and narrow layouts: keep the existing compact top bar and
  move the complete builder into its existing popover.
- The builder sizes to its content. It must not stretch into an empty dashboard
  band or force horizontal page overflow.

## Motion and stability

- Ratio digits use tabular numerals and fixed field widths.
- Focus emphasis changes background and inset shadow only, so the grid never
  shifts.
- Matrix/Theory replacement remains owned by the existing `Crossfade`.
- Popover presence remains owned by the existing `flyFade` transition.
- Reduced motion removes decorative transitions while retaining focus and
  selected-state cues.

## Capability ownership

- **Extend `ShapeMatrixRatioEntry`:** keep it as the sole owner of ratio text,
  parsing, validation, reduction feedback, keyboard nudging, and commit timing;
  add an explicit left/right target and the new presentation.
- **Compose in `ShapeMatrixTheoryControls`:** render the two entries and the
  equation copy. Do not create another ratio-input implementation.
- **Reuse `setTheoryRatioFor`:** all independent left/right updates continue
  through the existing state factory. `Use for both` calls the atomic
  `setTheoryRatios` state method so the grid and URL never observe half of a
  copied pair.
- **Extend `ShapeMatrixGrid`:** add an optional presentation-only emphasized
  axis. Selection, painting, sizing, and keyboard behavior stay unchanged.
- **Keep:** `SegmentedControl` for the Matrix/Theory surface choice,
  `Popover` for compact disclosure, the URL state owner, and all matrix-cell
  selection behavior.
- **Remove from Theory presentation:** `ShapeMatrixAxisControl`. Matrix mode
  retains its existing axis editing behavior.

## Verification

- Focused tests cover per-hand edits, atomic `Use for both`, validation, ratio
  reduction, persistence, and URL round trips.
- Browser interaction proves `15:14` against `14:15`, `0:1`, invalid `0:0`,
  both copy directions, keyboard access, visible row/column focus feedback,
  and the compact popover.
- Visual review covers 375×667, 960×412, 820×1180, 1440×900, 1920×1080,
  2560×1440, 3840×2160, and 200 percent zoom, including a real Matrix/Theory
  transition and reduced motion.
