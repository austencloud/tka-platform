# Effects Phase 1e (Revised): Bloom — Per-Tip Radial Halos

**Status:** Spec (2026-04-17). Pivots the originally-planned "fullscreen post-process bloom" into **per-tip radial halation fields**, because fullscreen bloom is architecturally exclusive with other per-tip effects (radio-gated chip row) and degenerates to near-invisible on a dark canvas when no other effect is firing.

**Goal:** Replace the stub `BloomIntent {intensity, threshold, radius}` with a full per-tip bloom shape. Each active tip gets a soft additive radial gradient centered on its screen position — a continuous field of light that reads as the prop being *present* in the space. Earns its slot alone, not only in combination with other effects.

## Why per-tip bloom, not fullscreen

Austen's feedback rule: *each effect must uniquely visualize something no other effect does, ALONE on a dark canvas*. Fullscreen post-process bloom is a modifier — it amplifies existing bright pixels. Activated in isolation, it produces a subtle cinematic smoothing. That's exactly the derivative/underwhelming failure mode that killed Motion.

Per-tip radial halation claims a distinct slot:

| Effect | What it visualizes |
|--------|-------------------|
| Trails | continuous path through space |
| Fire / Charcoal | turbulent plume emission (upward, reactive) |
| LED | discrete pattern along staff length |
| Zap | tip-to-tip arc / radiating crackle |
| Sparkles | discrete particles ornamenting motion |
| Echo | beat-onset phantoms of staff geometry |
| **Bloom** | **continuous radial light field fixed to each tip** |

Bloom = "the prop is radiant in this space." Flowers bloom (expand outward with color); light blooms (glows outward). Same word, same shape.

## Intent shape

Reshape `BloomIntent`. Bump `EFFECTS_CONFIG_VERSION` 6→7 with a migration that preserves `intensity`, discards `threshold` (no longer meaningful), maps old `radius` (0-1) to the new pixel scale, and seeds new fields with defaults.

```ts
export interface BloomIntent {
  /** 0-1 — peak alpha at center. */
  intensity: number;
  /** 8-80 px — halo radius in 2D. 3D billboard scales proportionally. */
  radius: number;
  /** Hex — when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex) — when colorMode === "palette". */
  palette: string[];
  /** "solid" = use color, "prop-matched" = blue tips blue / red tips red, "rainbow" = hue cycles with time, "palette" = cycle through palette per tip index. */
  colorMode: "solid" | "prop-matched" | "rainbow" | "palette";
  /** "smooth" = gaussian falloff, "sharp" = tighter hot core, "ring" = hollow corona. */
  falloff: "smooth" | "sharp" | "ring";
  /** 0-1 — breathing amplitude (0 = static halo, 1 = full on/off pulse). */
  pulse: number;
  /** 0.25-4 Hz — pulse frequency. */
  pulseRate: number;
}
```

**Defaults:**

```ts
bloom: {
  intensity: 0.7,
  radius: 28,
  color: "#f472b6",
  palette: ["#f472b6", "#fbbf24", "#22d3ee"],
  colorMode: "solid",
  falloff: "smooth",
  pulse: 0,
  pulseRate: 1,
}
```

## Architecture

Pattern matches Sparkles/Echo:
- `Bloom2DRenderer` — per-tip additive radial gradients, frame-time-based pulse modulation.
- `IBloomOverlayRenderer` contract + `BloomOverlayRenderer` wrapper.
- New 3D mount `BloomBillboard3D.svelte` — one `T.Sprite` per tip with a procedural radial-gradient canvas texture, scaled by `radius`.
- Translator entries: `canvas2d-types.ts` + `canvas2d-translator.ts` + `webgl3d-types.ts` + `webgl3d-translator.ts`.
- Engine wiring in `AnimationEngine.svelte.ts` + `AnimationRenderLoop.ts` (pattern copied from echo: `bloomRenderer`, `bloomConfig`, `prevBloomIntentRef`, `lastBloomFrameTime`, `bloomActive`, `bloomDisabledByError`, `consecutiveBloomErrors`).
- Replace the `EffectsLayer.svelte` "legacy BloomEffect post-process" slot with the new per-tip `BloomBillboard3D` mounts (4 instances per tip). Legacy `BloomEffect.svelte` stays on disk (unused) — Phase 3 retires it.
- Chip label stays **Bloom**, icon stays `fa-sun`, color stays `#f472b6`.

### Bloom2DRenderer internals

Per frame:
1. Compute `t = performance.now() / 1000`.
2. Compute `pulseFactor = 1 - params.pulse + params.pulse * (0.5 + 0.5 * Math.sin(t * params.pulseRate * Math.PI * 2))`.
3. For each active tip (from `BloomTipInput[]`):
   - Resolve color by `colorMode`:
     - `solid` → `params.color`
     - `prop-matched` → `tipColors.blue` or `tipColors.red` from input
     - `rainbow` → `hsl((t * 60) % 360, 80%, 60%)` (full hue cycle / 6s)
     - `palette` → `palette[tipIndex % palette.length]`
   - Resolve alpha: `params.intensity * pulseFactor`
   - Build radial gradient at `(x, y)` with stops determined by `falloff`:
     - `smooth` → `[0: color@alpha, 0.4: color@alpha*0.5, 1: transparent]`
     - `sharp` → `[0: color@alpha, 0.15: color@alpha*0.7, 0.6: color@alpha*0.1, 1: transparent]`
     - `ring` → `[0: transparent, 0.45: color@alpha*0.2, 0.7: color@alpha, 0.9: color@alpha*0.3, 1: transparent]`
   - Draw `ctx.fillRect(x-r, y-r, 2r, 2r)` with `globalCompositeOperation = "lighter"`.
4. Restore blend mode to default.

### BloomBillboard3D

Sibling of `GhostStaff3D.svelte`. For each `tipState` (4 total: blueA, blueB, redA, redB):
- Compute world position from the tip's staff end (matches existing ghost/sparkle plumbing).
- Mount a `T.Sprite` with `T.SpriteMaterial` (transparent, `blending: THREE.AdditiveBlending`, `depthWrite: false`).
- Procedural `CanvasTexture` generated once per `(colorMode, falloff, color, radius, palette, propColor)` tuple — cached via a `Map<string, Texture>`.
- Sprite scale = `radius * 0.04` world units (tuned so 28 px 2D ≈ 1.12 world units 3D).
- Opacity = `intensity * pulseFactor` driven each frame from a reactive `$derived`.

### Presets

1. **Candle** — warm amber, smooth, slight pulse. `color: "#fbbf24", intensity: 0.65, radius: 32, falloff: "smooth", pulse: 0.3, pulseRate: 0.8`. Preview color: amber.
2. **Halo** — white hollow ring, wide. `color: "#ffffff", intensity: 0.75, radius: 44, falloff: "ring", pulse: 0, pulseRate: 1`. Preview: white.
3. **Prism** — palette rotating per tip. `palette: ["#f472b6", "#fbbf24", "#22d3ee", "#a855f7"], colorMode: "palette", falloff: "smooth", radius: 30`. Preview: rainbow.
4. **Twin Stars** — prop-matched hot cores. `colorMode: "prop-matched", falloff: "sharp", intensity: 0.85, radius: 36`. Preview: prop-pair.
5. **Custom**

### Customize panel

- **Color mode** chip row: Solid / Prop-Matched / Rainbow / Palette
- **Falloff** chip row: Smooth / Sharp / Ring
- Conditional color picker (when `colorMode === "solid"`)
- Conditional palette swatches (when `colorMode === "palette"`)
- Sliders: Intensity (0-1), Radius (8-80, step 2), Pulse (0-1), PulseRate (0.25-4 Hz, step 0.25)

## Task breakdown

1. **v6→v7 migration + BloomIntent reshape.** `EffectsConfig.ts`, `defaults.ts`, `migrations.ts`. Migration preserves `intensity`, scales old radius (0-1 normalized → pixel value via `old*72+8` clamp 8-80), seeds new fields.
2. **Translator entries** — `Bloom2DParams` + `Bloom3DParams` + resolve functions.
3. **IBloomOverlayRenderer contract + BloomOverlayRenderer wrapper.** Input type `BloomTipInput { x, y, propIndex: 0|1, tipIndex: number, blueColor: string, redColor: string }`.
4. **Bloom2DRenderer implementation** — per-tip radial gradients, pulse modulation, 4 colorMode × 3 falloff strategies.
5. **Engine wiring** — rename all the analogous echo fields to bloom in `AnimationEngine.svelte.ts` + `AnimationRenderLoop.ts`. Add bloom render block after echo. Intent-diff entry. Resize/dispose hooks.
6. **BloomBillboard3D.svelte 3D mount** — procedural texture cache, 4 sprites per scene, additive blending.
7. **Replace `EffectsLayer.svelte` mount** — drop the legacy `BloomEffect` post-process import; mount `BloomBillboard3D`. Legacy file stays on disk.
8. **bloom-presets.ts** — Candle / Halo / Prism / Twin Stars / Custom.
9. **BloomCustomize.svelte** — 2 chip rows + conditional color/palette + 4 sliders.
10. **EffectsPanel + EffectSelector routing** — `getPresetGroup` case "bloom", mount `BloomCustomize` (replaces `ComingSoonCustomize` stub), preserve chip label/icon/color.
11. **Verification** — `npm run build`, `npm run check`, vitest, manual check if possible.

## Test plan

- **Unit:** `migrations.test.ts` v6→v7 case (old {intensity, threshold, radius} → new full shape; tipEffectMap entries pointing at "bloom" stay valid; threshold field dropped).
- **Unit:** `Bloom2DRenderer.test.ts` — pulse modulation math, falloff gradient stops, palette indexing per tip, prop-matched color pick.
- **Integration:** build + check pass at every commit boundary.

## Non-goals (deferred)

- True fullscreen post-process bloom (a separate `PostProcessSlot` architectural layer — deferred to Phase 2+ when stacking lands)
- Motion-reactive intensity (brighter when moving fast)
- Screen-space bokeh / chromatic aberration
- HDR tone mapping

## References

- Phase 1d Echo tag: `phase-1d-echo-complete`
- Feedback: `memory/feedback_effects_must_earn_slot.md` (the rule that drove this pivot)
- Deferred: `docs/superpowers/specs/effects-unification-deferred-items.md`
