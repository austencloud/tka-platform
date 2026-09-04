# Shape Matrix App

## Outcome

Kinetic Shape Engine becomes a self-contained instrument that can fill a route
or an application panel. A visitor can
choose a matrix cell, inspect its exact realizations, and return to the matrix
without document scrolling. The page identifies Lorq Nichols as the creator of
the Shape Matrix without claiming ownership, permission, collaboration, or
endorsement.

## Rights and attribution

- Do not embed Lorq Nichols' original 144 Shape Matrix diagram unless written
  permission is obtained.
- Do not use “used with credit” or other language that implies an agreement.
- Identify Lorq Nichols, who publishes as Spin Science, as the creator of the
  Shape Matrix.
- Link to Lorq's original publication and Spin Science.
- Describe this surface as an interactive app, not as the original diagram or
  an official Spin Science release.

## Product structure

The shared app owns a host-sized shell with three persistent regions:

1. A compact top bar with attribution, TKA level, independently selectable
   blue-row and red-column turn bands, turn/ratio labels, the original-source
   link, and an About action. Host
   navigation stays outside the app.
2. A matrix pane containing the existing `ShapeMatrixGrid`.
3. A realization pane containing the existing `ShapeMatrixDrill`.

On desktop, both panes remain visible and may be resized through the shared
`PanelGroup`. On compact or short hosts, the same two panes remain mounted
but one fills the workspace at a time. Selecting a cell opens the realization
pane. A persistent Matrix action returns to the matrix with its scroll position
and selection intact.

The original diagram and long editorial preface leave the primary interaction
path. Concise context and source links live in an About modal using the shared
modal owner.

As of 2026-09-04, the formal product identity is `Kinetic Shape Engine`, with
`Shape Engine` as its compact name. `Shape Matrix Explorer` remains metadata's
legacy alternate name so old references stay intelligible; it is no longer the
visible product identity. The stable route remains `/notation/shape-matrix`.

The visible source line identifies the original matrix's VTG ratios: `1:1`,
`1:3`, and `1:5`. The About copy explains that Lorq used four even-petaled
driving styles from each ratio family, giving twelve choices for each hand and
144 left/right pairings. It also resolves the notation convention: Lorq's
labels appear as `1:1`, `3:1`, and `5:1` in this engine because its controls put
prop rotations before hand cycles.

The About copy separates three things: Nichols' original matrix, the level and
ratio matrices this engine generates, and the independent software built by
The Kinetic Alphabet. `Shape Matrix` and `Theory Matrix` remain the names of
matrix surfaces inside the larger engine. Source and About links stay present
without implying permission, collaboration, or endorsement.

## Selection and sharing

- A selected cell immediately opens with a realization active, rather than
  requiring an unexplained second tap before anything moves.
- Once a cell is selected, one realization always remains active. Clicking the
  active realization again does not fall back to a still mandala.
- Shape and realization changes preserve the outgoing animation while the next
  full realization starts in a hidden layer. The shape, mandala, and moving
  props crossfade only after the incoming player has painted its first canvas
  frame and reports motion beyond its start phase. The outgoing player retires
  from the crossfader's real settlement event, never a duration timer.
- Rapid changes coalesce to the latest selection without exposing an empty or
  still frame.
- Development instrumentation records request-to-canvas, request-to-motion,
  fade, total handoff time, effective frame rate, p95/worst frame gap, and
  missed-vsync percentage. The same phases appear as Performance Timeline
  marks for trace correlation.
- Level, both axis turn bands, active axis, label system, selected prop,
  relationship driver, blue flower, red flower, and realization mode are
  serialized in query parameters through the shared URL-state writer.
- Legacy `16/64/144` links migrate to the outer band they previously represented.
- Invalid or stale query values fall back safely without rewriting unrelated
  query parameters.
- Copying the browser URL therefore captures the exact interactive state.

## Transition choreography

Turn-band and ratio changes use one restrained visual sequence rather than a
collection of unrelated snaps:

- Controls acknowledge the new selection immediately. They do not wait for
  rendering or animation-player readiness.
- Matrix headers and cells keep stable slots while their inexpensive bitmap
  contents dissolve in place through the shared `Crossfade` owner. The table,
  scroll position, keyboard focus, and selected-cell geometry do not remount.
- The realization keeps its outgoing player moving until the incoming player
  has painted and advanced. The shared `DualSourceCrossfade` owns a named soft
  dissolve profile: the outgoing source recedes first and the incoming source
  follows by the canonical micro stagger, avoiding a bright double-glow frame.
- Subsequent realizations inherit the outgoing player's normalized cycle phase
  across different sequence lengths. First paint still begins at a deterministic
  non-starting phase, but changing a turn band no longer jumps to an unrelated
  point in the motion.
- The framed stage remains neutral. Each realization carries its own restrained
  element atmosphere inside the crossfaded layer, so color changes with the
  moving content instead of snapping on the container.
- Relationship copy crossfades only after the new realization owns the stage.
  The pictograph rail continues to update from that settled player.
- Reduced motion collapses every dissolve to the final state. Rapid changes
  retain the existing latest-request-wins contract and never expose an empty
  stage.

The choreography does not add zoom, slide, bounce, content-panel blur, or a
feature-local easing curve. Motion remains owned by the shared transition
primitives and canonical duration/stagger tokens.

## Capability ownership

Search terms: `Shape Matrix`, `realization pane`, `detail pane`, `ControlDock`,
`PanelGroup`, `DualSourceCrossfade`, `InlineAnimationPlayer`,
`URLSearchParams`, and `replaceState`.

- Reuse `ShapeMatrixGrid` for cell rendering, selection, keyboard semantics,
  internal overflow, and touch-target behavior.
- Extend `ShapeMatrixDrill` with an optional controlled realization mode. The
  drill remains the owner of realization building and presentation.
- Reuse `PanelGroup` for persistent responsive workspace panels and structural
  motion.
- Reuse `BaseModal` and `ModalHeader` for the About surface.
- Reuse `LevelSelector` with the canonical `DIFFICULTY_LEVELS` gradients for
  Levels 1–4. Reuse `SegmentedControl` for axis, turn band, label system, and
  relationship driver. Contextual controls use blue/red/both or neutral amber;
  no unrelated purple selection color is introduced.
- Reuse `BentoPropGrid` for prop selection. This educational host may include
  Poi, but retains the picker's normal access rules for premium cosmetics.
- Reuse `InlineAnimationPlayer` with zero autoplay delay for each realization.
- Keep the player's canonical canvas context menu enabled so right-click and
  long-press expose the established Disassemble/Reassemble and display actions.
- Reuse `StepStrip` beneath the visible realization and drive it from that
  player's live fractional step. The strip follows the animation that has
  actually entered the stage, not a newer selection that is still prewarming.
- Reuse `DualSourceCrossfade` for the two mounted animation layers so heavy,
  stateful players are never keyed out before their replacements are moving.
- Extend `DualSourceCrossfade` with a backwards-compatible soft-dissolve profile
  for additive/glowing media. Its default profile remains unchanged for every
  existing consumer.
- Reuse `Crossfade` inside stable matrix image slots for the cheap header and
  cell bitmaps. Do not crossfade or remount the table as a whole.
- Reuse `mutateCurrentUrl` for shallow URL synchronization.
- Create shared app factory/context state for loading, selection, responsive
  view state, and modal state. Route-specific persistence remains an injected
  adapter. No second Shape Matrix engine is introduced.

## Level and relationship model

- Level 1 exposes 0 turns.
- Level 2 exposes whole turns from 0 through 3.
- Level 3 adds half turns and Float.
- Level 4 exposes every quarter step from -0.25 through 3 and retains Float.
- Choosing a level lands the edited axis on the first rotating turn that level
  introduces: Level 1 at 0, Level 2 at 1, Level 3 at 0.5, and Level 4 at 0.25.
  Earlier values remain selectable because the level vocabulary is cumulative.
- Each axis owns its own turn band. The turn strip edits Blue rows, Red columns,
  or Both, with Both as the default. A numeric axis has four descriptors:
  pro/anti × in/out. Matching numeric bands therefore produce a 4×4 matrix;
  mixed bands remain a legible 4×4 instead of expanding the whole corpus.
- Float has no pro/anti rotation direction, but it has four valid absolute
  start orientations: in, out, clock, and counter. A Float axis therefore has
  four descriptors, so Float × Float is also 4×4. Clock/counter supply the
  lateral circle placements missing from the former 2×2 treatment.
- Turn labels may be read as TKA turn values or reduced prop-to-hand VTG
  pattern ratios. TKA Float reads as `0:1` in ratio mode, and TKA `-0.25`
  reduces from `0.5:1` to `1:2`. Positive quarter ratios use `3:2`, `5:2`,
  and the corresponding odd-over-two series. When the axes differ, the app
  names both explicitly,
  for example `Blue 3:1 × Red 1:1`. Primary VTG sources establish the individual
  pattern ratios but not `3::1` as a canonical hybrid abbreviation, so the app
  does not invent that shorthand.
- Users may choose the hand-path relationship or the resulting prop
  relationship. The matrix owns the two closed flower families; the realization
  owns their starting prop phase. When both turn bands are equal and non-Float,
  prop-first selection searches every start orientation available to that band.
  Quarter-turn flowers search the complete eight-state Level 4 wheel; earlier
  bands remain cardinal. A relationship is available only when at least one
  orientation pair reproduces both clicked flower loci and classifies as the
  requested prop relationship. The current hand path is retained when it can
  produce that target; otherwise the first compatible hand path becomes active,
  and a secondary hand choice disambiguates the remaining exact solutions.
- A generated realization is accepted only when both tracked prop loci match the
  matrix cell within the canonical geometric tolerance and classifying its actual
  first prop orientations returns the requested relationship. Unavailable
  relationships remain visible but disabled; a closest geometric candidate is
  never presented as canonical. Unequal turn bands can always name prop direction
  but not prop timing. Float names neither.
- The relationship readout is two element-colored badges joined by a derivation
  arrow. Element icons, names, and timing/direction labels remain visible so
  color is never the sole cue.
- One prop type is used by both hands. The complete prop artwork remains
  visible, while the matrix, mandala, and live trail follow one canonical
  tracked source. For staff-family props this is the thumb end; for other props
  it is the canonical primary endpoint from the shared trail-point registry.
  Props with no tracked source are not offered. Poi is identified as the VTG
  momentum reference, not as proof that every generated TKA realization is
  physically poi-legal.
- Hands and props are classified separately. Prop direction remains Same or
  Opposite whenever both props rotate. Prop timing is named only when their
  turn amounts match. Float has neither prop direction nor prop timing because
  the props do not rotate.
- The hand element supplies the realization theme. A second readout names the
  prop element, direction-only state, or Float state without forcing incomplete
  cases into VTG vocabulary.

Quarter-turn motion returns to its starting position before it returns to its
starting prop orientation. Matrix paths and realizations therefore repeat the
complete position cycle until the sequence engine reports orientation closure.
The closed flower uses the reduced ratio's whole-petal count rather than naming
the first position cycle as a fractional flower. For denominator-two ratios, IN
and OUT land on opposite halves of that same closed locus, so the matrix's second
phase resolves to CLOCK instead. The 90° phase produces the complementary flower
placement while preserving stable in/out URL keys. The existing quarter
pictograph arrow artwork is explicitly unapproved in the active
arrow-calibration spec, so quarter bands reserve the rail and state that
calibration is in progress instead of rendering missing or rejected arrows as
canonical notation.

## Responsive behavior

- The instrument chrome uses Flow Arts Composer's shared level and segmented
  control owners. Level buttons may opt into full canonical level gradients;
  selected state is reinforced by contrast and outline, never by an unrelated
  accent color. The group carries the visible label `Difficulty level`. When a
  level exposes only one value, that value is a passive readout rather than an
  oversized one-option button.
- The label-system switch spells out `TKA turns` and `VTG ratios`. Shape count,
  selected-band repetition, and blue-row/red-column instructions do not occupy
  the matrix pane; the controls and colored axes already communicate them.
- The realization header exposes the hands/props derivation explanation through
  an accessible info popover. The persistent surface contains a shared
  segmented `Choose by` control and the current result.
- Hand and prop relationship pickers use the same width thresholds: one row
  when it fits, three columns on narrow-tall hosts, and two columns in a
  short-wide rail. A prop-first secondary hand-path choice may add one row only
  when several hand paths genuinely produce the selected prop relationship.
- Both relationship pickers spell out the timing-and-direction family when the
  drill is wide enough for all six names. Tighter hosts use the shared VTG codes
  so changing between Hands and Props never changes the row's text density.
- On phone-width hosts, both pickers use the same compact two-row treatment and
  the pictograph rail yields its space to the live realization. The rail returns
  at wider tiers, where it no longer reduces the animation to a thumbnail.
- Prop selection composes the canonical grouped `BentoPropGrid`; this app may
  filter unsupported trail endpoints but does not invent another picker.
- The hero, pictograph strip, and relationship readout own explicit grid regions.
  A larger mode picker cannot collapse or displace the animation canvas, and a
  quiet mandala floor remains visible while an animation player warms up.
- The TKA word belongs to the animation header. The relationship row below the
  pictograph strip gives equal width to the hand and prop results rather than
  leaving the word as unframed trailing text.
- Hand and prop element colors blend as restrained atmosphere inside the
  realization workspace. They do not recolor the matrix or global page chrome.
- Hosts at `1440×900` and wider show both panes.
- `820×1180`, `960×412`, and `375×667` show one workspace pane at a time.
- Short-wide detail panes place the available realization controls in a two-column
  rail beside the hero. They omit the pictograph strip in that composition so
  the animation can use the full available height; taller layouts keep the
  strip directly below the hero.
- The 144-cell setting may scroll inside the matrix pane when 44px cells cannot
  physically fit. The document itself never scrolls.
- Native 4K uses added canvas for larger visual workspaces and a broader pane
  composition. Ordinary UI typography and controls do not scale with viewport
  width.
- At 200% zoom the shell recomposes to compact mode without clipping its top
  bar, modal, or pane-return action.

## Failure behavior

The matrix reserves its final workspace before data arrives. Loading and error
states stay inside each pane. A load failure leaves the source and About links
available and presents one retry action; it does not open a global modal.

## Verification

- Unit-test query parsing and serialization, invalid-value fallback, responsive
  view transitions, and selection persistence.
- Run focused Shape Matrix tests, `svelte-check`, and the production build.
- Exercise cell selection, realization selection, URL restoration, browser
  history, matrix return, retry, keyboard navigation, and touch targets. Trace
  both realization and cell changes to prove the outgoing layer keeps playing,
  the incoming layer starts at zero opacity, and both are moving throughout the
  crossfade. Repeat with rapid selections and confirm the latest choice wins
  without a blank frame. Read `window.__tkaShapeMatrixTransitions.summary()`
  after the run and inspect the matching `tka:shape-matrix:transition:*` marks
  in a performance trace.
- Inspect `375×667`, `960×412`, `820×1180`, `1440×900`, `1920×1080`,
  `2560×1440`, and `3840×2160`, plus 200% zoom.
- Record the finished route through Portrait Director and confirm that the
  compact app can be demonstrated without document scrolling.
