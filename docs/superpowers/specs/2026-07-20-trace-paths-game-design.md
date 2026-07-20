# Trace Paths Game Design

**Status:** Ready for implementation

**Date:** 2026-07-20

**Working title:** Trace Paths

**First home:** Dedicated immersive route launched from Learn > Play

## Product sentence

Trace a real Kinetic Alphabet hand path or sequence with one or two fingers, moving across synchronized grids without lifting and feeling every beat land.

## The product call

Build Trace Paths as a dedicated touch experience inside TKA, launched and progressed through the existing Learn arcade. Treat the trace engine as a dependency-light product core that a standalone PWA can consume later.

This is one game with two layers:

1. **TKA play:** canonical sequence or saved hand-path data supplies the points, paths, hand colors, timing, and progression.
2. **Standalone play:** the same engine can eventually run authored point patterns without the rest of TKA.

Do not fork a second product during v1. The interaction has to prove that it is fun, readable, and reliable on real touch hardware before a separate shell earns its maintenance cost.

`Trace Paths` is a working title, not a launch decision.

## Why this deserves to exist

The gesture is the lesson. A player does not select an answer that represents a hand path. Their fingers perform the path.

That makes the game useful in three distinct ways:

- It teaches the spatial route between Kinetic Alphabet locations.
- It develops screen-level two-hand coordination and continuity.
- It turns the existing sequence library into a large body of playable levels.

The first five seconds must prove the premise. The opening round is one finger, two obvious points, a visible rail, and a soft response when the destination lands. No rules screen comes first.

## Non-negotiables

- The primary surface is touch-first and uses as much of the available viewport as the shell can safely give it.
- A round is driven by canonical `SequenceData` or `HandPathData`. Letters, locations, motion types, named paths, and grid behavior are never reconstructed from display text or guessed in UI code.
- Point order and direction matter. A recognizer that accepts the right shape in the wrong order is wrong for this game.
- Two-hand play uses two simultaneous Pointer Events, not a synthetic animation pretending to be multitouch.
- A browser interruption such as `pointercancel`, app backgrounding, or lost capture pauses the round. It does not tell the player they failed.
- Mistakes identify the hand and beat that diverged. Failure feedback never becomes a generic red screen.
- The default experience contains no strobe, rapid flashing, alternating high-contrast pattern, screen shake, or forced countdown.
- The feature makes no medical, therapeutic, rehabilitation, or seizure-reduction claim.
- The game remains playable in a one-hand mode. Two-hand play is an advancement, not the entrance fee.
- Test or reference generation of TKA pictographs and sequences continues to use the Flow Arts MCP tools only. Runtime visuals reuse existing domain data and shared renderers; the game does not hand-roll pictographs.

## Core loop

### 1. Preview

The stage shows the active grid, start targets, and the first path. Beginner levels leave the route visible. Later levels let the route fade after the finger is armed.

Copy:

> Put blue on the blue start.

For two-hand rounds:

> Put blue and red on their starts.

### 2. Arm

A pointer is assigned to a hand by the grid or start target it touches. Never assign blue and red from pointer order or `isPrimary`.

The round begins when every required pointer is down inside its assigned start target. There is no default three-second countdown. The player starts by moving.

### 3. Trace

Each hand follows an ordered sequence of path segments. A segment ends at a checkpoint. A soft visual lock and optional light haptic confirm the checkpoint.

In two-hand play, a beat advances only when both hands satisfy that beat:

- A moving hand reaches its expected endpoint through the expected corridor.
- A static hand remains inside its hold zone.
- One hand may arrive early and wait. Speed is not allowed to turn into frantic desynchronization.

The next segment becomes active as soon as the beat lands.

### 4. Resolve

A successful round reports completion, path quality, and optional synchrony. It does not reward raw speed by default.

Examples:

> Clean path. 6 beats.

> Blue stayed on route. Red cut the third turn.

An invalid round highlights the last valid checkpoint and the first divergence. The player can retry the beat or restart the round, depending on the selected challenge mode.

### 5. Continue

The next round changes one thing: another point, a hidden rail, a second hand, a held position, or a longer chain. Difficulty never jumps on all axes at once.

## Content and display modes

### Sequence trace

One canonical sequence supplies two synchronized hand traces and their beat boundaries.

### Named hand path

A saved or authored hand path supplies a single-hand trace. A two-hand challenge may pair two verified paths on one timeline. Named patterns are content records, not strings that UI code interprets.

### TKA grid

The stage uses the canonical grid mode and locations carried by the sequence. Only domain-derived locations are interactive. Shared grid rendering and coordinate utilities remain the visual source of truth.

### Nine-point playground

A generic 3-by-3 layout is allowed for future standalone drills and authored coordination patterns. It must not be presented as a canonical Kinetic Alphabet grid unless the domain data says it is one.

The existing [`packages/9square-domain`](../../../packages/9square-domain/src/data/grid.ts) package defines the intended model, but its position, transition, and CAP collections are currently unpopulated TODOs. It is not a v1 content source. Populate and source that package before shipping a 9-Square skin.

Both layouts normalize to a shared stage coordinate space so scoring does not change with device size.

## Adaptive two-hand layout

Two fingertips can hide targets, collide at shared locations, or physically cross. Treat this as a product constraint, not a CSS bug.

### Synchronized split grids

Use one grid under each hand by default. Both grids advance through the same beat timeline. Either finger may arrive early and wait.

Split grids preserve each individual hand path, ordered locations, holds, and synchronization. They do not preserve the hands' shared-screen spatial relationship, so the game says that plainly.

### Shared grid challenge

One large canonical grid is an advanced layout, not the default. Enable it only when a preflight proves that simultaneous targets and route corridors retain enough physical separation for the measured stage.

If both hands share a waypoint, their corridors overlap, or a crossing would force fingertip collision, the pattern fails shared-grid preflight and stays split. Do not move targets away from canonical locations to make an impossible shared trace look possible.

An unfolded Z Fold or tablet provides more candidates for shared-grid play, but screen size alone does not overrule collision geometry. Do not detect a device by model name or user agent.

Preflight samples both hand corridors across each synchronized beat. A challenge passes only when simultaneous targets and corridor samples stay farther apart than two touch-contact radii plus a tuning margin. Paths that cross at different beats may pass; paths that require the fingertips to cross during the same beat do not.

## Progression

| Chapter | New challenge | What stays easy |
| --- | --- | --- |
| Touch the route | One hand, one segment, visible rail | No timer, generous targets |
| Keep the line | Two to four segments without lifting | Rail remains visible |
| Remember the route | Rail fades after arming | One hand only |
| Meet the other hand | Two synchronized grids, one beat | Visible rails, no static holds |
| Hold and move | One hand stays while the other moves | Short rounds |
| Chain the beats | Four to eight synchronized beats | Retry from failed beat |
| Trace the sequence | Complete canonical paths and sequences | Preview is always available |
| Challenge | Hidden rails, stricter corridors, optional rhythm | Player opts in |

The user's first named content target is **Zan's Diamond**. That name appears in the [Learn curriculum definition](../../../src/lib/features/learn/domain/concepts.ts), but its ordered path is not present in the current Flow Arts MCP index or glossary. V1 must not invent it. Encode it from an author-verified hand-path record or trusted reference, then load that record through the same content adapter as every other named path.

## Input model

Use Pointer Events for touch, pen, and desktop development:

- Cache active pointers by `pointerId`.
- Call `setPointerCapture(pointerId)` on the stage after `pointerdown`.
- Set `touch-action: none` on the trace surface only. Page chrome retains normal scrolling and zoom behavior outside the active stage.
- Read `getCoalescedEvents()` when available so fast movement retains intermediate samples.
- Fall back to the parent `pointermove` event when coalesced events are unavailable.
- Feed coalesced points to evaluation, but render at most once per animation frame.
- Do not use predicted events for correctness or scoring. They are speculative.
- Release or clear capture on `pointerup`, `pointercancel`, `lostpointercapture`, route exit, and visibility loss.
- In split mode, assign a pointer from the grid it touches. In shared mode, assign it from an unclaimed start target.
- Ignore a third pointer after giving a quiet, non-blocking cue. Never reassign an armed hand because another pointer appeared.

Desktop mouse input supports the one-hand development path. It is not evidence that the two-hand experience works.

## Round state machine

```text
loading -> preview -> arming -> tracing -> feedback -> preview
                       |          |
                       v          v
                     paused <-----+
```

### `loading`

Resolve and validate the canonical sequence. If conversion fails, show an earned error with a retry and leave the rest of Learn usable.

### `preview`

Show route, start points, and round controls. Preview animation is optional and respects reduced motion.

### `arming`

Accept required pointer assignments. A pointer outside every start zone remains unassigned.

### `tracing`

Capture samples, advance beat gates, and publish semantic status updates. The stage is the only region with disabled browser touch actions.

### `paused`

Retain the last completed beat. Ask the player to place fingers back on the current targets. Strict mode may offer restart; it does not turn an operating-system interruption into a gameplay error.

### `feedback`

Freeze the trace long enough to show what happened, then allow retry or continue. Reduced-motion mode uses opacity and static marks rather than path travel.

## Content-to-trace contract

The Flow Arts MCP `get_sequence_data` tool was used during design. Its result supplied a starting state plus ordered blue and red motions with start and end locations. That validates the sequence input contract; it does not define Zan's Diamond or any other named hand path.

Convert `SequenceData` directly:

```ts
type TraceHand = "blue" | "red";

type TraceSource =
  | { kind: "sequence"; sequence: SequenceData }
  | { kind: "hand-path"; handPath: HandPathData };

interface TraceRound {
  id: string;
  gridMode: GridMode;
  hands: Partial<Record<TraceHand, HandTrace>>;
  beats: TraceBeat[];
}

interface HandTrace {
  hand: TraceHand;
  start: GridLocation;
  segments: TraceSegment[];
}

interface TraceBeat {
  index: number;
  segments: Partial<Record<TraceHand, TraceSegment>>;
}

type TraceSegment =
  | {
      kind: "move";
      start: GridLocation;
      end: GridLocation;
      expectedPath: NormalizedPoint[];
    }
  | {
      kind: "hold";
      location: GridLocation;
    };
```

The production types must use the package's canonical `GridMode`, `GridLocation`, sequence, and motion types. The names above describe the boundary; they are not permission to duplicate domain unions.

Do not serialize a sequence to a hand-path ID and parse it back. [`hand-path-data-builder.ts`](../../../src/lib/features/choreo-card/services/hand-path-data-builder.ts) proves that ordered blue and red traces can be derived. The game accepts typed sequence and hand-path records at its adapter boundary.

Use or extract the pure path geometry from [`hand-path-animator.ts`](../../../src/lib/features/hand-paths/hand-path-builder/services/hand-path-animator.ts). Do not create a second interpretation of straight, curved, or held motion in the game feature. If extraction is required, parity tests must lock the old renderer and new evaluator to the same sampled path.

## Evaluator

This is constrained path following, not open-ended gesture classification.

### Why not a generic gesture recognizer

- The `$1` recognizer classifies a completed single stroke against templates. Trace Paths already knows the expected route and must give feedback during the gesture.
- `$P` supports multiple strokes by ignoring stroke number, order, and direction. Those are all meaningful here.
- General web gesture libraries recognize pan, pinch, swipe, and rotate. They do not understand ordered TKA checkpoints, per-hand holds, or synchronized beats.

Implement a small pure evaluator around the known route.

### Evaluation pipeline

1. Transform pointer samples from client coordinates into normalized stage coordinates.
2. Remove duplicate samples and resample by arc length so device event frequency does not change the score.
3. Require the correct start zone.
4. Project each sample onto the current segment and require mostly monotonic progress, with a small regression allowance for fingertip jitter.
5. Detect checkpoint crossings across the swept line between samples so a fast finger cannot skip a small target between events.
6. Require checkpoints in order. Reversing a valid-looking curve is not accepted.
7. Require continuity. `pointerup` before the endpoint is a lift; `pointercancel` is a pause.
8. Compare the resampled trace to the sampled canonical path with discrete Fréchet distance.
9. Record corridor excursions separately so feedback can identify where the finger left the route.
10. In Together mode, calculate beat synchrony from arrival times after both individual paths are valid.

Discrete Fréchet distance fits because it compares ordered point sequences while tolerating different sampling densities. Its output is normalized by the stage's shorter dimension. Tolerances use stage-relative values with a minimum physical touch allowance; no correctness threshold is a raw desktop pixel constant.

### Pass and score

Completion is gated, not averaged. A round cannot compensate for a skipped checkpoint with a beautiful line elsewhere.

Always show the component results separately: Coverage, Accuracy, Continuity, and Sync. Coverage is the clear gate. The arcade may derive one progression score, but it never hides the component results behind that number.

For a completed round, begin tuning with:

```text
quality = 0.60 * accuracy
        + 0.25 * continuity
        + 0.15 * synchrony
```

Accuracy combines discrete Fréchet distance and corridor excursions. Continuity reflects lifts and checkpoint restarts in practice modes. One-hand mode re-normalizes the two remaining components so it has no hidden synchrony penalty. These weights are a prototype baseline and must be tuned from real-device traces. They are not part of the domain model.

Raw speed is recorded for diagnostics but contributes no default points. Do not score finger smoothness in v1. Browser sampling, screen coatings, touch controllers, and palm rejection make cross-device smoothness comparisons dishonest. An optional rhythm challenge may score timing after the core interaction is stable.

There is no global leaderboard until physical-device evidence demonstrates that normalized scoring remains fair across device classes.

## Arcade scoring integration

The current arcade session assumes binary quiz answers and awards a speed bonus. That contract is wrong for deliberate path practice.

Add a discriminated round outcome while preserving current games:

```ts
type ArcadeRoundEvent =
  | { kind: "choice"; answer: QuizAnswerEvent }
  | {
      kind: "performance";
      isCorrect: boolean;
      points: number;
      elapsedMs: number;
      metrics: TraceMetrics;
      questionData: Record<string, unknown>;
    };
```

Keep `submitAnswer()` as a compatibility adapter for the eight existing games. Add `submitRound()` for both branches. Current quiz scoring must not change.

Trace Paths calculates its points through a pure `scoreTraceRound(metrics, config)` function, then submits a performance event. Existing star thresholds, unlocks, results UI, local storage, and Firestore aggregate progress remain reusable. Persist aggregate score and stars in v1; keep detailed samples and traces in memory unless a separately reviewed analytics schema earns collection.

Never upload raw finger traces by default. They are behavioral input data, not harmless exhaust.

## Feedback language and visuals

Every failure state answers three questions:

1. Which hand?
2. Which beat?
3. What should change?

Good:

> Red skipped the center on beat 3.

> Blue lifted before the endpoint.

> Both paths are right. Let red arrive before blue leaves beat 4.

Bad:

> Incorrect.

> Try again!

> Bad trace.

Use hand color plus a persistent shape or label. Blue and red alone are not sufficient identifiers. Success can use a restrained path fill, endpoint lock, short haptic, and quiet sound. Failure uses a static divergence marker, not a flash or shake.

## Accessibility and low-stimulus behavior

Tracing is the essential mechanic, so a tap-only control cannot claim to be the same challenge. The product still supplies meaningful alternatives:

- One Hand mode can complete all introductory content.
- Tap Route mode lets a player select ordered waypoints without dragging or multipoint input.
- Step-through Preview lets keyboard, switch, mouse, and screen-reader users inspect each hand path and beat without claiming a trace score.
- Trace-specific medals remain trace-specific, but content and curriculum unlocks never require a multipoint gesture.
- Every control outside the trace gesture is keyboard operable and has a visible focus state.
- Instructions and checkpoint results are announced through a restrained live region.
- Targets meet a 44 CSS pixel preferred diameter where geometry allows and never fall below the project's accessible target rules.
- Hand identity uses color plus symbol, position, and text.
- Haptics and sound have independent toggles.
- Reduced Motion stops traveling previews, route drawing, pulsing, and celebratory movement.
- Low Stimulus removes timed pressure, animated backgrounds, path glow, and nonessential audio while preserving target state.
- Pause and Exit remain visible throughout the round.

Safety policy:

- No flashing or strobing.
- No rapid full-screen luminance changes.
- No rapidly alternating stripes, checkerboards, or high-contrast geometric backgrounds.
- No saturated red flash for errors.
- No claim that playing treats epilepsy or any other condition.
- If the game is used as part of care, product copy directs the player to follow their clinician's guidance.

Photosensitivity is not the only seizure trigger, and most epilepsy is not photosensitive. The design therefore avoids implying that a no-flash setting makes the game medically safe for every person.

## Product architecture

### Existing systems to reuse

| Need | Existing source | Decision |
| --- | --- | --- |
| Game discovery | [`game-registry.ts`](../../../src/lib/features/learn/play/domain/game-registry.ts) | Add one registry entry and explicit capabilities. |
| Arcade route and session | [`GameShell.svelte`](../../../src/lib/features/learn/play/components/GameShell.svelte) | Add Trace Paths routing and an immersive-stage capability. |
| Hub and results | [`PlayHub.svelte`](../../../src/lib/features/learn/play/components/PlayHub.svelte) | Reuse. Update game-count copy derived from registry, not another literal. |
| Session state | [`arcade-session-state.svelte.ts`](../../../src/lib/features/learn/play/state/arcade-session-state.svelte.ts) | Extend with a performance outcome without changing quiz behavior. |
| Progress | [`play-progress-store.ts`](../../../src/lib/features/learn/play/services/play-progress-store.ts) | Reuse aggregate persistence. |
| Canvas and overlays | [`InteractiveCanvas.svelte`](../../../src/lib/shared/interactive-canvas/InteractiveCanvas.svelte) | Reuse the aligned 950-unit canvas stack. Add a generic interaction-layer slot; do not turn its click overlay into a trace state machine. |
| Canonical grid | [`GridSvg.svelte`](../../../src/lib/shared/pictograph/grid/components/GridSvg.svelte) and shared coordinate utilities | Reuse as visual and coordinate source. |
| Grid hit targets | [`grid-hit-target-calculator.ts`](../../../src/lib/shared/assemble-lab/services/grid-hit-target-calculator.ts) | Reuse its targets and radius only after a parity test against shared grid coordinates. Do not add a third coordinate table. |
| Existing path geometry | [`hand-path-animator.ts`](../../../src/lib/features/hand-paths/hand-path-builder/services/hand-path-animator.ts) | Reuse or extract pure sampling logic with parity tests. |
| Haptics | Project haptic feedback getter | Reuse, behind player preference. |
| Fullscreen and viewport | `mobile-fullscreen-manager.ts`, `FullscreenPrompt.svelte`, and viewport measurement utilities | Reuse; never force fullscreen. |
| Input capability | `InputCapabilities.svelte.ts` | Use for mode guidance, not as a substitute for live Pointer Event handling. |
| Multitouch precedent | `VideoCropEditor.svelte` and `pinch-zoom-grid-controller.ts` | Copy the pointer-cache and cancellation discipline, not their pinch behavior. |

The existing `PlacementGrid.svelte` and `GridPointTapQuiz.svelte` are evidence for target styling, haptics, Tap Route, and educational feedback. They are tap components and must not be stretched into a trace controller.

### Proposed feature boundary

```text
src/lib/features/learn/play/games/trace-paths/
  TracePathsGame.svelte
  components/
    TraceStage.svelte
    TraceRouteLayer.svelte
    TraceFeedback.svelte
    TraceSettings.svelte
  domain/
    trace-types.ts
    trace-config.ts
  services/
    sequence-to-trace.ts
    hand-path-to-trace.ts
    trace-evaluator.ts
    trace-path-sampler.ts
    score-trace-round.ts
  state/
    trace-paths-state.svelte.ts
```

Keep DOM event capture in `TraceStage.svelte` or one controller owned by it. Keep conversion, geometry comparison, collision preflight, beat gating, and scoring as pure functions. The standalone product boundary is the pure domain and service layer plus a small stage API, not a premature package extraction.

### Immersive game capability

Add a capability to the registry rather than checking the game ID throughout the shell:

```ts
interface GameCapabilities {
  immersiveStage?: boolean;
  requiresTouch?: boolean;
  supportsTwoPointers?: boolean;
  scoring: "quiz" | "performance";
}
```

The shell uses capabilities to reduce chrome, preserve Exit/Pause, and show accurate device guidance. Existing game entries receive explicit defaults.

## Data and privacy

Persist:

- unlocked level
- high score
- stars
- rounds completed
- selected accessibility preferences

Do not persist or transmit in v1:

- raw pointer coordinates
- pressure, contact geometry, or device identifiers
- a replay of a person's trace
- any health inference

Aggregate local diagnostics may include failure reason, normalized Fréchet score, device class, and layout mode. Remote analytics requires a separate event-schema review and must not include the raw path.

## Implementation plan

### Phase 0: Device truth spike

Build an unstyled internal harness that:

- renders two normalized routes on synchronized split grids
- records one and two Pointer Event streams
- shows pointer IDs and hand assignments
- displays ordered checkpoint state and normalized distance
- handles coalesced events, capture, cancellation, and visibility loss
- exports no data

Prove this on desktop one-pointer input and real two-finger hardware before building game chrome. The user's unfolded Z Fold is the first target device, not the only target device.

### Phase 1: Canonical trace domain

- Convert real `SequenceData` into synchronized hand traces.
- Convert verified `HandPathData` into one-hand and paired trace rounds.
- Extract or reuse canonical path geometry.
- Implement ordered checkpoints, hold zones, resampling, discrete Fréchet distance, and corridor analysis.
- Lock the evaluator with pure unit tests.
- Add deterministic sequence and hand-path fixtures through their normal adapters.

### Phase 2: One-hand vertical slice

- Build the full preview, arm, trace, feedback, retry, and continue loop.
- Add visible-rail and fading-rail levels.
- Add reduced-motion, low-stimulus, haptic, and sound settings from the first playable slice.
- Verify that an interrupted touch pauses and resumes cleanly.

### Phase 3: Two-hand play

- Add start-zone pointer assignment.
- Add synchronized beat gates and static holds.
- Add split-grid play first.
- Add shared-grid collision preflight and the advanced shared layout.
- Tune for occlusion, crossing paths, accidental third touches, and unequal arrival times.

### Phase 4: Arcade integration

- Add the registry entry and capability contract.
- Extend the arcade event model with performance scoring.
- Route through `GameShell` and reuse results, stars, unlocks, and progress.
- Derive Play Hub game-count language from the registry.
- Add Tap Route and Step-through Preview alternatives.

### Phase 5: Content and tuning

- Build the chapter progression from short primitives to full paths and sequences.
- Encode Zan's Diamond only after Austen or another trusted source verifies its ordered hand path.
- Tune stage-relative tolerances from recorded local metrics on phone, unfolded foldable, tablet, pen, and mouse.
- Validate portrait, landscape, shared-grid, and split-grid layouts.
- Add optional challenge modes only after the untimed loop feels good.

### Phase 6: Standalone decision

Measure repeat play, completed rounds, trace improvement, and use outside lesson flow. If the game earns a standalone shell, extract the already pure engine behind a narrow adapter. Do not copy the feature into a second codebase.

## Test strategy

### Pure unit tests

- Sequence conversion preserves every hand's ordered start and end locations.
- Each beat begins where the prior beat ended, or conversion reports a domain error.
- Held motions create hold segments, not zero-length move noise.
- Reversed paths fail ordered checkpoints.
- Equal geometry sampled at 30 Hz and 120 Hz produces equivalent quality within tolerance.
- Stage size changes do not change a normalized score.
- A lifted pointer fails strict continuity; `pointercancel` pauses.
- A hand is assigned by its start zone and never by pointer order.
- A third pointer cannot steal an assignment.
- Two-hand beats wait for both hands.
- A held hand leaving its zone blocks the beat.
- Shared-grid preflight rejects same-point targets and overlapping corridors.
- One-hand scoring has no hidden synchrony penalty.
- Existing quiz scoring is byte-for-byte behaviorally unchanged through the compatibility adapter.

### Component tests

- Stage capture starts and releases for every pointer lifecycle.
- Preview, arming, tracing, paused, and feedback states expose accurate instructions.
- Reduced Motion and Low Stimulus remove prohibited motion without hiding state.
- Hand identity is understandable without color.
- Exit and Pause remain usable during a trace.
- The shell grants immersive space only to games that declare the capability.

### Real-device matrix

| Device | Required proof |
| --- | --- |
| Unfolded Z Fold | Two simultaneous split traces, collision-safe shared challenge, no scroll theft, no pointer loss near the hinge region |
| Narrow phone | One-hand play and split-grid two-hand practice remain readable |
| Tablet | Shared grid uses the added area without stretching hit tolerances |
| Desktop mouse | One-hand development path and Step-through Preview work |
| Pen plus touch, where supported | Unsupported mixed-input combinations fail gracefully and never swap hand identity |

Browser verification still follows the repository rule: interactive DevTools use requires explicit permission in the active conversation. Device testing cannot be replaced by synthetic pointer events.

## Acceptance gates

Trace Paths v1 is ready when all of these are true:

- A new player can complete the first route without reading a rules page.
- Learn > Play launches Trace Paths and returns safely to the hub.
- Real canonical sequence and hand-path records drive rounds without UI inference.
- One-hand and split-grid two-hand rounds work without lifting.
- Two-hand beats correctly handle one moving hand and one held hand.
- The same trace receives materially equivalent quality at different event rates and viewport sizes.
- A wrong route identifies hand, beat, and divergence.
- `pointercancel` and app backgrounding pause instead of fail.
- Progress survives reload through the existing progress store.
- No raw trace is persisted or transmitted.
- No visual state depends on blue/red color alone.
- Reduced Motion, Low Stimulus, sound, and haptic settings work independently.
- No product copy presents the game as treatment or rehabilitation.
- An author-verified Zan's Diamond hand-path fixture completes on the user's unfolded Z Fold.
- Focused tests for the changed feature and arcade contracts pass.
- Real-device evidence includes screenshots or a short screen recording plus console output showing two stable pointer IDs.

## Risks and their answers

### Fingers cover the thing they need to see

Use oversized next targets, path preview ahead of the fingertip, route rails that remain visible outside the contact patch, and split layout when the stage is too narrow.

### Two fingers cannot occupy the same point

Use synchronized split grids by default. Reject shared-grid challenges whose simultaneous targets or corridors collide.

### Path matching becomes punitive

Make topology strict and geometry forgiving. A player must visit the right points in order, but natural wobble inside a generous corridor is not failure.

### Fast players get missing samples

Consume coalesced events and normalize by arc length. Never score from frame count.

### The game teaches screen tricks instead of flow

Keep the canonical path visible in beginner modes, synchronize by actual beats, and make the trace engine consume the same motion geometry as the sequence renderer. Treat screen skill as a bridge, not proof of physical prop mastery.

### Medical intent leaks into marketing

Keep the personal motivation out of claims. The shipped description says what the interaction does and nothing about treating a condition.

### A standalone version splits the codebase

Keep the evaluator pure and postpone the second shell. Extraction is a packaging change after product evidence, not a rewrite.

## Research record

- [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/) defines multi-pointer identity, pointer capture, `touch-action`, and coalesced events. The implementation uses stable Pointer Events and treats raw or predicted event features as optional enhancement only.
- [The $1 recognizer project](https://depts.washington.edu/acelab/proj/dollar/index.html) documents the single-stroke classifier and notes that `$P` ignores stroke number, order, and direction. That makes both useful prior art but the wrong runtime abstraction here.
- [Adaptive Computation of the Discrete Fréchet Distance](https://arxiv.org/abs/1806.01226) describes discrete Fréchet distance as an ordered point-sequence similarity measure that tolerates differences in sampling resolution.
- [WCAG 2.2: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) allows an essential-dragging exception, but the design still supplies One Hand and Step-through Preview modes.
- [WCAG 2.2: Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold) informs the stronger product rule of no flashing at all.
- [University Hospitals Bristol: Epilepsy triggers](https://www.uhbristol.nhs.uk/transition/epilepsy/epilepsy/triggers/) notes that photosensitivity affects a minority of people with epilepsy and that strong contrasting patterns can also be triggers. The product avoids broad safety claims.
- [FDA: Software function intended for a medical purpose](https://www.fda.gov/medical-devices/digital-health-center-excellence/step-1-software-function-intended-medical-purpose) explains why treatment or mitigation language changes a software product's intended-use posture. Trace Paths makes no such claim.

## Orientation evidence

The repository was searched for existing trace, stroke, pointer, grid, game, scoring, path, haptic, fullscreen, and viewport primitives before defining new code.

Found and reused in this plan:

- Learn Play registry, shell, session, scoring, progression, results, and persistence
- InteractiveCanvas, canonical SVG grid, and coordinate utilities
- tap-grid educational patterns
- haptic feedback
- fullscreen and viewport measurement
- two independent in-repo Pointer Event caches
- canonical sequence-to-hand-path data and path animation geometry

Not found:

- an in-repo freehand trace evaluator
- an ordered route matcher
- a two-hand beat gate and shared-grid collision preflight
- an installed dependency that understands domain checkpoints, holds, and synchronized hand paths

That is the justification for the proposed new evaluator and stage.
