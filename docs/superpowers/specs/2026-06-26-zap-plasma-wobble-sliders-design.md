# Zap Plasma Wobble + Expanded Sliders — Design

**Date:** 2026-06-26
**Status:** ✅ Approved (ship all 4 sliders) — implementing
**Surface:** zap effect (`drawPlasma`), the tuner's `ZapCustomize.svelte`, the manifest

## Problem

The zap "Plasma" style (`drawPlasma` in `zap-2d-renderer.ts`) reads great but
strobes: the wobbling conduit's curve control point is re-randomized **every
frame** —

```js
const wob = (18 + energy * 30) * scale;
const mx = mid.x + rnd(-wob, wob);   // fresh white noise, 60×/sec
const my = mid.y + rnd(-wob, wob);
```

No temporal coherence → frantic back-and-forth. Nothing controls its rate or
amount. Zap only exposes intensity + frequency as sliders; `glowBlur`/`lineWidth`
are derived from intensity (not tunable) and `segments`/`jitterAmount` in the
resolved params are dead (the renderer never reads them).

## Fix

### 1. Smooth wobble (coherent sine, not per-frame random)

Displace the conduit midpoint **perpendicular to the bolt axis** by a sum of two
sines driven by `frameCount`, with per-bolt + per-layer phase offsets so the 3
conduit layers braid:

```js
const px = -dy / len, py = dx / len;                  // perp unit vector
const amp = wobbleAmount * (10 + energy * 26) * scale;
const t = frameCount * (0.02 + wobbleRate * 0.22);    // slow → fast
const phase = t + boltIndex * 1.7 + layer * 2.3;
const bow = Math.sin(phase) * amp
          + Math.sin(phase * 1.9 + 0.6) * amp * 0.35 * (0.5 + jitter); // crackle octave
mx = mid.x + px * bow;  my = mid.y + py * bow;
```

At the default `wobbleRate` 0.18 the conduit undulates on a ~1.7s period (calm);
at 1.0 it's ~0.4s (lively, still not strobe). Sparks keep `Math.random`. Net:
**more** deterministic than today (good for export).

### 2. Four new `ZapIntent` fields (all 0–1)

| Field | Default | Affects | Role |
|---|---|---|---|
| `wobbleRate` | 0.18 | plasma | undulation speed — the fix |
| `wobbleAmount` | 0.5 | plasma | how far the conduit bows |
| `glow` | 0.5 | all styles | drives `glowBlur` (was intensity-derived) — tighten ↔ bloom |
| `jitter` | 0.5 | all styles | bolt-path roughness — scales the `jag` displacement (storm/web) and the plasma crackle octave |

`resolveZap2D`: `glowBlur` now derives from `glow` (`6 + glow*22`, ≈ the old
intensity-derived value at glow 0.5). `lineWidth` stays intensity-derived.
`jag()` callers multiply their displacement by `(0.35 + jitter*1.3)` (jitter 0.5
≈ current look). Defaults chosen so existing output is unchanged at the midpoints.

### 3. Sliders

- **`ZapCustomize.svelte`** (the tuner surface, hand-rolled): add Wobble Rate +
  Wobble Amount **inside the existing `{#if style === "plasma"}` guard** (mirrors
  how Branching is storm-only), and Glow + Jitter always shown.
- **Manifest `EFFECT_CONTROLS.zap`**: add the same four as tier **`advanced`**
  (keeps the primary row at 4, satisfies the 3–5 primary-row test; the 3D viewer
  popover surfaces advanced via its expander). Wobble two get
  `showWhen: i => i.style === "plasma"`.

`ZapCustomize` is hand-rolled rather than manifest-driven — known drift from the
control-consolidation spec. Migrating it to `EffectControlStack` is the real
dedup but is out of scope here; flagged.

### 4. Config version + preset

- Bump `EFFECTS_CONFIG_VERSION` 23 → 24; add a v23→v24 comment in `migrations.ts`
  (net-new fields resolve from defaults via the existing per-effect merge — no
  migration code).
- Retune the **Tesla** preset (`zap-presets.ts`, the plasma preset) to the calm
  wobble: `wobbleRate ~0.16, wobbleAmount ~0.55, glow ~0.6, jitter ~0.35`.

## Testing

- `canvas2d-translator.test.ts`: assert `resolveZap2D` maps `glow` → `glowBlur`.
- `zap-2d-renderer.test.ts`: a **coherence** test — capture the plasma
  `quadraticCurveTo` control point across consecutive frames via a mock ctx;
  assert the frame-to-frame delta is small at low `wobbleRate` and larger at high
  `wobbleRate` (locks the strobe out).
- `effect-control-manifest.test.ts` already asserts every descriptor field exists
  on the default intent — passes once the defaults gain the four fields.

## Files

- `effects-config.ts` (ZapIntent + version), `defaults.ts` (zap block),
  `migrations.ts` (comment), `canvas2d-translator.ts` (resolveZap2D),
  `zap-2d-renderer.ts` (drawPlasma + jag), `ZapCustomize.svelte` (sliders),
  `effect-control-manifest.ts` (advanced sliders), `zap-presets.ts` (Tesla),
  + the three test files.

## Out of scope

Migrating `ZapCustomize` to the manifest renderer; promoting `lineWidth`/spark
density/conduit count to sliders (YAGNI — revisit if the four aren't enough).
