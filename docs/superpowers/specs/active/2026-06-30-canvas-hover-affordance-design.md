# Canvas Hover Affordance — Design

**Date:** 2026-06-30
**Status:** Resolved (2026-06-30). **Decision: no added button.** The viewer 2D
pane relies on tap-to-play + the centered tap-flash for discovery, plus a
`cursor: pointer` on canvas hover as the lightweight desktop "clickable" signal.
The corner play button and the hover-hint variants (badge/pill/scrim) are built
and kept **dormant** behind props (`cornerToggle` / `hoverHint`, both off by
default) + the `/test/canvas-hover-compare` harness — available if revisited, not
wired anywhere.
**Topic:** An affordance teaching "click the animation canvas to play/pause" on
the sequence viewer's 2D pane.

## Final decision (why no button)

People tap canvases; the tap-flash teaches play/pause on first interaction. An
explicit button is redundant chrome over that and fights the minimal-player-chrome
direction. Kept: tap-to-toggle (canvas-only), the centered flash, and
`cursor: pointer` on the canvas square (driven by `data-tap-toggle`) so a desktop
mouse user gets an honest clickable signal before they act. The button/hint code
stays in the tree, unused, for a future revisit. (Austen, 2026-06-30: *"maybe we
don't need this thing at all ... they will just discover it on their own through
clicking ... that's what people do, they tap on stuff."*)

## Problem

The 2D animation pane toggles play/pause on canvas tap (`tapToToggle`), but on a
mouse there was zero signal it was clickable — no cursor change, no hint. Austen
(2026-06-30): *"a little mouse cursor change when we hover above the animation
canvas to indicate that we can click it to pause ... a little thing that hovers
to indicate that clicking will pause it ... make it top tier."*

## Decision (current)

The viewer 2D pane uses a **corner play/pause button that reveals on hover** — a
real `<button>` pinned to the canvas square's upper-right, **hidden at rest**,
faded in on mouse hover of the canvas (and on keyboard focus). The YouTube/Vimeo
idiom: clean canvas at rest, control on mouse-over, plus a `cursor: pointer`
affordance. Touch has no hover so it stays hidden there; the body tap-to-toggle
covers play/pause on touch. Prop: `cornerToggle` on `AnimatorCanvas` (default
`false`). Icon crossfades play↔pause via the `Crossfade` primitive; `aria-label`
flips Pause/Play; ≥44px touch target; scales with the canvas via `cqmin`. Reveal
is gated to `@media (hover: hover) and (pointer: fine)` (mouse) plus
`:focus-visible` (keyboard); `pointer-events:none` until revealed so an invisible
button is never clickable.

**Anchor (load-bearing):** the button must sit on the canvas SQUARE, not the
`.animation-container` (whose top-right is the header strip, already holding
`WordHeader`'s `.loop-icon-badge`). It is rendered through a new optional
`cornerControl` snippet slot on `CanvasSurface`, placed inside the square
`position:relative .canvas-wrapper` alongside the existing overlays
(z-index 7 > GlyphOverlay's 5). `CanvasSurface` stays a pure leaf — a snippet is
passed in, no new import.

### Alternatives (kept behind `hoverHint`)

`AnimatorCanvas` also has an opt-in `hoverHint` prop (`"none" | "badge" | "pill"
| "scrim"`, default `"none"`), the earlier **mouse-only hover** approach:
- `badge` — centered glass disc + word, fades in on hover (YouTube idiom).
- `pill` — corner caption on hover.
- `scrim` — cursor + faint vignette, no icon.
These are not used by the viewer now; they remain for comparison / future reuse.
Mouse-only: hidden on touch (see invariant below).

## Mouse-only invariant (load-bearing)

The hint markup is always in the DOM (gated only by the `hoverHint` prop). **All**
of its layout/visuals live inside `@media (hover: hover) and (pointer: fine)`, and
`.hover-hint` defaults to `display: none` outside that query. Without the default
`display:none`, any non-hover context — real touch devices AND Chrome's
responsive/device-emulation mode — drops the styling and the raw icon/word leak
into normal flow beside the canvas (the bug seen 2026-06-30). Touch devices show
no hint by design; they get the existing tap-flash instead.

## Flash-collision fix (load-bearing)

`tapToToggle` already flashes a transient centered play/pause icon
(`.tap-feedback`) on tap. On a mouse the hover badge is also centered, so firing
both produced two different glyphs mid-animation in the same spot ("uncanny").
Fix: in `handlePointerUp`, skip `showTapFeedback` when
`e.pointerType` is `mouse`/`pen` AND `hoverHint !== "none"` — the hint is the
mouse feedback; the flash stays for touch (no hover there).

## Icon transition

Play↔Pause inside the badge crossfades through the shared `Crossfade` primitive
(`src/lib/shared/components/Crossfade.svelte` — grid-stack, both glyphs pinned
`grid-area:1/1`, `DURATION.fast`), not a naive two-sibling fade. Zero layout
shift, symmetric in-place dissolve. (See `feedback_crossfade_no_layout_shift`.)

## Reveal region (canvas-only) + enter/exit

Both the hover-reveal AND the tap-to-toggle are scoped to the **canvas square**,
not the whole container:
- **Reveal:** gated on `:global(.canvas-wrapper):hover` (the square), not
  `.animation-container:hover` (which includes the header strip, progress slot,
  and empty pane margin). `:global()` must wrap the whole tail
  (`:global(.canvas-wrapper:hover .corner-toggle)`) — Svelte 5 forbids `:global`
  mid-selector. Cursor `pointer` is set on `.canvas-wrapper` only.
- **Tap:** `handlePointerUp` requires `target.closest(".canvas-wrapper")` — a tap
  on the header/progress/margin no longer toggles play. Applies to every
  `tapToToggle` consumer (landing, tutorial, viewer); it's the correct
  "click the canvas" semantics.
- **Enter:** bouncy pop (`opacity 200ms` + `transform 320ms` back-out
  `cubic-bezier(0.34,1.56,0.64,1)`, from `scale(0.55) translateY(-12px)`,
  `transform-origin: top right`) to draw the eye. **Exit:** quick 150ms ease, no
  overshoot. Reduced-motion → plain opacity fade, no transform.

## Sizing (corner button)

Scales with the canvas (`.animation-container` is `container-type: size`, so
`cqmin` = the square's smaller side), sized up for 4K: disc
`clamp(44px, 11cqmin, 84px)`, icon `clamp(18px, 4.6cqmin, 38px)`, offset
`clamp(8px, 2.5cqmin, 20px)`, ≥44px touch floor. (The `hoverHint` badge
alternative uses `clamp(44px,15cqmin,96px)` disc etc.)

## Where wired

`ViewerSplitPane.svelte` → the 2D animation `AnimatorCanvas` (the
`tapToToggle`/`progressLine` instance) gets `cornerToggle={true}`. The dead
right-pane animation config is untouched. 3D pane out of scope.

## Files

- `src/lib/shared/animation-engine/components/CanvasSurface.svelte` — optional
  `cornerControl` snippet slot inside `.canvas-wrapper`.
- `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` —
  `cornerToggle` prop + corner-button snippet/handler/CSS; plus the `hoverHint`
  alternatives (markup, mouse-only CSS, flash-collision guard, crossfade).
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` —
  `cornerToggle={true}` on the 2D pane.
- `src/routes/test/canvas-hover-compare/+page.svelte` — 4-variant live compare
  harness (corner + badge/pill/scrim), real AnimatorCanvas ×4.

## Verification

- Compile: `/test/canvas-hover-compare`, `/sequence/[id]`, `/q/[code]` all 200.
- Visual (desktop mouse): badge fades in centered on hover, cursor pointer, icon
  crossfades on click, no second centered flash, scales with canvas.
- Touch / responsive mode: no hint, no leak; tap-flash still fires.

## Open

- Badge vs pill is provisional — user is living with badge to decide.
