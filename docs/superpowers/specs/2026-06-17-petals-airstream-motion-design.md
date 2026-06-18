# Petals 2D — Airstream Motion Model

**Date:** 2026-06-17
**Status:** Approved (Austen, "go nuts")
**Scope:** 2D canvas petals only. 3D petals (`PetalEmitter3D`, `PetalAmbientShower3D`) untouched.

## Problem

The shipped 2D petals effect is a generic falling-leaves system bolted to tip
positions. Three concrete defects, verified in code:

1. **Oversized.** `petals-2d-renderer.ts:86` sizes petals `baseSize(10) × (0.7 +
   0.9·intensity)` → ~32px sprite at intensity 1; `blossom_flower` adds a
   `size·1.6` glow halo (`petal-palettes.ts:531`) → ~50px boxes.
2. **Synchronized wibble-wobble.** `integratePetals` (`:184`) applies
   `sin(phase + clock·swayFreq·TAU)·swayBase` with one global `clock` and one
   `swayFrequency` (1.4Hz) shared by every petal. The whole field shimmies
   side-to-side in lockstep. Rotation is welded to the same term, so petals
   pivot in sync too — reads as noisy.
3. **Weakly reactive.** Prop motion only modulates *spawn count*. Shed petals
   ignore the prop's velocity entirely and immediately do their own gravity +
   sine. The prop sheds confetti; it does not carve the air.

## Decision

Replace the 2D motion model with **airstream inheritance** (harness cell "A",
selected after live comparison at `/test/petals-rethink`):

- A petal is **born with `carry × tipVelocity`** — it launches along the prop's
  actual instantaneous direction. Fast arcs fling streaks; slow drags release
  gently; an upward swing flings petals up before they fall.
- Inherited horizontal motion **decays** toward a terminal fall, rate governed
  by `streakLength` (low = quick puff, high = long ribbon trailing the path).
- The global synchronized sine is **deleted**. Replaced by tiny **per-petal
  flutter** (individual frequency + phase) so streaks don't read as rigid lines.
- Tumble follows the petal's actual velocity, not a shared clock.

Tuned defaults (locked from the harness): `carry 0.55`, `streakLength 0.4`,
size formula halved, blossom flower thinned + de-haloed.

## Data model

`PetalsIntent` (`effects-config.ts`) — **keep `swayAmplitude`** (still drives the
untouched 3D sway), **add**:

```ts
/** 0-1. Fraction of prop tip velocity a petal inherits at birth (2D airstream). */
carry: number;          // default 0.55
/** 0-1. How long inherited motion lingers before settling (2D streak length). */
streakLength: number;   // default 0.4
```

`EFFECTS_CONFIG_VERSION` 20 → 21. Both fields are net-new: an absent value
resolves to the default through the existing `{...DEFAULT.petals, ...input.petals}`
merge in `migrateEffectsConfig`. No field mutation — just a documented version
bump (matches the v7→v15 net-new-effect pattern).

`Petals2DParams` (`canvas2d-types.ts`): **remove** `swayBaseSpeed` +
`swayFrequency` (2D no longer sways globally). `carry`/`streakLength` arrive for
free via `extends PetalsIntent`. The 3D `webgl3d-types` copies are independent
and stay.

## Renderer (`petals-2d-renderer.ts`)

Spawn, pooling, palette resolution, fade, ember rim, silhouette kernel, and the
ambient/motion spawn-rate math are **unchanged**. Changes:

- **Size:** `baseSize × scale × (0.4 + 0.6·intensity)` (≈ half today; intensity
  0.6 → ~7.6px half-size, matching the approved harness size).
- **Birth velocity:** `vx = svx·carry + spread`, `vy = svy·carry + smallFall`,
  where `(svx,svy)` is the existing smoothed tip velocity (px/s).
- **Integrate:** `vx *= pow(0.02 + streakLength·0.5, dt)` (drag);
  `vy` eases toward terminal fall `fallBaseSpeed·(0.3+0.7·fallSpeed)·scale`;
  per-petal `flutter = sin(clock·p.freq + p.phase)·16·scale` added to `vx`;
  `rot += (vx·0.0016 + flutter·0.02)·dt·60`.
- **Petal struct:** drop `rotK`, add `freq` (individual, 1.4–4 rad/s). `phase`
  reused for flutter.
- Delete the global `swayFreq`/`swayBase` block.

## Palette (`petal-palettes.ts`)

- `BLOSSOM.sprites` ratio `1:3` flower:petal → **`1:7`** (flower rarer).
- `drawBlossomFlower` glow halo `size·1.6` → **`size·1.15`** (stop dominating).

## UI (`PetalsCustomize.svelte`)

- "Sway" slider → **"Carry"** bound to `carry`.
- **Add "Streak"** slider bound to `streakLength`.
- `swayAmplitude` is no longer surfaced in the 2D panel; it persists at its
  default for the 3D path. (Deliberate: 3D petal-sway tuning was not a
  requirement; re-add a 3D-scoped control later if needed.)

## Presets (`petals-presets.ts`)

Each preset gains `carry` + `streakLength` for flavor (Tornado/Storm high carry
+ long streak; Gilded low/short). `getSummary` reports `carry` instead of `sway`.
`swayAmplitude` values retained (3D).

## Tests

- `petals-2d-renderer.test.ts`: `makeParams` drops `swayBaseSpeed`/
  `swayFrequency`, adds `carry`/`streakLength`. "petals fall" test uses
  `carry: 0` (static tips → pure fall). Spawn/cap/tracking/ember tests unchanged.
- `canvas2d-translator.test.ts`: replace the `swayBaseSpeed > 0` assertion with
  a `carry`/`streakLength` pass-through check.
- `migrations.test.ts`: version assertions are symbolic (`EFFECTS_CONFIG_VERSION`),
  auto-track the bump.

## Verification

1. `npm run check` clean.
2. `vitest run` on petals renderer + translator + migrations.
3. Port the model into the real effects-lab on a spinning sequence; confirm the
   on-canvas behavior matches the harness (reactive streaks, no synced wobble,
   smaller sprites).

## Out of scope

3D petals, the WebGPU/render-graph particle path, export pipeline. The harness
route (`/test/petals-rethink`) is throwaway scaffolding — not shipped.
