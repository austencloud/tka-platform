# Poi Momentum Simulator — Design (2026-07-18)

## Purpose

An **offline research instrument** that grounds poi move-legality in real
physics instead of the 5 hand-authored symbolic rules in
`poi-constraint-validator.ts`. Austen's thesis: poi legality is governed by
**momentum continuity** — a poi is a tethered mass under gravity, so hand speed
determines what the head can do (an extension is impossible below a minimum
hand speed because the cord needs enough rotational momentum to stay taut).

Ratified framings (Austen, 2026-07-18):

- **Legality is two separable layers** (option C): a categorical layer ("can B
  follow A at all?", e.g. spin reversal needs a stall beat) and a physical
  layer ("at what tempo does the cord stay taut?"). The sim answers both,
  reported separately.
- **The sim is a research instrument**, not runtime machinery. The production
  composer filter stays fast and symbolic; sim findings get baked back into it.
- **Visual first, batch later.** Phase 1 is an interactive test page you watch
  and steer. A headless full-alphabet sweep comes only after the visuals earn
  trust (phase 2, out of scope here).

## Substrate decision

**Reuse the in-repo position-Verlet solver** (`jellyfish-verlet.ts`), relocated
to a shared home. Research basis: position-based dynamics with an *inequality*
distance constraint is the literature-standard way to model a rope that can go
slack (Müller's Pendulum Challenge; XPBD papers; slack-rope handling via
min/max constraints). The full engines (Rapier, Planck, Matter) earn their
weight on rigid-body contact and stacking, which a point-mass-on-a-string
never needs, and a kinematically driven pin is more natural in a solver we
control. Fallback if energy drift becomes visible in long runs: swap the
integrator to XPBD inside the same architecture — not a library swap.

## Architecture

### 1. Shared Verlet home (targeted relocation)

`src/lib/shared/3d/environments/scenes/ocean/runtime/fauna/jellyfish/jellyfish-verlet.ts`
moves to **`src/lib/shared/physics/verlet.ts`** unchanged (it is a generic
solver misfiled under a fauna directory). Jellyfish imports update; a physics
consumer must not import from an ocean-scene path.

### 2. Sim core — `src/lib/features/levels/poi-lab/sim/`

Framework-free TS modules:

- **`hand-path-sampler.ts`** — wraps
  `mandala-geometry-calculator.calculate(steps, undefined, undefined, options, { dx: 0, dy: 0 })`
  to get the hand-center path per beat (the zero tip offset collapses the prop
  tip to the hand), and the same call with a tether-length tip offset for the
  **intended head path**. Output: time-parameterized samples (mandala grid
  units) for one color.
- **`calibration.ts`** — maps TKA-space to reality. Three numbers:
  tether length `L` (default 0.75 m, range 0.5–0.9), hand-path radius in
  meters (mandala `MANDALA_GRID_RADIUS` units → meters), and BPM → beat
  duration. Exposes `gridToMeters`, `beatDuration(bpm)`, and derived hand
  speed.
- **`poi-sim.ts`** — the physics run. Two particles in a `ParticleSystem`:
  the **hand** (weight 0, positions + positionsPrev written kinematically each
  tick from the sampled hand path — NOT a `createPointConstraint`, which is
  static) and the **head** (unit weight, constant gravity force −9.81 m/s² on
  y). Tether = `createDistanceConstraint([0, L], hand, head)` — min 0 makes it
  **tension-only**: taut at L, free inside L. Fixed timestep with substeps
  (Verlet requires constant dt; target ≥240 substeps/s).
- **`metrics.ts`** — per run: **slack fraction** (share of samples where
  hand-head distance < L − ε) and **head deviation** (mean/max distance between
  simulated head and intended TKA head path, in meters). A run is
  "performable" when both are under thresholds (defaults: slack < 5%,
  max deviation < 0.15 m — tunable in the UI). `findMinBpm()` bisects BPM over
  a range (40–240) to find the physical floor per transition/sequence.

### 3. Visual page — `src/routes/test/poi-sim/+page.svelte`

A 2D canvas test page (per `visualization-routing.md`: real code, test route):

- Ghosted intended TKA head path + hand path.
- Live simulated head + cord, cord highlighted when slack.
- Controls (existing primitives per `chip-primitives.md`): BPM slider, tether
  length slider, playback (play/pause/reset), a picker for a transition or
  short sequence (seed with a few hardcoded representative step sequences:
  static spin, extension, spin reversal, dash), color choice (blue/red hand).
- Readout: slack fraction, max deviation, min-BPM result (`tabular-nums`,
  reserved widths per `no-layout-shift.md`).

## Data flow

steps → hand-path-sampler → calibration (grid→meters, BPM→time) → poi-sim
(Verlet tick loop) → metrics → page readout / min-BPM bisection.

## Error handling

Earned, not defensive: the sampler throws on empty motion steps (caller bug);
calibration clamps sliders to their ranges; the sim itself cannot fail. No
user-facing error states beyond an empty-selection placeholder.

## Testing

Unit tests (vitest, `sim/__tests__/`) against analytic ground truth:

1. **Free fall:** hand static, head released inside the tether radius → head
   follows a parabola until the cord goes taut (position matches ½gt² within
   tolerance while slack).
2. **Taut pendulum:** hand static, head at L swinging → cord stays taut at L,
   energy roughly conserved over a few seconds.
3. **Extension floor emerges:** hand driven in a circle; below the critical
   speed (v² < gL at the top) slack fraction is high; above it, near zero.
   This is the thesis test — the tempo floor must emerge from the constraint,
   not from a rule.
4. Sampler/calibration unit math (grid→meters, BPM→duration).

## Out of scope

- Phase 2 headless batch sweep / min-BPM tables for the whole alphabet.
- Any change to `poi-constraint-validator.ts` or the composer filter.
- 3D, prop-on-prop contact, hand dynamics (the hand is kinematic by design).
- The categorical layer's *derivation* — phase 1 only exposes the physical
  layer; categorical findings come from using the instrument.

## Reuse justification (never-hand-roll)

- Solver: reusing `jellyfish-verlet.ts` (relocated). Nothing else in-repo fits
  better; external engines rejected above with reasons.
- Hand paths: reusing `mandala-geometry-calculator.calculate` — the canonical
  kinematic path math; the sim must diverge from it only via physics.
- Rapier3D (`rapier-world.ts`) and the stubbed miniplex ECS physics exist and
  were considered; both rejected (3D/WASM weight, avatar-only wiring, stub).
