# Hero Attract Act + Strip Baseboard — Design

Date: 2026-07-19
Status: Approved (Austen picked all three recommended options in-session)
Prereq: 2026-07-18 hero + hub homepage (shipped, commits 81b18e05d8 / eb52e77066)

## What Austen asked for

1. Trails on the hero's 2D canvas animation.
2. The hero should not repeat one sequence forever. It should walk through
   several, updating as it goes.
3. Ideally the prop morphs between sequences: finish a sequence, morph to a
   different prop, run the next one.
4. The FAQ / Software Roots / Support / About strip sits left-aligned with dead
   space to its right. Fix the awkwardness.
5. Title placement question resolved: "The Kinetic Alphabet" stays in the left
   pane. No work item.

## Decisions (made with Austen, 2026-07-19)

- Title: left pane, unchanged.
- Strip: full-width equal-segment row, the bento's baseboard.
- Hero motion: full act. Sequence cycling with chained start positions,
  engine-level prop crossfade, vivid trails.

## Investigated facts the design stands on

| Fact | Evidence |
|---|---|
| Trail system already ships and defaults ON (FADE + GLOW forced in `loadSettings`) | `animation-settings-state.svelte.ts:100-125`, renderer `canvas-2d-trail-renderer.ts:160` |
| Player wires `trailSettings={animationSettings.trail}` (global singleton) | `InlineAnimationPlayer.svelte:520` |
| Loop-boundary callback exists but is unwired here | `animation-playback-controller.ts:484-490`, fired at 567/650; proven consumer `sequence-viewer/components/playback-controller.svelte.ts:250-264` |
| Prop types hot-swap live mid-play (instant texture swap today) | `prop-type-manager.ts:101-154, 190-219` |
| Renderer already crossfades two images at one position (glyph layer, 300ms) | `canvas-2d-fade-manager.ts`, consumed at `canvas-2d-animation-renderer.ts:742-777` |
| `renderProp()` is generic and already draws multiple images per color with independent `globalAlpha` (tunnel layers) | `canvas-2d-animation-renderer.ts:433-454, 494-515, 572-589` |
| Player reloads IN PLACE when `sequence` prop changes (no remount needed) | `InlineAnimationPlayer.svelte:365-381` |
| Generator accepts a start-position constraint | `generate-models.ts:66` |
| Demo sequences are CIRCULAR loops: end pose = start pose ("seamlessly-loopable" reset at `animation-playback-controller.ts:654`) | per-visit preset in `per-visit-demo.ts:55-65` |
| `SequenceData.startPosition?: StartPositionData` | `sequence-data.ts:55` |
| Persisted-speed divergence: non-ephemeral panel state reads localStorage speed; `externalBpm` prop overrides deterministically | `InlineAnimationPlayer.svelte:306-315`, `animation-panel-state.svelte.ts:31-34` |

## Design

### A. Engine: prop crossfade (the morph)

Reuse the glyph fade pattern for props. On prop-type hot-swap, instead of the
instant texture swap:

1. `canvas-2d-image-loader.ts`: retain `previousBluePropImage` /
   `previousRedPropImage` when a new texture lands (mirrors
   `previousGlyphImage`, lines 27-28).
2. A prop fade timer using the `Canvas2DFadeManager` mechanism (second
   instance or a parameterized reuse), duration ~400ms, started by
   `prop-type-manager.ts` at the two hot-swap sites (146, 211) once the new
   texture has loaded. Never fade to a not-yet-loaded image.
3. `canvas-2d-animation-renderer.ts` "Draw props" step: while a fade is
   active, two `renderProp()` calls per color at the SAME transform: previous
   image at `previousAlpha`, current at `currentAlpha`. One
   `calculatePropTransform()` output drives both, which is what makes it read
   as the prop transforming in the spinner's hands.
4. Trail-buffer clearing on swap stays as-is (scope control). The morph moment
   masks the trail restart; revisit only if it reads badly on screen.
5. Zero behavior change when no fade is active or for surfaces that never
   change prop type mid-play.

### B. Player: two prop additions to `InlineAnimationPlayer.svelte`

- `onLoopComplete?: () => void`. Wire
  `playbackController.onLoopComplete(() => onLoopComplete?.())` right after
  construction (~line 283); `offLoopComplete()` in `onDestroy`.
- `trailSettingsOverride?: TrailSettings | null = null`. Template passes
  `trailSettingsOverride ?? animationSettings.trail`. The hero must NOT mutate
  the global singleton (it leaks into Compose).

### C. Host: the act (`src/lib/shared/landing/data/hero-act.svelte.ts`)

A small state factory owning the show:

- Prop cycle: STAFF → FAN → CLUB → BUUGENG → repeat. Poi excluded on purpose:
  arbitrary generated loops are not guaranteed poi-legal (Austen's 2026-07-18
  ruling), and the homepage must not show poi doing impossible moves.
- `PASSES_PER_SEQUENCE = 1` (16 counts at 60 BPM ≈ 16s per prop; tunable
  constant).
- Pre-generation: while sequence N plays, generate N+1 in the background with
  `startPosition` = current sequence's start position (CIRCULAR: end = start),
  so the handoff never waits and hands never teleport. Map
  `StartPositionData` → the generator's expected `PictographData` shape;
  verify with a unit test that consecutive sequences share the boundary pose.
- On `onLoopComplete`: if the pass quota is met and the next sequence is
  ready, advance: swap `sequence` (in-place reload, no remount) and step the
  prop cycle (live hot-swap triggers the engine crossfade). If generation
  isn't ready or failed, keep looping the current sequence and retry at the
  next boundary. `FALLBACK_DEMO` remains the deep fallback.
- Dice button = "advance the act now" (uses the pre-generated next if ready,
  else generates fresh). Reroll UX otherwise unchanged.
- First paint unchanged: `FALLBACK_DEMO` at SSR, act starts once hydrated.

### D. `SequenceHeroDemo.svelte` + `HomeHero.svelte`

- Remove the `{#key sequence?.id}` wrapper. The player's own in-place reload
  (fact table) handles swaps; this also upgrades the existing dice reroll from
  remount to in-place.
- Pass through `onLoopComplete`, `trailSettingsOverride`, `externalBpm` (new
  optional props on SequenceHeroDemo; notation pages unaffected).
- Hero pins `externalBpm={60}` so a visitor's persisted Compose speed can't
  skew the marketing surface.
- Caption word swap goes through the `Crossfade` primitive (cheap content,
  default grid mode; the word/note line is inline content-sized).
- HomeHero consumes the act factory; `bluePropType`/`redPropType` come from
  the act's current prop.

### E. Vivid hero trail preset

A `TrailSettings` literal in the hero (mode FADE, glow, tuned fadeDurationMs /
tailLength / glowBlur), passed via `trailSettingsOverride`. Exact numbers are
tuned at build time against screenshots; acceptance is "clearly visible trail
at hero size," not a specific constant.

### F. Strip baseboard (`LaunchpadGrid.svelte`)

`.strip` becomes `display: grid; grid-template-columns: repeat(4, 1fr)` with
each pill filling its cell (width 100%, centered label, 44px min-height
kept). ≤640px: `repeat(2, 1fr)`. Hover/focus states unchanged. Pills land
flush with the bento's left and right edges.

## Verification plan

- Unit tests (vitest, targeted): act factory (cycle order, pass counting,
  boundary chaining options, not-ready fallback), boundary-pose continuity.
- `check:fast` + targeted vitest as the gate (scoped-checks policy; no full
  check for this diff).
- Playwright geometry re-measure at 1920/2560/3840: strip flush with bento
  edges, no layout shift from caption crossfade.
- Screenshots reviewed by me for: visible trails, morph mid-fade frame if
  captureable, strip baseboard. Austen's eyes for feel (tilt of the act,
  morph timing) — browser-gated.

## Build ledger

- [x] A. Engine prop crossfade (fade manager parameterized, 400ms; both hot-swap
      sites; phantom-first-assignment guard; 75/75 engine tests)
- [x] B. Player props (onLoopComplete, trailSettingsOverride, plus tipEffectMap —
      see discovery below)
- [x] C. hero-act.svelte.ts factory + 10 unit tests
- [x] D. SequenceHeroDemo/HomeHero wiring (de-key, pass-throughs, caption
      crossfade, externalBpm pin)
- [x] E. Vivid trail preset (screenshot-verified at 1080p)
- [x] F. Strip segment row (measured flush: 0px left/right vs bento at 1080p + 4K)
- [x] Scoped checks green (check:fast: only pre-existing shape-matrix errors),
      geometry re-measured, committed with explicit pathspec
- [~] Austen visual pass on the live act (morph feel, trail intensity, pacing)

## Round 2 (2026-07-19, Austen live feedback: "it pops" / "make it sexy")

Root causes found and fixed:
1. **The pop**: InlineAnimationPlayer's `{#if loading}` branch unmounted the
   whole canvas subtree on every sequence reload — a fresh engine treats the
   prop override as a first-time assignment and the fade is suppressed by
   design. Fixed with `hasLoadedOnce`: the spinner gates only the FIRST load;
   reloads keep the canvas (and engine) alive.
2. **Imperceptible fade**: 400ms completed inside the post-swap start hold.
   Now 900ms, and the act flips the prop ~700ms AFTER the sequence swap
   (`propMorphDelayMs`), so the morph runs during visible motion.
3. **Trail jump-line**: the legacy suppression seam (`trailSettings.mode=OFF`)
   never gated the live path — the trail OVERLAY (WebGL2/Canvas) self-captures
   and never reads mode. Per-color `blueMorphSuppressed`/`redMorphSuppressed`
   now flow render-loop → overlay: capture freezes through texture-load AND
   morph fade, the accumulated glow decays naturally (no wipe, no epoch bump),
   and the lift resets rings/tails so the next capture starts a disconnected
   fresh segment.
4. **Trail wipe at handoff**: PlaybackSync cleared overlay buffers on every
   sequence-content change. Now skipped for seamless handoffs (outgoing
   sequence circular + incoming starts at the same grid position — exactly
   what chaining constructs), so the mandala flows across the boundary.
5. **Flourish**: one eased phase (cosine) drives alpha + scale + glow:
   outgoing sprite dissolves outward (1→1.07), incoming condenses in
   (0.92→1) with a motion-color glow pulse peaking mid-fade
   (`canvas2d/prop-morph-easing.ts`, pure + unit-tested).

Verified: 31 targeted tests green under the project vitest config (incl. new
suppression-lifecycle and easing-curve tests); burst captures show the
mid-morph blend at the chained hold, the prior trail persisting across the
boundary and fading naturally, and no jump line; check:fast clean for all
touched files. Test-config discovery: `*.test.ts` outside `__tests__/` never
runs under `tests/config/vitest.config.ts` — morph test relocated;
pre-existing `prop-type-manager.layers.test.ts` has the same defect (flagged,
not fixed here).

Relayed follow-ups (both DONE same day):
- Generation tuning: turnIntensity 1.5 + DifficultyLevel.ADVANCED in
  per-visit-demo.ts; verified live (turn pool 0/0.5/1/1.5/fl, max 1.5).
- Launchpad tile media, all four bare tiles: PictographFadeCard (staff-choreo,
  demo-sequence pictographs, 7s Crossfade), GlossaryDictionaryCard (glossary,
  live GLOSSARY entries from @tka/domain, 7.5s), guide cover (BookCoverArt →
  the real GuideCover), AlphabetMarquee (real 47-letter alphabet in the
  tka-font, 48s loop). All LazyMount-gated, reduced-motion aware, staggered,
  SSR links untouched, contract test green, verified in 1080p/4K captures.

## Build discovery (2026-07-19): why the hero never had trails

Trail SETTINGS were never the problem — the singleton defaults to FADE+GLOW.
The render loop gates trails on `hasTrailTips(tipEffectMap)`
(`animation-render-loop.ts:983`, helper at :87), and an empty map returns
false, so `effectiveTrailsVisible` stayed false on every surface that doesn't
pass tip-effect assignments — InlineAnimationPlayer included. (The CAPTURE
side treats an empty map as all-tips-trail; the RENDER side treats it as
none. Asymmetry predates this work.) Fix: `tipEffectMap` prop threaded
through InlineAnimationPlayer → AnimatorCanvas; the hero passes
`HERO_TIP_EFFECT_MAP = setCellWide({}, "trails")` from hero-trail-preset.ts.
Hosts that omit the prop keep their historical trail-less behavior.

Runtime proof of the act (headless Playwright, 75s watch): word timeline
ΑΣΥ-Φ → KEΔW (10.1s, one pass of the 8-count fallback) → Θ-Y-ΘW (27.5s) →
AΣZF (45.1s) → AΣRX (61.8s); ~17s cadence = one 16-count pass + swap; fans
on screen after advance 1, staves again after advance 4 (cycle wrapped);
zero page errors; trails visible in all captures.
