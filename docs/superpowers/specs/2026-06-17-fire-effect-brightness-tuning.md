# Fire Effect Brightness Tuning — Notes

**Date:** 2026-06-17
**Status:** TODO — needs visual iteration (NOT yet brainstormed/implemented)
**Trigger:** Austen, during v0.24.0 release prep: the rebuilt fire particle system looks
genuinely fiery (good particle behavior) but is *way too bright*. The flame core and fill
light blow out the scene. We want to dial the brightness down until it reads like real fire,
without losing the new particle system's motion/curl/buoyancy behavior.

## What's good (keep)

The Lagrangian particle rebuild is a keeper: particles inherit prop velocity, rise via
buoyancy, age with drag, curl-noise turbulence streaks the flames along prop paths, and
soft Gaussian noise-eroded sprites give wispy edges. The *shape and motion* are right. Only
the *brightness* is wrong.

## Exact knobs (verified via source read 2026-06-17)

### `src/lib/shared/3d/effects/fire/fire-particle-material-3d.ts`
- **`uEmissiveHot`** — uniform default **1.6** (line ~185). HDR core brightness of the flame
  itself. Was 3.2 in the first pass, already halved to 1.6. **Primary knob.** Try **0.9–1.2**.
- Particle shape erosion / fray amplitude `0.85 * fray` (line ~139) — flicker intensity, not
  brightness. Leave unless flicker reads too hot.
- Gaussian spread `across * 2.0` / `along * 2.0` (line ~133) — halo tightness.

### `src/lib/shared/3d/effects/fire/fire-renderer-3d.ts`
- **Point light base intensity** — **1.5** (line ~296). Dynamic fill light around the flame.
  Formula is `1.5 + speed*0.3 + jerk`. Try base **0.8–1.0**.
- **Speed boost coefficient** — **0.3** (line ~296). How much spin speed spikes brightness.
  Try **0.15**.
- **Speed boost cap** — **1.5** (line ~296). Caps the speed-driven brightness spike. Lower it.
- **Jerk boost amplitude** — **1.2** (line ~295). The "poof" flash on stalls. Lower to soften.
- Point light color `0xff7a22` (orange, line ~214) — leave.
- Point light decay distance `3.2`, decay power `2.0` (line ~214) — falloff; shrinking decay
  distance tightens the lit zone.

### `src/lib/shared/3d/effects/post-processing/BloomBillboard3D.svelte`
- Bloom sprite intensity `intent.intensity * pulseFactor` (line ~190) and radius
  `intent.radius * 0.04` (line ~192) — driven by the effects config, not hardcoded. If the
  bloom pass is amplifying the fire core, trim the fire effect's bloom intensity in its config
  defaults (and consider a migration like bloom v17 did).

## Suggested first pass (3 knobs)

1. `uEmissiveHot` 1.6 → 0.9–1.2
2. Point light base 1.5 → 0.8–1.0
3. Speed boost coeff 0.3 → 0.15

Test at HIGH and LOW quality tiers (particle pool 7000 vs 1000; bloom pulse differs by tier).
Iterate on real footage — this is a taste call, not a fixed target.

## Before implementing

Run `superpowers:brainstorming` on the look we're targeting (reference real fire footage,
decide warm-up ramp, decide whether brightness should track BPM), then a proper change with
before/after capture per `verification-protocol.md`.
