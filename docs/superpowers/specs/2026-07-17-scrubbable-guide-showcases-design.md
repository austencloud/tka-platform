# Scrubbable Guide Showcases (Tier 1) - 2026-07-17

Austen's directive: the guide's live showcases should be driven by the reader, not
watched. Brainstormed from a live eye pass (2026-07-17) plus a research sweep of
interactive-education state of the art. Research verdict, applied to us: an
animated-but-not-manipulable figure teaches no better than a static image, and
autoplaying infinite loops beside body text are the documented anti-pattern
(cognitive load, gets tuned out). The fix is one coherent thesis: **the reader
drives time.**

Reference patterns: Ciechanowski's scrubbable figures (Mechanical Watch),
Soundslice's playhead-synced notation, JugglingLab's speed/step controls.
Full sourced research report lives in the 2026-07-17 session transcript.

## Why TKA wins here

The halved-pictograph engine already renders arbitrary time fractions, and the
notation has real vocabulary for in-between states (halved pictographs,
center-family orientations). Scrubbing to the halfway point and watching the
actual halved pictograph light up in the strip is a teaching move no dance or
juggling site can copy. This converts our flagged weakness into the guide's
signature interaction.

## Primitive discovery (all found, none to build)

| Need | Already exists | Where |
|---|---|---|
| Scrubber UI (drag/click/keyboard, role=slider, knob, scrub callbacks) | `SequenceProgressBar` seekable mode via `onSeek` | `src/lib/shared/animation-engine/components/layers/SequenceProgressBar.svelte` |
| Seek by ratio | `playbackAdapter.seek(progress 0..1)` | `src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts:130` |
| Seek plumbing in canvas | `AnimatorCanvas` line ~622 wires `onSeek` when `onProgressBarSeek` passed | `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` |
| Beat callback | `InlineAnimationPlayer.onStepChange(currentStep)` | `media-viewer/InlineAnimationPlayer.svelte:103` |
| End-hold (rest at final pose, no loop) | playback controller stops at `progress >= 1.0`; freeform sequences already pause on final position | `animation-playback-controller.ts:349` |
| Strip active-cell highlight | `GuideActiveStep` + `.guide-step-active` styling (companion already drives it) | `guide-active-step.svelte.ts`, TurnStrip/CellRenderer |
| The "Start"/"End" overlay to tame | `GlyphOverlay` `isAtStartPosition`/`isAtEndPosition` top-left indicators | `layers/GlyphOverlay.svelte:44-47` |

Gap analysis: the showcase player runs `fill={true}`, and `AnimatorCanvas` sets
`hideProgressBar={fill}` - so showcases currently render NO progress line at
all. The work is exposing and wiring existing seams, not building new ones.

## Decisions (brainstormed, with rationale)

1. **Scrub affordance: thin progress line under the canvas, inside the reserved
   square** (the export-style line SequenceProgressBar already draws), upgraded
   to seekable. NOT drag-on-canvas: the canvas already owns tap-to-play, and
   drag-on-canvas fights vertical page scrolling on touch. The line gets a
   generous hit slop (SequenceProgressBar already grows a knob on hover/scrub).
2. **Scrub pauses, release resumes only if it was playing** - the exact contract
   SequenceProgressBar's `onScrubStart`/`onScrubEnd` was built for.
3. **Loop etiquette: play ONCE when the canvas enters view, then rest on the end
   pose.** Replay affordances: the existing tap-to-play + hover badge. With
   `prefers-reduced-motion`: no autoplay at all; static start pose + play badge.
   The showcase's IntersectionObserver pair (near/inView) already exists; this
   changes what `inView` triggers.
4. **Strip-playhead sync: highlight the strip frame whose moment the playhead is
   crossing.** TurnStrip gains `activeT?: number | null` (null = no highlight):
   start lights at t in [0, .15), halfway at [.4, .6], end at (.85, 1], combined
   lights while playing its beat. GuideStepStrip (word strips) highlights beat N
   via the existing per-cell active mechanism. Highlight style = the existing
   `.guide-step-active` ring, NOT a new visual.
5. **The "Start"/"End" canvas overlay is suppressed in guide showcases** (new
   AnimatorCanvas/InlineAnimationPlayer passthrough flag, default unchanged
   elsewhere). Additionally fix its crossfade-overlap artifact at the source:
   the keyed 200ms fade renders both texts as in-flow siblings mid-transition -
   route it through the `Crossfade` primitive (crossfade-primitive.md) so the
   swap is grid-stacked, or an equivalent grid-stack if the overlay's SVG
   positioning rules out the primitive (executor verifies which). The artifact
   is visible in the viewer too, so the fix pays off everywhere.
6. **Scope: both guide levels.** SequenceShowcase is the single seam (level-1
   feature/compact cards and level-2 strip showcases all route through it), so
   scrub + loop etiquette + sync land everywhere at once.
7. **Presentation polish rides along** (small, same surfaces): level-2 chapter
   h1 adopts the guide script font (parity with level-1 topic heroes);
   GuideSection heading/subtitle spacing tightened; level-2 strip captions
   rewritten to say what to notice instead of enumerating frame names
   (NEEDS AUSTEN'S VOICE - draft, then he approves wording before merge).

## Open calls for Austen (not blocking Phase A)

- Overlay: suppress the Start/End words in guide showcases only (spec default),
  or kill/restyle them everywhere including the viewer?
- Caption drafts (C2) need his wording approval.

## Non-goals (explicitly parked)

- Tier 2: variant switcher for stacked showcases (S and T, 1|1, Opening/Closing),
  drawer speed/step/mirror controls, desktop drawer layout.
- Tier 3: Soundslice-style drag-across-notation loop ranges, hover-to-isolate a
  hand, sticky pinned-canvas scrollytelling, CSS `animation-timeline: view()`
  reveals.

## Ledger

### Phase A - the instrument (scrub + loop etiquette)
- [x] A1 (2026-07-17): `InlineAnimationPlayer` gains `scrubbable?: boolean`
      (default false): minimal+fill chrome shows the thin SequenceProgressBar
      as SEEKABLE (`onProgressBarSeek` -> `playbackController.seekToStep`),
      `onProgressBarScrubStart`/`onProgressBarScrubEnd` pause/resume-if-was-
      playing. `hideProgressBar={fill && !scrubbable}` opens the gap so the
      line renders even in fill mode when scrubbable. Zero layout shift (line
      overlays the canvas bottom edge inside the reserved square, unchanged).
- [x] A2 (2026-07-17): `singlePlay?: boolean` on InlineAnimationPlayer (default
      false, preserves today's looping exactly). Confirmed seam: the
      controller already implements this via `AnimationPanelState.shouldLoop`
      (animation-playback-controller.ts's shouldLoop branches in
      onAnimationUpdate/runStepPlaybackTick) - `singlePlay` just flips
      `setShouldLoop(!singlePlay)`. Added a `togglePlayback()` wrapper (gated
      to `singlePlay`) that calls `stop()` before replaying when resting at
      the end pose, so the tap/hover-badge "play" affordance actually restarts
      from the beginning instead of a same-tick no-op.
- [x] A3 (2026-07-17): SequenceShowcase passes `scrubbable` + `singlePlay` +
      `beatIndicators={false}`; autoplay now reactive to the `autoPlay` PROP
      (new $effect in InlineAnimationPlayer, replacing the old load-time-only
      inline call) so SequenceShowcase's `hasEnteredView` (sticky, set on
      first true `inView`) can flip `autoPlay` true after mount without a
      sequence reload. `prefers-reduced-motion` checked via matchMedia in
      onMount; `shouldAutoPlay = !reducedMotion && hasEnteredView`.
- [x] A4 (2026-07-17): `beatIndicators?: boolean` passthrough (default true)
      InlineAnimationPlayer -> AnimatorCanvas -> CanvasSurface, gating
      `isAtStartPosition`/`isAtEndPosition`; false from SequenceShowcase.
      GlyphOverlay's Start/End crossfade fixed at the source: ported
      Crossfade's `mode="swap"` timing by hand (`in:fade` delay = out's full
      duration) since the Crossfade component itself can't wrap this content
      (it emits an HTML `<div>`, invalid inside GlyphOverlay's `<svg>/<g>`
      tree) - out fully completes before in starts, so the two texts never
      double-expose.

### Phase B - the sync (notation follows the playhead)
- [x] B1 (2026-07-17): SequenceShowcase derives playhead `t` from
      `onStepChange` - confirmed the callback ALREADY reports a continuous
      fractional beat every frame (animationState.currentStep, re-read every
      time the $effect's dependency changes, not just on integer boundaries),
      so no callback-signature change was needed. Computed `activeT` (0..1
      ratio, mirrors SequenceProgressBar's own progress formula minus the
      loop-wrap modulo) and `activeBeat` (integer, 0 = start); hands `activeT`
      to `{@render strip(activeT)}` and `activeBeat` to the 3 direct
      `<GuideStepStrip>` render sites.
- [x] B2 (2026-07-17): TurnStrip gains `activeT` + band-based frame
      highlighting (start/mid/end per decision 4, "combined" lights in the
      gaps between named checkpoints) via `class:guide-step-active` on
      `.frame-box` (moved the pre-existing companion-driven combined-cell
      ring up to the same spot, OR'd together). Wired activeT through all 9
      TurnStrip call sites across the 8 ch20/ch21 section files (one-line
      `{#snippet strip(t)}` + `activeT={t}` each) - outside strict file
      ownership (only their captions were listed, for C2), but done anyway
      since B2 is otherwise dead code and C2 touches these same files next;
      flagged in the handoff report.
- [x] B3 (2026-07-17): GuideStepStrip gains `activeBeat` (null default,
      byte-identical for FlowFrame, its only other caller) highlighting the
      matching cell via the same `.guide-step-active` global ring, applied on
      `.pic-card` with a beat-number computed per render call site (0 = start
      box, 1..N = steps in reading order).

### Phase C - presentation polish
- [x] C1 (2026-07-17): guide.css gains `.guide-content > h1:first-of-type`
      (targets the level-2 chapter h1 - a bare `<h1>` rendered directly under
      `.guide-content` via GuideCompanionHost's `display:contents` - without
      touching level-1's `.topic-hero h1` or level-2's own landing page h1,
      both of which sit inside a wrapper and don't match `:first-of-type`
      there) adopting `var(--guide-script)`, matching level-1's topic-hero
      treatment. GuideSection heading/subtitle pass: `.guide-section > h2 +
      h3` tightens the subtitle's top margin (was inheriting the generic
      in-body-subheading 2rem gap) and both are centered to match the
      already-centered body prose these sections use throughout (ch20/ch21's
      `.section-body p { text-align: center }` - left headings over centered
      prose read as misaligned).
- [x] C2 (2026-07-17): all 21 level-2 caption strings (8 ch20/ch21 section
      files) rewritten from frame-name enumeration ("start, halfway, end,
      full motion") to observation-first prose, grounded in each strip's
      actual motion data (pro/anti/static/dash + turns-per-hand, verified
      against each file's own motion-data construction, not assumed from the
      word alone) and MCP `get_term_definition` for pro/anti/dash/static/
      opening/closing. DRAFTS - wording pending Austen's approval per the
      spec's Open Calls, same as the caption text in the commit body.

### Verification bar (per verification-protocol + the 2026-07-16 collapse lesson)
- [x] (2026-07-17, orchestrator, live browser) Interaction proven end to end -
      but only AFTER catching and fixing two real bugs the implementation
      shipped with, which no static verification caught:
      1. Autoplay never fired: the reactive-autoplay effect's guard read the
         plain (non-$state) `playbackController` before any reactive state, so
         an `autoPlay` already true before the async load finished (the
         showcase case, always) left the effect with no dependency that
         changes on load completion. Fixed by guard reordering (reactive
         `servicesReady`/`sequenceData` reads first) in
         InlineAnimationPlayer.svelte.
      2. Scrubbing collapsed to the motion's start pose: `seekToStep` clamped
         to `totalSteps`, but the controller's own timeline extends to
         `totalSteps + 1` (the end hold) - for 1-beat showcase sequences the
         entire second half of the scrub range was unreachable (debug-logged:
         adapter target 1.93 -> clamped to 1.0). Fixed at the canonical
         source (animation-playback-controller.ts seekToStep clamp).
      Verified after fixes: autoplay-once on first view; rest on end pose (no
      loop); tap replays from start; scrub at 25/50/75/98% rings
      combined/halfway/combined/end with the canvas posing correctly (50% =
      staff on the travel diagonal - screenshot captured); release holds
      position; reduced-motion (matchMedia shim + reload) = zero autoplay,
      start pose held; narrow-viewport stacking correct.
- [x] (2026-07-17) `npm run check` clean (0 errors/warnings); reflow-contract
      + sequence-viewer-shell-contract tests green (25/25); `build:fast`
      green; prerendered `.svelte-kit/cloudflare/guide/level-2/turns.html`
      confirmed structurally correct - strips/canvas-box reservations/new
      captions present server-side, InlineAnimationPlayer markup absent
      (client-only, as designed).
- [x] (2026-07-17) No layout shift on mount/scrub (no-layout-shift.md
      self-check) - confirmed live at both wide and narrow widths.

### Known nits (follow-up, not blocking)
- [ ] Slider display at single-play end-rest reads 0 (the bar's loop-wrap
      modulo maps completion back to 0) and settles a few percent below the
      drag ratio after release - knob position can mislead while the pose is
      correct. Fix belongs in SequenceProgressBar's display formula for
      non-looping consumers.

## File ownership

InlineAnimationPlayer.svelte, AnimatorCanvas.svelte (flag passthroughs only),
GlyphOverlay.svelte, SequenceProgressBar.svelte (only if seek-in-fill needs a
mode), animator-playback-adapter (only if fraction callback missing),
SequenceShowcase.svelte, TurnStrip.svelte, GuideStepStrip.svelte, guide.css
(C1), ch20/ch21 captions (C2). DO NOT touch: viewer shell surfaces, companion
drawer (Tier 2), non-guide player callers (defaults preserve behavior).
