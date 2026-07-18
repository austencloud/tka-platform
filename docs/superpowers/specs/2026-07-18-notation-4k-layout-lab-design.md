# Notation 4K Layout Lab Design

**Date:** 2026-07-18
**Status:** Approved direction; pending written-spec review
**Route:** `/test/notation-4k`

## Purpose

Build a native Svelte comparison harness for two large-screen compositions of
the Flow Arts Notation page. The harness must use the application's real
marketing chrome, controls, pictograph renderer, sequence data, and live player.
It must not modify the production `/notation` route.

The page has one job: let Austen switch between the Editorial Atlas and
Cinematic Runway compositions at full canvas width and judge which parts belong
in the production redesign.

## Scope

### In scope

- One client-only test route under the existing `/test/*` harness.
- A two-option native segmented control with `Atlas` and `Cinematic` modes.
- One shared content tree whose layout changes without remounting the live
  sequence player.
- Representative production copy and source links from `/notation`.
- Real QFT, VTG, TKA, Shape Matrix, sequence-strip, and live-animation content.
- Responsive behavior from phone widths through a 4K monitor at common Windows
  scaling settings.
- Keyboard focus, reduced-motion support, stable loading geometry, and a
  `noindex` directive.

### Out of scope

- Changes to `/notation`, `public-editorial.css`, or shared primitives.
- A final production information architecture.
- New global design tokens or utility classes.
- New notation rendering logic.
- Persistence of the selected layout mode.
- Automated screenshot infrastructure.

## Chosen architecture

Use one shared DOM tree with a route-owned `layoutMode` state. A layout class on
the study root reconfigures the same semantic content through CSS Grid and
container queries. This keeps the comparison honest: content and component
instances remain identical while only composition changes. In particular,
switching modes must not restart the live animation player.

Two rejected alternatives:

1. Separate conditionally rendered Atlas and Cinematic components. This gives
   each mode complete markup freedom, but duplicates content and remounts heavy
   components when toggled.
2. Separate test routes. This isolates CSS but makes direct comparison slower
   and expands the prototype surface without improving the decision.

## File boundaries

- `src/routes/test/notation-4k/+page.svelte`
  - Owns page metadata, `layoutMode`, the segmented control, and the marketing
    chrome wrapper.
- `src/routes/test/notation-4k/_components/NotationLayoutStudy.svelte`
  - Owns the shared semantic page structure and applies the active layout mode.
- `src/routes/test/notation-4k/_components/NotationRosetta.svelte`
  - Owns the three-way QFT, VTG, and TKA comparison.
- `src/routes/test/notation-4k/_components/NotationShapeMatrix.svelte`
  - Owns the accessible 12 by 12 Shape Matrix artifact.
- `src/routes/test/notation-4k/_components/NotationSequenceStage.svelte`
  - Composes the real live player with a strip of real rendered sequence beats.

No barrel export is introduced. Imports point directly to their source files.

## Real primitives and data

The harness uses these existing project pieces:

- `MarketingChrome.svelte` for the cosmic background, `SiteHeader`, footer, and
  marketing theme setup. `/test/*` is not wrapped by it at the root, so this
  route mounts it directly.
- `SegmentedControl.svelte` for the Atlas/Cinematic switch.
- `PictographContainer.svelte` for the TKA Rosetta sample and each sequence beat.
- `SequenceHeroDemo.svelte` for the live square animation player.
- `demo-sequence.json` as the single source of sequence and beat data.
- Fraunces, Inter, and the TKA glyph font already loaded by the application.

The QFT circle, VTG quadrant, and Shape Matrix remain code-native diagrams. They
represent other notation systems and do not have shared application primitives.
Their geometry comes from the current `/notation` implementation rather than a
new visual substitute.

## Composition

### Shared foundation

Both modes use the same content order:

1. Hero and thesis
2. Three-system Rosetta comparison
3. Spinner-notation lineage
4. Shape Matrix artifact
5. TKA synthesis
6. Live sequence and pictograph strip
7. Existing creation call to action

Paragraphs retain a readable measure. Essential text never drops below 14px;
captions and small labels never drop below 12px. Type follows the existing fluid
ramps and does not jump to oversized display text on 4K.

The visual signature is the notation geometry itself. Circular QFT points,
VTG's relational quadrant, the 12 by 12 matrix, and TKA's grid form a repeated
progression across the page. Decorative card grids are not added.

### Editorial Atlas

At the large-screen container tier, Atlas uses a calm 12-column field:

- The hero splits into a four-column title rail and an eight-column thesis.
- The Rosetta comparison spans the field as three equal notation specimens.
- The lineage becomes two coordinated reading columns rather than one long
  centered strip.
- The Shape Matrix occupies a large artifact column beside its explanation and
  sources.
- The sequence stage spans the field. The live square player sits beside a
  multi-beat strip rendered from the same sequence.

Atlas should feel like a working reference table: dense enough to reward a large
monitor, but not like a dashboard.

### Cinematic Runway

At the same large-screen tier, Cinematic keeps a narrow narrative rail and lets
key artifacts interrupt it:

- The hero has more vertical breathing room and a centered title.
- The Rosetta comparison becomes a panoramic full-width band.
- The lineage returns to a single reading rail.
- The Shape Matrix becomes a singular wide stage with explanation anchored
  alongside it rather than another card.
- The sequence area becomes a full-width stage. The existing square player is
  not stretched beyond its contract; it is composed with the real pictograph
  strip to use the horizontal canvas.

Cinematic should feel like walking through an exhibit, with fewer simultaneous
reading choices and stronger pauses between artifacts.

## Responsive rules

- Mobile-first base: one column, natural document order, full-width control,
  and no horizontal scrolling.
- Mid-width screens: Rosetta may use three columns when each specimen retains
  enough room; the rest remains linear.
- Large-screen study tier: a named inline-size container activates the selected
  Atlas or Cinematic composition at approximately 96rem of available width.
  This catches a 4K monitor reporting about 1920 CSS pixels under 200 percent
  Windows scaling while leaving laptop layouts alone.
- Outer width is capped with viewport-relative gutters so content remains one
  composition on 3840px and ultrawide canvases.
- Component sizing responds to its assigned container. Viewport queries are
  reserved for page-level chrome clearance.

## Interaction and accessibility

- The mode control remains visible near the top of the study and uses the
  existing segmented-control button semantics.
- Switching modes updates only the layout class and an explanatory mode label.
- Focus remains on the selected control after switching.
- The page has one `h1`; section headings preserve a logical hierarchy.
- Diagram alternatives describe the information encoded by each visual.
- Resource links retain visible focus states and external-link semantics.
- Reduced-motion preference disables route-owned transitions. Existing
  components keep their own reduced-motion behavior.

## Data flow and failure behavior

`+page.svelte` owns a string union, `"atlas" | "cinematic"`, and passes it to
`NotationLayoutStudy`. The study passes the imported `SequenceData` fixture to
`NotationSequenceStage`. That component passes the full sequence to
`SequenceHeroDemo` and individual steps to `PictographContainer`.

There is no network request and no user-supplied data. No new error boundary or
try/catch is earned. `SequenceHeroDemo` already reserves its square stage while
the lazy player loads. If its dynamic import is delayed, the stable stage remains
visible and the rest of the comparison still works.

## Verification

The implementation is complete only when all applicable checks have evidence:

1. Prettier reports the new route and components clean.
2. `npm run check` reports zero errors and zero warnings attributable to the
   harness.
3. A focused production build or equivalent SvelteKit compile confirms the
   route is included. Any unrelated repository build failure must be reported
   with its exact output and separated from harness results.
4. A local HTTP request to `/test/notation-4k` returns successfully from the
   user's existing dev server or an allowed secondary Vite port.
5. Visual verification at a large-screen viewport checks both modes, control
   switching, overflow, readable measures, stable player geometry, and console
   messages. Browser verification occurs only after explicit user permission in
   the current conversation.

Project testing guidance treats obvious UI rendering as a visual concern, so no
low-value component snapshot test is added. Any nontrivial extracted layout-mode
logic would require a focused unit test written before implementation; the
current design intentionally keeps that logic to a typed state value and CSS.

## Acceptance criteria

- `/test/notation-4k` presents Atlas by default and switches to Cinematic with
  the real segmented control.
- The switch does not duplicate content or remount the live sequence player.
- Both layouts use the same real sequence fixture and real TKA renderer.
- Atlas visibly uses parallel 4K space; Cinematic visibly uses panoramic artifact
  stages.
- The live animation remains square and undistorted in both compositions.
- Narrow screens preserve one semantic column with no horizontal overflow.
- Production `/notation` and shared primitives remain unchanged.
- The route is marked `noindex` and inherits the `/test/*` client-only harness.
