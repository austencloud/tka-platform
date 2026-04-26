# Effects Phase 1b: Zap Polish Design

**Status:** Spec (2026-04-15). Follows Phase 1a (foundation + Zap vertical slice, `phase-1a-zap-complete` tag).

**Goal:** Fix regressions and modernize UX on the Zap effect, then advance to Sparkles in Phase 1c.

## What's wrong right now

Austen verified Phase 1a and approved the core experience ("the ZAP is really really cool"), but surfaced six issues during polish review:

1. **Presets don't apply.** Clicking Thunder / Tesla / Plasma in the preset grid does not visibly change the effect. Custom might also be silent.
2. **Single-color only.** Every other tip effect (fire, trails, led, charcoal) exposes per-hand colors. Zap has one `color`.
3. **Mode dropdown looks dated.** Native `<select>` for Arc / Crackle. Should be a two-chip row consistent with `EffectSelector.svelte`.
4. **Color picker is the browser native swatch.** Other Customize panels in the codebase use a more modern picker. Zap should match.
5. **Slider styling feels dated.** Visual consistency with the most modern sibling Customize panel.
6. **Frequency slider is a no-op.** `Zap2DRenderer.render()` uses a hardcoded `regenerateEveryFrames = 3` class constant and ignores `params.frequency`.

## Architecture

Six fixes clustered into three groups by shared mechanism:

### Group A — Correctness bugs (fix first, cheap)

**Preset application.** Suspected root cause: the `prevZapIntentJson` JSON-diff cache in `AnimationEngine.svelte.ts` misses when presets set intent to a shape identical to a prior one (object-key order divergence, or reference-equality path skipping serialization). Investigation step:

1. Add a `console.log` at the top of `syncZapOverlay()` to confirm it fires on preset click.
2. If it fires: the issue is downstream (renderer not picking up new params). If it doesn't fire: the VM observer or the diff cache is blocking.
3. Most likely fix: presets mutate `state.zap` via `state.updateZap(...)` but the cache key uses `JSON.stringify` which is stable-enough for this — so if it fires but doesn't apply, suspect `getFrameParams()` isn't re-resolving. Confirm `resolveZap2D(state.zap)` is called when the diff fires.

One-line fix if the diff cache is the issue: invalidate `prevZapIntentJson = ""` whenever `state.zap` reference changes (not just content).

**Frequency slider.** In `src/lib/shared/animation-engine/renderers/Zap2DRenderer.ts`, replace the hardcoded `regenerateEveryFrames = 3` class constant with a per-frame computation:

```ts
render(ctx, params, tips) {
  const regenerateEveryFrames = Math.max(1, Math.round(60 / params.frequency));
  // ...existing logic using this local instead of this.regenerateEveryFrames
}
```

Delete the class field. No other call sites to update.

### Group B — Per-hand color (data-model change)

Extend `ZapIntent` to carry left and right colors independently. Follow the pattern used by whichever sibling effect (fire / trails / led / charcoal) has the cleanest per-hand implementation — check all four and match the modern one.

**Data model (`src/lib/shared/effects/domain/EffectsConfig.ts`):**

```ts
export interface ZapIntent {
  intensity: number;
  frequency: number;
  leftColor: string;   // renamed from `color`
  rightColor: string;  // new
  branching: number;
  mode: "arc" | "crackle";
}
```

**Migration.** Bump `EFFECTS_CONFIG_VERSION` from 2 to 3. In `migrations.ts`, add v2→v3:

```ts
if (raw.__version === 2 && raw.zap?.color) {
  raw.zap = {
    ...raw.zap,
    leftColor: raw.zap.color,
    rightColor: raw.zap.color,
  };
  delete raw.zap.color;
}
```

**Translator.** `Zap2DParams` and `Zap3DParams` both grow `leftColor` + `rightColor`. `resolveZap2D` / `resolveZap3D` pass them through.

**Renderer.** `Zap2DRenderer.drawArc(ctx, params, startTip, endTip)` currently accepts one color. Change signature to select per endpoint — the "start" end gets `leftColor` if it's on the blue prop (propIndex 0), `rightColor` if red prop (propIndex 1). For crackle mode (radiating), each origin-prop's bolts use its own color.

Wire the `propIndex` through from `Zap2DRenderer` call sites so the renderer knows which hand each tip belongs to. `AnimationRenderLoop` already has this context via `sharedTipResult`.

**3D.** `ElectricityArc.svelte` currently takes one `color` prop. Extend to `leftColor` / `rightColor` or add a per-instance `color` picked in the parent. `EffectsLayer.svelte` mounts two ElectricityArc instances today — each already knows which pair of tips it connects, so passing the right color is a one-line change per instance.

**Defaults.** `leftColor = "#88ccff"`, `rightColor = "#88ccff"` (same as current default, preserves v1 experience).

### Group C — UX modernization (UI-only, no data-model change)

**Mode chip row.** Replace the `<select>` in `ZapCustomize.svelte`:

```svelte
<div class="mode-row">
  <span>Mode</span>
  <div class="chip-row">
    <button
      class="chip" class:active={state.zap.mode === "arc"}
      onclick={() => state.updateZap({ mode: "arc" })}
    >Arc</button>
    <button
      class="chip" class:active={state.zap.mode === "crackle"}
      onclick={() => state.updateZap({ mode: "crackle" })}
    >Crackle</button>
  </div>
</div>
```

Copy chip styling from `EffectSelector.svelte` (active state, hover, focus-visible, reduced-motion). Two options only — no overflow handling needed.

**Modern color picker.** Audit first:

1. `grep -r 'type="color"' src/` — all native-picker sites.
2. `find src -name 'ColorPicker*.svelte' -o -name '*color-picker*'` — existing shared components.
3. Pick the most modern sibling. If nothing shared exists, identify the cleanest in-place implementation and replicate the pattern locally.

Two color pickers in ZapCustomize (left + right). Layout: side-by-side with hand labels ("Left hand" / "Right hand") matching whatever sibling effect presents it most cleanly.

**Slider modernization.** Audit `input[type="range"]` usage across Customize panels. Align with the most modern sibling OR extract a shared component if three or more Customize panels have diverged. Do NOT extract unless three divergent copies exist — YAGNI.

## Task breakdown (for writing-plans phase)

Ordered by risk-adjusted value:

1. **Investigate preset bug + add logging** — 30 min, might be a 1-line fix.
2. **Fix frequency slider** — trivial, single-line change.
3. **Audit shared color picker + slider components** — research task, outputs an audit note that informs Task 8.
4. **Extend `ZapIntent` with `leftColor` / `rightColor`** + migration v2→v3 + migration test.
5. **Update translator types + resolvers** for per-hand color.
6. **Update `Zap2DRenderer.drawArc` signature** — accept propIndex, pick color accordingly. Test the render path with two different colors.
7. **Update `ElectricityArc.svelte` (3D)** — accept and apply per-hand color.
8. **Refactor `ZapCustomize.svelte`:**
   - Chip row for mode
   - Two color pickers (using shared component from Task 3)
   - Modernized sliders (using shared component from Task 3 if extracted)
9. **Visual verification via Chrome DevTools MCP** — confirm all six fixes visible in the running Effects Lab.

## Test plan

- **Unit:** `migrations.test.ts` gets a v2→v3 case. `canvas2d-translator.test.ts` gets a "per-hand color resolves correctly" test.
- **Integration:** `Zap2DRenderer` render test with two different colors — assert different `strokeStyle` values set across frames.
- **Visual:** DevTools screenshot after each of the 3 UX changes (mode chip, color picker, sliders).

## Non-goals (deferred to backlog or future phase)

- Crackle mode 3D parity (4 origins instead of 2) — stays in `docs/superpowers/specs/effects-unification-deferred-items.md`.
- FireTipTracker output aliasing — stays in deferred items.
- Dark-mode auto-trigger for zap — open question for Austen.
- Sequence viewer EffectsConfigState wiring — stays deferred until Phase 2 or Phase 3.

## References

- Phase 1a tag: `phase-1a-zap-complete`
- Phase 1a plan: `docs/superpowers/plans/2026-04-15-effects-phase-1a.md`
- Overall unification spec: `docs/superpowers/specs/2026-04-15-effects-unification-design.md`
- Deferred items: `docs/superpowers/specs/effects-unification-deferred-items.md`
