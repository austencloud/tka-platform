# 2D Fish Motion Smoothing + Cursor Flee — Design

**Date:** 2026-06-21
**Status:** Approved, pending implementation plan
**Package:** `@austencloud/backgrounds` (source: `E:\shared-packages\packages\backgrounds`), ocean background
**Consumer:** tka-platform (OceanLab + app-wide ocean background)

## Problem

The 2D ocean fish spasm: random forward bursts, in-place twitching, vertical
pops, and abrupt direction bounces. They lack the richness of the 3D ocean fish
and have zero pointer interaction.

Audit finding: the **decision layer is good** — a timer-gated state machine
(`FishDecisionMaker`) picks a new behavior every 8–20s (`cruising.duration`),
weighted by personality + mood. The damage is entirely in the **motion layer**
(`FishMovementController`), which applies decisions as instantaneous snaps and
adds raw RNG directly to position.

### Root causes (grounded)

1. **No velocity integration — speed teleports between behaviors.**
   `FishMovementController` sets `fish.speed = baseSpeed * mult` instantly. Every
   transition is a hard discontinuity:
   - cruise→`passing`: ~40 → ~200 px/s in one frame (the "random burst forward";
     `passing` zooms 3–5× for 2–4s then snaps back).
   - cruise→`darting`: → 4–6× instant; `coil` snaps to 0.3× first.
   - `turning`: direction flips and speed → 0.3× instantly.
   The 3D boids integrate (`vel = vel*drag + steer*dt`); the 2D fish do not.

2. **White-noise positional jitter — the literal twitch.**
   `FishMovementController.ts:302/328`:
   ```js
   verticalJitter = (Math.random() - 0.5) * 4 * (1 - burstProgress);
   fish.y += verticalJitter; // uncorrelated noise added to POSITION every frame
   ```
   ±2px random teleport per frame at 60fps = visual buzzing. Recovery phase adds
   more (`*0.5`, line 322). Not scaled by dt → frame-rate-dependent.

3. **Vertical pop on dart exit.** During darting only `fish.y` is nudged;
   `baseY` is not tracked. On return to cruising, `fish.y = baseY + bob` snaps
   back by the accumulated jitter — a visible jump.

4. **Hardcoded timestep.** `FishAnimator.updateFish` computes
   `deltaSeconds = 0.016 * frameMultiplier`, ignoring real elapsed time; combined
   with un-dt-scaled position writes, motion is frame-rate-dependent.

5. **Zero pointer interaction.** 2D fish ignore the mouse. 3D fish have a full
   raycaster flee (`fish-scatter.ts` + `boid-velocity.glsl`): depth-correct
   cursor ray, proximity-falloff flee force, tangential escape, 5–7s phased
   panic recovery.

## Principle

Keep the decision system. Insert a **smoothing layer** between "behavior picks a
target" and "position updates." Behaviors write *targets*, not position/speed; a
per-frame integrator eases actual velocity toward the target — the same model the
3D boids use. Replace RNG jitter with smooth noise. Add a cursor-flee force that
mirrors the 3D scatter, adapted to 2D screen space.

## Components

### 1. Velocity integration (kills bursting / snapping)

- Add to the fish model: `vx`, `vy` (actual velocity, px/s) and `targetSpeed`
  (desired horizontal speed, px/s).
- Behaviors set `fish.targetSpeed = baseSpeed * mult` instead of `fish.speed`.
- Integrator each frame (critically-damped exponential approach):
  ```
  fish.speed += (fish.targetSpeed - fish.speed) * (1 - exp(-accelRate * dt))
  ```
  or the equivalent `drag = pow(k, dt)` form used by the 3D shader.
- `accelRate` tuned so passing/darting ramp over ~150–300ms — still explosive,
  never a single-frame jump. Darting can use a higher `accelRate` than passing so
  the C-start still reads as a burst.
- `turning`: ease heading/direction (interpolate a signed heading factor) instead
  of flipping `fish.direction` instantly.

### 2. Smooth wander replaces RNG jitter (kills the twitch)

- Remove both `fish.y += verticalJitter` writes and the `Math.random()` jitter.
- Replace the dart's lateral wiggle with per-fish **low-frequency value-noise**
  (or summed sines) over `animationTime`, dt-scaled. Continuous,
  frame-rate-independent. Amplitude/frequency in constants.
- Integrate the dart's vertical excursion into `baseY` (or drive `fish.y` from a
  single smoothed source) so dart exit does not pop.
- Make timestep honest: pass real dt (or clamp it) through `updateFish`; ensure
  every position write multiplies by dt.

### 3. Cursor flee (3D parity — headline feature)

- Extend the `IBackgroundSystem` contract with optional
  `setPointer(x: number, y: number, active: boolean): void`.
- Implement on `OceanBackgroundOrchestrator`: store pointer in ocean state, thread
  it into `FishAnimator.updateFish`.
- New handler `FishCursorAvoidance` (mirrors 3D `fish-scatter` logic in 2D screen
  space):
  - Compute fish→cursor distance (screen space; respect depth-layer scale so far
    fish react a bit less, analogous to the 3D ray rejection).
  - If within `scatterRadius` (scaled by boldness, as in 3D: timid fish flee from
    farther), inject a flee response: heading away from cursor + tangential bias
    (so fish escape sideways, not just radially), plus a speed boost.
  - **Phased recovery** back to cruise (not a snap): burst → sustain → elevated →
    calm, mirroring the 3D `boid-velocity.glsl` recovery, scaled down for 2D.
  - Falloff: `proximity = 1 - dist/radius`, force ∝ `proximity²`.
- Wire `pointermove` / `pointerleave` in the canvas host that owns the ocean
  background (window-level listener if the canvas is `pointer-events: none`),
  converting client coords to canvas coords → `setPointer`.
- Decision: cursor flee is **ON wherever the ocean background renders** (app-wide,
  not lab-only) for true 3D parity. Gated by a constant for future opt-out.

### 4. Tuning constants

All new magnitudes — `accelRate` (per behavior), flee `scatterRadius` /
`scatterForce` / recovery durations, wander frequency/amplitude — live in
`fish-constants.ts`, tunable live in OceanLab.

## Files touched

| File | Change |
|---|---|
| `domain/models/OceanModels.ts` | add `vx`, `vy`, `targetSpeed` (+ flee state fields) to `FishMarineLife` |
| `services/implementations/FishMovementController.ts` | targets not snaps; velocity integrator; remove RNG jitter; smooth wander; dt-honest writes; eased turning |
| `services/implementations/FishDecisionMaker.ts` | minor — emit `targetSpeed` semantics where it currently sets speed |
| `services/implementations/FishCursorAvoidance.ts` | **new** — screen-space flee handler + phased recovery |
| `services/implementations/FishAnimator.ts` | thread pointer into `updateFish`; honest dt; invoke cursor-avoidance |
| `services/OceanBackgroundOrchestrator.ts` | `setPointer`; store pointer; pass to animator |
| `core/contracts/IBackgroundSystem.ts` | optional `setPointer` |
| `domain/constants/fish-constants.ts` | `accelRate`, flee + wander constants |
| tka-platform canvas host | `pointermove`/`pointerleave` → `setPointer` |

## Verification

- Iterate in `OceanLab.svelte` (real component + HMR — routing-correct surface,
  per `visualization-routing.md`).
- **No-spasm proof:** log max per-frame `|Δy|` (and `|Δspeed|`) across all fish
  over a window; assert it stays under a smoothness threshold (no single-frame
  teleports). Capture before/after.
- **Flee proof:** move cursor near fish in OceanLab; confirm visible escape +
  smooth recovery (screenshot / runtime query, not a prediction).
- `npm run check` green before publish.

## Ship

Published package: version bump (`npm version patch`) + `npm publish` after green
(automation token available, no OTP — `feedback_npm_automation_token`). Then bump
the dep in tka-platform.

## Non-goals

- No full force-based boid rewrite of the 2D system (that was the rejected
  higher-risk option). The decision state machine stays.
- No change to fish-to-fish social interactions (`FishInteractionHandler`),
  rare behaviors, hunting, or rendering.
