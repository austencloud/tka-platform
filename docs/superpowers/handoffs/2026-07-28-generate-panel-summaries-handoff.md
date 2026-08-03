# Generate panel summaries and LOOP icons handoff

Date: 2026-07-28

Target: the Generate settings panel in Create, plus its public Composer demo consumer

Status: SHIPPED 2026-07-28. Implemented, unit tested, and verified in the
browser on both routes at all seven required viewports. See "What shipped"
below for the four places the implementation had to depart from this contract.

## Mission

Replace the Customize card's generic `Custom` state with a compact, truthful
summary of the settings that differ from that surface's baseline. Add the
canonical selected LOOP component icons below the LOOP text label. Keep both
cards at stable half widths.

The implementation must preserve every active generation constraint, remain
legible from phone through native 4K, and avoid any card movement when a setting
changes.

## What shipped

Files changed:

| File | Change |
| --- | --- |
| `components/cards/customize-summary.ts` | New. Pure resolver, shared orientation map, `capSummaryFacts`, `summaryRowBudget` |
| `components/cards/loop-card-display.ts` | New. Pure LOOP display model: period gate, axis normalization, overlay grouping, `describeLoopRhythm` |
| `components/cards/CustomizeCard.svelte` | Consumes the resolver; injected `styleBaseline`; measured row budget; accessible name; three-row type ramp |
| `components/cards/CustomizeExpandedOverlay.svelte` | Imports the shared orientation abbreviations |
| `components/cards/ConsolidatedLOOPCard.svelte` | Canonical icon strip, reserved row, rhythm props, length-tiered label |
| `components/CardBasedSettingsContainer.svelte` | Reads the new rhythm fields so the descriptor stays reactive |
| `shared/services/card-configurator.ts` | Passes `period`, `inversionInterval`, `inversionMode` |
| `routes/(public)/composer/_sections/GenerateSection.svelte` | Demo baseline, `period`, and a card-cell sizing fix |
| `components/cards/__tests__/customize-summary.test.ts` | New. 22 tests |
| `components/cards/__tests__/loop-card-display.test.ts` | New. 17 tests, including the descriptor wiring and the 3/3 span |

### Departures from this contract

1. **`loop-card-display.ts` was extracted**, taking the escape hatch this doc
   allowed. The period gate, axis normalization, interval conversion, and
   overlay grouping were four conditionals too many for the component.
2. **The three-row budget is measured, not fixed.** At 375x667 the card is 64px
   tall with a 28px summary band — room for exactly one row, and three rows
   clipped mid-glyph. `summaryRowBudget(cardHeight)` returns 3 / 2 / 1, and the
   one-row form is `Props: Choppy +5` rather than a bare `+5 more`, which would
   have been the uninformative label this work exists to remove.
3. **The type ramp is a fraction of `--card-text-size`, not of card width.**
   Container-width units freeze at the desktop grid's 750px cap, so a `cqw`
   ramp sat at ~10px while every sibling card's value grew to 30px at 4K. Both
   cards now use the same two fractions with px floors and ceilings; the LOOP
   label picks its tier from label length, and a short card clamps it to one
   line with an ellipsis.
4. **Leading went from 1.1 to 1.35 on both clipped elements.** `overflow:
   hidden` clips vertically as well as horizontally, and 1.1 is tighter than
   this font's ink box, so descenders were being shaved.

Also fixed, because it made the LOOP card unverifiable on the demo route: the
public Composer's `.card-cell` never sized its child, so `.loop-card-wrapper`
(the one card that does not set its own height) collapsed to 2px and spilled
its label over the panel. The demo now mirrors the app grid's sizing rule.

Left alone as instructed: the unused `cards/LOOPCard.svelte`, the
non-interpolable `transition: grid-column`, and the 750px desktop grid cap.
That cap is why both cards still read small at 2560 and 3840 — it deserves the
separate native-4K audit this doc calls for.

## Done — verified

- Traced the production path:
  `GeneratePanel.svelte` -> `CardBasedSettingsContainer.svelte` ->
  `card-configurator.ts` -> `CustomizeCard.svelte` and
  `ConsolidatedLOOPCard.svelte`.
- Confirmed the two card consumers with repository search:
  `CardBasedSettingsContainer.svelte` and
  `src/routes/(public)/composer/_sections/GenerateSection.svelte`.
- Confirmed `card-configurator.ts` currently assigns both cards a fixed
  `gridColumnSpan` of 3 in a six-column grid.
- Confirmed `CustomizeCard.svelte` marks several states non-default but only
  summarizes Classic 3, a single allowed start position, and non-default
  orientations. Style values, end position, most custom position sets, the
  legacy exact start position, and persisted letter constraints can therefore
  collapse to the bare word `Custom` or be missed by default detection.
- Confirmed the expanded Customize overlay already owns the `N pos` summary
  rule and duplicates the same orientation abbreviations. Those rules should be
  extracted, not independently re-authored.
- Confirmed `StartEndOptions` also carries `startPosition`,
  `mustContainLetters`, and `mustNotContainLetters`. They still affect
  generation through `generate-actions.svelte.ts`, even though the current
  compact overlay does not edit all of them.
- Confirmed the stale Customize accessible label still promises a removed
  rhythm section.
- Confirmed `LOOPIconStrip.svelte` is the canonical reusable icon renderer. It
  already supports selected components, rotation and inversion periods,
  inversion overlay grouping, icon order, colors, and the freeform-empty case.
- Confirmed the LOOP card already parses selected components and retains the
  exact text label needed for reflection axes and long combinations.
- Queried the Flow Arts MCP for LOOP ground truth. It confirmed the component
  model and the four supported reflection axes. No LOOP semantics in this
  handoff rely on memory.
- Reviewed the screenshot supplied with this task at its native 3840 x 2160
  resolution. It shows the current generic `Custom`, text-only `Rotated`, and
  equal card widths.
- Ran a read-only Claude Opus review against the exact source files. Opus used
  plan mode with only Read, Glob, and Grep tools. It made no edits. Session:
  `5f1a02a6-3d16-42e8-b96b-036dbe29bd36`.
- Checked the worktree after the review. No Generate files were modified during
  this investigation.

Current external guidance supports exposing current state instead of requiring
recall, keeping the accessible name aligned with the visible label, and using a
two-thirds supporting-pane layout only when the secondary pane remains usable:

- Nielsen Norman Group, [Recognition Rather Than Recall](https://media.nngroup.com/media/articles/attachments/Heuristic_6_A4_compressed.pdf)
- Nielsen Norman Group, [Visibility of System Status](https://media.nngroup.com/media/articles/attachments/Heuristic_1_compressed.pdf)
- Material 3, [Canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
- Android Developers, [Canonical layouts](https://developer.android.com/develop/ui/views/layout/canonical-layouts?hl=en)
- W3C, [G211: Matching the accessible name to the visible label](https://www.w3.org/WAI/WCAG21/Techniques/general/G211)

## Believed done — unverified

- The design direction is settled: capped text facts for Customize, the
  existing LOOP icon strip below the label, and a stable 3/3 grid split.
- The proposed three-row summary budget is based on source geometry and the
  supplied screenshot. It has not been rendered. The implementation must
  measure it at every required viewport and adjust typography or grouping
  without reintroducing a generic `Custom` label.
- A fixed reserved icon row should prevent the LOOP text from moving when LOOP
  toggles on and off. This remains unverified until browser screenshots and
  element measurements exist.

## In flight

Nothing. This pass intentionally stopped before implementation so the next
Opus session can begin from a reviewed, source-backed contract.

## Loose ends (ranked)

1. Add one pure Customize summary resolver and make both default detection and
   visible facts consume its result.
2. Render `LOOPIconStrip` below the LOOP label with accurate component, period,
   reflection-axis, and inversion-mode inputs.
3. Update both card consumers, including the public Composer demo's distinct
   baseline and missing LOOP rhythm props.
4. Add pure unit coverage for the summary resolver and the LOOP card display
   model or descriptor wiring.
5. Run targeted checks, then perform the mandated two-route, seven-viewport
   visual verification loop.
6. Keep adjacent cleanup separate. The unused legacy `LOOPCard.svelte`, the
   non-interpolable `transition: grid-column`, and the grid's global 750 px cap
   predate this work.

## Decisions already made

### 1. Customize shows actual non-default facts

Create a pure module beside the card, tentatively:

`src/lib/features/create/generate/components/cards/customize-summary.ts`

Recommended contract:

```ts
buildCustomizeSummary(input, baseline): {
  isDefault: boolean;
  facts: string[];
  accessibleSummary: string;
}
```

`isDefault` must be derived from `facts.length === 0`. Do not maintain a second
boolean comparison that can drift away from what the card displays.

The baseline is a required concept, not a convenience:

- The production Generate panel uses `GENERATE_DEFAULT_CONFIG`.
- The public Composer demo deliberately starts with Hands `smooth` and Dashes
  `no-dash`, while production defaults are Hands `mixed` and Dashes mixed/null.
- `CustomizeCard` therefore needs an optional injected style baseline, falling
  back to `GENERATE_DEFAULT_CONFIG`. The demo must pass its own initial recipe.
  Otherwise the enhanced card will loudly claim that an untouched visitor made
  two changes.

Use the labels and mappings that already exist in
`StyleExpandPanel.svelte`, `CustomizeExpandedOverlay.svelte`,
`start-position-presets.ts`, and `PositionSection.svelte`:

| State | Compact fact |
| --- | --- |
| Props differs from baseline | `Props: Choppy` |
| Hands differs from baseline | `Hands: Smooth` |
| Dashes differs from baseline | `Dashes: Low` or `Dashes: High` |
| Classic allowed-position set | `Classic 3` |
| One allowed position | `Start: <position>` |
| Other restricted set | `<N> pos` |
| Legacy exact start position | `Start: <position>` |
| End position | `End: <position>` |
| Either start orientation differs | `Ori: In/CW` |
| Required/excluded letters exist | reuse the existing `+N` / `-N` count grammar |

Fact order follows the overlay: style, start/end positions, orientation, letter
constraints. Use the shared position display precedence
`startPosition ?? letter ?? "?"` rather than assuming every persisted
`PictographData` has the same shape.

The card must never fall back to the uninformative word `Custom`. If facts are
present:

- Show at most three visual rows.
- When more facts exist, use the last row for `+N more`.
- Keep the complete, uncapped facts in the button's accessible name.
- Reserve a stable summary body height and add `overflow: hidden` as a backstop.
- Add a three-row typography tier. The current CSS only adapts to two rows.
- Export the shared orientation abbreviation map from the resolver and remove
  the duplicate in `CustomizeExpandedOverlay.svelte`.
- Remove `rhythm` from the card's accessible description.

Start with plain text rows, not interactive-looking chips. Opus considered both
and recommended text because the constraint is vertical height, not horizontal
width. A chip grid adds a new visual language and needs a separate measured
design case.

### 2. LOOP keeps text and adds the canonical icons below it

Reuse:

`src/lib/shared/components/LOOPIconStrip.svelte`

Do not add a Font Awesome map or a second LOOP renderer to the card. Keep the
existing text label because the strip cannot encode the four reflection axes or
every combined type precisely.

Required display behavior:

- Place a centered icon strip below the LOOP text.
- Keep an icon-row wrapper in both on and off states so the label does not
  shift. Hide its contents when LOOP is off.
- Pass `showFreeformWhenEmpty={false}`. Its default is true and would otherwise
  show an infinity glyph for an off LOOP.
- Put the visual strip inside an `aria-hidden="true"` wrapper. The nested strip
  has its own `role="img"` and label, while the parent button already owns the
  interaction and accessible name.
- Expand the button's accessible name so it contains the visible text and the
  relevant halved/quartered or overlay detail. Do not let the visible label and
  accessible label contradict each other.
- Derive icon size from the card's measured height with a bounded clamp. A
  literal 16 px size is too small at native 4K. Opus proposed the initial
  formula `clamp(12, round(height * 0.15), 24)` for visual testing.

The card needs enough config to render the same LOOP the generator will use:

- `period`
- `inversionInterval`
- `inversionMode`
- `reflectionAxis`

Pass all four through `card-configurator.ts`. The public Composer demo must also
pass its local `period` and `reflectionAxis` where applicable.

Use `resolveLoopConfig` as the period gate before choosing the rotation glyph.
A persisted quartered value on a non-rotated LOOP must not produce the
quartered rotation icon. Convert inversion interval `2 | 4` to
`Period.HALVED | Period.QUARTERED` explicitly.

When inversion mode is `overlay`, pass the active inverted component in
`overlayComponents` so `LOOPIconStrip` retains its separator grammar.

Normalize reflection icons against the effective axis:

- east-west uses the existing flipped component icon;
- north-south uses the existing mirrored component icon;
- diagonal axes retain the generic reflection icon while the text carries the
  exact diagonal axis.

This prevents a text/icon contradiction when a legacy mirrored LOOP is paired
with an east-west axis.

### 3. Keep Customize and LOOP at 3/3

Reject both state-count-driven 4/2 and width-responsive 4/2 for this card pair.

The local evidence is stronger than the general supporting-pane pattern:

- `CardBasedSettingsContainer.svelte` caps the entire desktop card grid at
  750 px.
- In that grid, a two-column LOOP card is about 243 px wide, versus about
  370 px at the current three columns.
- The LOOP card's longest localized combination is roughly 38 characters
  before adding the icon row.
- Changing span when a user adds a setting directly violates
  `.claude/rules/no-layout-shift.md`: a control would resize its neighbor when
  its own value changes.
- `grid-column` changes discretely. The existing
  `transition: grid-column` cannot smooth that resize.
- Grid row height is independent of column span, so giving Customize four
  columns does not create room for another summary row.
- The multi-line summary font uses `cqw`; widening the card increases its font
  size and can reduce, rather than increase, vertical capacity.

Material's two-thirds supporting-pane pattern remains useful general guidance,
but it does not make a 243 px secondary card with a long label usable here.
Revisit 4/2 only as part of a future LOOP-card redesign that replaces the long
prose label with a proven compact representation.

### 4. Minimal implementation file set

| File | Expected change |
| --- | --- |
| `components/cards/customize-summary.ts` | New pure resolver; shared labels, default comparison, uncapped facts |
| `components/cards/CustomizeCard.svelte` | Consume resolver; injected baseline; capped text; accessible name; overflow/three-row styles |
| `components/cards/CustomizeExpandedOverlay.svelte` | Import the shared orientation and position summary rules |
| `components/cards/ConsolidatedLOOPCard.svelte` | Render canonical strip; accept rhythm props; stable row; axis/period/overlay accuracy |
| `shared/services/card-configurator.ts` | Pass `period`, `inversionInterval`, and `inversionMode` |
| `src/routes/(public)/composer/_sections/GenerateSection.svelte` | Pass demo baseline and LOOP period/axis values |
| `tests/unit/features/create/generate/customize-summary.test.ts` | Pure summary behavior |
| Existing descriptor or new pure LOOP display-model test | Protect period, axis, off, and overlay wiring |

If accurate LOOP card inputs require enough conditionals to obscure the Svelte
component, extract a small pure `loop-card-display.ts` beside the card and test
it. Do not pull the sequence-oriented `loop-display-resolver.ts` into this
config-only card; that resolver expects generated sequence data.

### 5. Test contract

The Customize resolver tests should prove:

- untouched production defaults return `isDefault: true`;
- the injected public-demo baseline also returns `isDefault: true`;
- each style axis produces its own fact;
- Classic 3, one position, and a four-position custom set are distinct;
- legacy exact start and end positions are not lost;
- non-default orientations are abbreviated consistently;
- active required/excluded letter constraints prevent `Default`;
- visual truncation produces the correct remainder while the accessible
  summary remains complete.

The LOOP display tests should prove:

- off produces no active/freeform icon;
- rotated quartered selects the quartered icon;
- non-rotated stale quartered config is gated to halved;
- east-west reflection chooses the flipped icon while preserving exact text;
- diagonal reflection preserves exact text with the generic reflection icon;
- inversion interval 4 reaches the quartered inversion icon;
- overlay inversion reaches `overlayComponents`;
- the production descriptor passes all rhythm inputs.

Use pure/data tests. Existing `LOOPIconStrip` unit coverage already protects the
primitive's icon-path selection, and this repository does not have a reliable
Svelte mounting harness for these cards.

### 6. Verification contract

Before any `done` or `fixed` claim:

1. Run the focused new tests and relevant existing LOOP icon tests.
2. Run the project-prescribed targeted TypeScript/Svelte check workflow.
3. Verify both routes:
   - Create module, Generate tab
   - `/composer`
4. Capture and inspect:
   - 1920 x 1080
   - 2560 x 1440
   - 3840 x 2160 at device scale factor 1
   - 1440 x 900
   - 820 x 1180
   - 960 x 412
   - 375 x 667
5. Exercise Default, one fact, three facts, overflow facts, LOOP off, every
   single component, the longest combined label, diagonal reflection, and
   quartered rotation/inversion.
6. Query `scrollHeight > clientHeight` for `.card-summary` and `.card-value`.
   No summary may spill into the LOOP card.
7. Confirm computed icon and summary font sizes at phone, desktop, and native
   4K sizes.
8. Confirm the LOOP label and neighboring card geometry do not move when LOOP
   or a Customize setting changes.

Visual changes trigger `.claude/rules/visual-verification-mandatory.md`; passing
unit tests and type checks alone are not sufficient.

## Gotchas

- The repository is shared with other live sessions. Recheck overlap before
  editing and commit only explicit owned paths.
- Stay on `main`. Do not create a branch or worktree without Austen's explicit
  request in the current conversation.
- Port 5173 belongs to Austen and is HTTPS/2 only. Do not start, stop, restart,
  or kill it. Use a separate free port if an isolated server is necessary.
- `CustomizeCard` currently treats the production defaults as universal. That
  is already false for the public demo.
- `startPosition` is deprecated but persisted. Letter constraints are not all
  exposed by the current compact overlay, but they remain generation inputs.
  A truthful collapsed card must not call either state `Default`.
- `LOOPIconStrip` shows freeform when empty unless explicitly told not to.
- The strip's built-in accessible image label duplicates the parent button
  unless its visual wrapper is hidden from the accessibility tree.
- `parseLoopComponents` alone does not normalize a stored reflection type
  against a changed reflection axis.
- `Period` and `inversionInterval` use different types.
- Inversion overlay mode is visually meaningful and easy to drop if only the
  component set and periods are passed.
- The card grid and wrappers intentionally use visible overflow for popovers.
  The summary itself must contain its text.
- The public demo renders the same two cards but bypasses
  `card-configurator.ts`; it must be updated directly.
- `cards/LOOPCard.svelte` appears unused and duplicates some labels. Do not turn
  this scoped UI task into dead-code cleanup.
- The 750 px desktop grid cap may deserve a separate native-4K audit. Do not
  silently change it as part of this work.
