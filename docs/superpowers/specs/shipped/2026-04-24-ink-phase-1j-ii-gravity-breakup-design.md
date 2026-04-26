# Ink Phase 1j.ii: Gravity Sag + Strand Breakup

**Status:** Spec (2026-04-24). Builds on Phase 1j.i stamp compositing rewrite. Infrastructure unchanged.

**Problem:** Phase 1j.i ships stamp-based ink strokes that look like matte trails. The five differentiators that justify ink's slot (gravity sag, strand breakup, splatter, ground pooling, opaque pigment) — only opaque pigment shipped. Without gravity and breakup, ink doesn't earn its slot.

**Solution:** Add per-point velocity accumulation (gravity), strand breakup detection (viscosity threshold), and a falling droplet pool. Strokes deform downward over time. When stretched past a threshold, the older segment detaches into individual falling droplets.

## Architecture

### Full Gravity — Per-Point Velocity

Replace the 1j.i light sag preview with proper physics.

**InkPoint gains `vy: number`** (vertical velocity in px/s, starts at 0).

Each frame in `ageAndCullPoints`:
```
p.vy += GRAVITY_PX * dt
p.y  += p.vy * dt
```

`GRAVITY_PX = 180` — much gentler than Water2D's 820. Ink is viscous, not free-falling water. Stamps visibly sag and droop over 1-2 seconds rather than plummeting.

No age threshold. Gravity applies from birth, but since `vy` starts at 0 and accumulates quadratically, early-life displacement is imperceptible. The natural ramp IS the ease-in.

**Watercolor palette:** `GRAVITY_PX * 0.4` — watercolor runs slowly, doesn't drip fast.

### Strand Breakup

After gravity is applied, scan consecutive points in each tip's array. When the distance between adjacent points exceeds a viscosity-dependent threshold, the older segment detaches.

**Break threshold:**
```
breakThreshold = (1 - viscosity) * MAX_STRETCH_PX
```

`MAX_STRETCH_PX = 80`. At viscosity=0, threshold=80px (hard to break — continuous ribbon). At viscosity=1, threshold=0px (shatters immediately). At viscosity=0.3 (classic preset), threshold=56px — strands need significant gravity sag before snapping. Occasional drips, not constant.

**Breakup mechanics:**
1. Walk points oldest→newest, check distance to next point
2. When `dist(p[i], p[i+1]) > breakThreshold`, break here
3. All points at index ≤ i become droplets (removed from TipState.points, added to droplet pool)
4. Each detached point spawns one droplet at its current position, inheriting its current `vy` plus small random horizontal drift

**Break limit:** Max 1 break event per tip per frame. Prevents cascade where a single high-viscosity frame shatters everything at once.

### Droplet Pool

Separate from stamp points. Droplets are the falling debris from strand breakup.

```ts
interface InkDroplet {
  x: number;
  y: number;
  vx: number;      // small horizontal drift (px/s)
  vy: number;      // inherited from parent stamp + gravity
  age: number;
  maxAge: number;   // 1.0 - 2.0s (randomized at spawn)
  radius: number;   // px — small (3-8px)
  jitterSeed: number;
}
```

**Physics per frame:**
```
droplet.vy += GRAVITY_PX * dt
droplet.x  += droplet.vx * dt
droplet.y  += droplet.vy * dt
droplet.age += dt
```

**Pool size:** 512 (single tier for now, quality tiers later).

**Droplet spawn from breakup:** Each detached stamp point creates one droplet:
- Position: stamp's current (x, y)
- vy: stamp's current vy (already falling)
- vx: random ±30 px/s (slight horizontal scatter)
- radius: 3 + random * 5 px
- maxAge: 1.0 + random * 1.0 s

**Droplet death:** When `age >= maxAge` or `y > canvas.height + 50` (fell off screen).

### Rendering

**Stamps** (unchanged from 1j.i): Two-pass (edge bleed + pigment) using BrushStampCache.

**Droplets** (new): After stamp passes, render each living droplet:
- Use same stamp cache sprite
- Scale: `droplet.radius / STAMP_HALF` (small — 3-8px rendered from 64px sprite)
- Alpha: fade out over last 40% of maxAge (same curve as stamps)
- No edge bleed pass (too small)
- Same composite operation as stamps (source-over / lighter for neon)
- Rotation: `atan2(droplet.vy, droplet.vx)` — face direction of fall

### Params Changes

Add to `Ink2DParams`:
```ts
gravityPx: number;        // resolved gravity (palette-adjusted)
breakStretchMax: number;   // MAX_STRETCH_PX (tunable)
dropletPoolSize: number;   // 512
dropletMaxAge: number;     // base max age for droplets (1.5s)
```

Add to `resolveInk2D`:
```ts
const GRAVITY_PX = 180;
const BREAK_STRETCH_MAX = 80;
const DROPLET_POOL_SIZE = 512;
const DROPLET_MAX_AGE = 1.5;

gravityPx: palette.watercolor ? GRAVITY_PX * 0.4 : GRAVITY_PX,
breakStretchMax: BREAK_STRETCH_MAX,
dropletPoolSize: DROPLET_POOL_SIZE,
dropletMaxAge: DROPLET_MAX_AGE,
```

## What Stays Unchanged

- `BrushStampCache` — no changes, droplets reuse the same sprite
- `InkPalettes.ts` — no changes
- `InkOverlayRenderer.ts` — no changes
- `AnimationRenderLoop.ts` — no changes
- `EffectsConfig.ts` — `viscosity` field already exists on InkIntent, just not consumed until now
- `built-in-ink-presets.ts` — viscosity values already set per preset
- `InkCustomize.svelte` — no changes (viscosity slider already wired)

## What Changes

| File | Change |
|------|--------|
| `Ink2DRenderer.ts` | Add `vy` to InkPoint. Full gravity replaces light sag. Strand breakup detection. Droplet pool + physics + rendering. |
| `Ink2DRenderer.test.ts` | New tests for gravity velocity, breakup at viscosity thresholds, droplet spawning, droplet pool cap. |
| `canvas2d-types.ts` | Add `gravityPx`, `breakStretchMax`, `dropletPoolSize`, `dropletMaxAge` to Ink2DParams. |
| `canvas2d-translator.ts` | Resolve new fields in `resolveInk2D`. |

## Performance Budget

**Gravity:** 1 multiply + 1 add per point per frame. Negligible.

**Breakup scan:** Linear scan of points array (max 90 points per tip × 4 tips = 360 distance checks). Negligible.

**Droplet rendering:** 512 max droplets × 1 drawImage each = 512 extra stamps worst case. At 64px sprite size, well within Water2D's proven 1024-droplet budget.

## Testing

- Unit: Points accumulate downward velocity over time (vy increases each frame)
- Unit: Point y-position increases (moves down) due to gravity
- Unit: Breakup triggers when point distance exceeds threshold
- Unit: Breakup converts older points to droplets (removed from stamps, added to pool)
- Unit: No breakup at viscosity=0 (threshold = MAX_STRETCH_PX, unreachable)
- Unit: Immediate breakup at viscosity=1 (threshold = 0)
- Unit: Droplet pool respects size cap
- Unit: Droplets age out and get culled
- Unit: dispose clears droplet pool

## Known Risks

- **GRAVITY_PX too strong or weak.** 180 is a guess — may need tuning after visual inspection. Easy constant change.
- **MAX_STRETCH_PX too high/low.** If strands never break at classic viscosity, the feature is invisible. If they break too often, classic feels messy. Tunable.
- **Droplets too small to see.** At 3-8px from a 64px sprite, the downscaling may blur them into dots. Acceptable — they read as "drops fell" even if individual texture isn't visible.
