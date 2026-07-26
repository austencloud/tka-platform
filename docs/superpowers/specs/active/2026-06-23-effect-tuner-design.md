---
status: active
value: 3
effort: M
remaining: "Body status: Active (throwaway harness; the durable deliverable is updated `defaults.ts`)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Effect Tuner — pick sensible shipped defaults for all 16 effects

**Date:** 2026-06-23
**Status:** Active (throwaway harness; the durable deliverable is updated `defaults.ts`)

## Problem

`DEFAULT_EFFECTS_CONFIG` (`src/lib/shared/effects/domain/defaults.ts`) ships a
default intent for each of the 16 visual effects (trails, fire, led, charcoal,
zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk,
pulse). Several read poorly out of the box — the trigger for this work was bloom
appearing **blown out** in the tunnel kaleidoscope after the per-tip starvation
bug was fixed (commit `a179ec646a`). There is no surface for judging an effect's
default live and locking a better one. We need an instrument to sweep all 16 and
refine the shipped defaults.

The **page is throwaway**; the **deliverable is the refined values** committed
into `DEFAULT_EFFECTS_CONFIG`.

## Goals

- One route that renders any of the 16 effects live, using the **real renderers
  and real per-effect tuning panels** (no mockups, no hand-rolled controls).
- Judge each effect against two scenes: a **clean** single prop pair (the honest
  single-effect read) and the **tunnel** kaleidoscope (the additive-overlap
  stress gate). A locked default must survive both.
- Capture a locked effect's intent as JSON to paste into `defaults.ts`.

## Non-goals

- No production "Choose a Look" / preset changes. This tunes the **baseline
  default**, which is what users land on before they touch any preset.
- No write-back infrastructure (no file-mutating dev endpoint). Defaults reach
  `defaults.ts` by hand, one effect at a time.
- No full-param sweep. We start from the current default and **change only the
  params that read wrong**; params that already look good are left alone.

## Approach (decided)

Clone-and-adapt `src/routes/test/prop-tunnel/+page.svelte` into
`src/routes/test/effect-tuner/+page.svelte`. `prop-tunnel` already proves the
hard parts: real `AnimatorCanvas` driven by `generationOrchestrator` +
`rotateSequence`/`mirrorSequence`, an **isolated** effects config
(`createEffectsConfigState(undefined, { persist: false })` — never touches the
user's global `tka_effects_config`), the effect selector, the `tipEffectMap`
blanket (`{ "*": { effect } }`), and all 16 real customize/settings panels wired
to that isolated config.

The tuner is `prop-tunnel` with three additions and one removal.

### Reused as-is (zero hand-roll)

- `AnimatorCanvas` (`src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`)
- All 16 real panels: `FirePanel`/`CharcoalPanel`/`LedPanel`/`TrailsPanel`
  (settings-panels) + the 12 `*Customize.svelte` views
  (`src/lib/shared/animation-engine/components/effects-panel/customize/`). These
  panels render the real controls off `effect-control-manifest.ts`.
- `createEffectsConfigState` + `setEffectsConfigContext`
  (`src/lib/shared/effects/state/`)
- `generationOrchestrator`, `rotateSequence`, `mirrorSequence`,
  `interpolatePropAngles`, `motionQueryHandler` (same imports as `prop-tunnel`)

### Addition 1 — Scene toggle: Clean ⇄ Tunnel

A `scene` knob: `"clean" | "tunnel"`.

- **Clean:** the rotational/mirror layer build is skipped — `rotated = []`, so
  the derived `additionalLayers` is empty and `AnimatorCanvas` renders only the
  base blue+red pair. This is the honest single-effect read.
- **Tunnel:** the existing `rotAmountsFor(fold)` + mirror logic from
  `prop-tunnel` runs unchanged.

The same `effectsConfig` instance backs both scenes, so flipping the toggle
carries the locked intent across untouched — that is the overlap gate ("looks
right solo → does it survive the pile-up").

Implementation: the topology `$effect` that calls `buildSequences()` keys on
`scene|fold|mirror`; in `clean` mode `buildSequences` generates the base
sequence but assigns `rotated = []` (still needs `base` for the pair + grid).

### Addition 2 — Default prop = STAFF

`prop-tunnel` defaults `propType` to `SWORD` (1 tip end per prop). The coverage
/ blowout problems only manifest with 2-end props, so the tuner defaults to
`PropType.STAFF` (2 ends). The full prop selector stays for spot-checking other
prop geometries.

### Addition 3 — "Copy default JSON" button

Snapshots the active effect's live intent and writes it to the clipboard:

```ts
const json = JSON.stringify(
  $state.snapshot(effectsConfig[activeEffect]),
  null,
  2,
);
await navigator.clipboard.writeText(json);
```

That object is exactly the shape of `DEFAULT_EFFECTS_CONFIG[activeEffect]`, so it
pastes straight in. Disabled when `activeEffect === "none"`.

### Removal — named-preset localStorage block

`prop-tunnel`'s save/apply/delete named-look feature (`PRESETS_KEY`,
`TunnelPreset`, the chips row) is tunnel-look authoring, not defaults-picking.
Drop it to keep the harness lean.

## The tuning loop (per effect)

1. Select the effect → its panel loads the **current** default into the
   isolated config.
2. Judge in **Clean** (STAFF). Reads wrong (blown out / too sparse / wrong
   color)? Tweak only the offending params via the real panel.
3. Flip to **Tunnel**. Confirm the same value survives additive overlap.
4. **Copy default JSON** → paste into `DEFAULT_EFFECTS_CONFIG[effect]` in
   `defaults.ts` (one commit per effect or batched, with explicit pathspec).
5. HMR confirms the new default renders. Next effect.

Repeat across all 16. `none` is skipped (no params).

## Files

- **Create:** `src/routes/test/effect-tuner/+page.svelte` — grep found no
  existing defaults-tuning route; `prop-tunnel` is tunnel-look authoring, not
  baseline-default tuning, and lacks the clean scene + copy-default. Justified
  as a focused clone.
- **Edit (the deliverable):** `src/lib/shared/effects/domain/defaults.ts` —
  per-effect `DEFAULT_EFFECTS_CONFIG` value updates as each effect is locked.

## Verification

- Route compiles: one `npm run check` at the build gate (0 new errors).
- Each locked effect: live HMR render in Clean + Tunnel is the evidence the
  default reads correctly (DevTools screenshot or Austen's eyeball — per the
  verification protocol, a runtime render counts; a prediction does not).
- No change to the user's global effects config (isolated `persist:false`
  config asserts this by construction).

## Risks / notes

- `defaults.ts` edits ship to **new** users on first load; existing users keep
  their `tka_effects_config` in localStorage unless they reset. Acceptable —
  defaults are the cold-start baseline.
- `EFFECTS_CONFIG_VERSION` bump is **not** required for value-only default
  changes (no shape change, no migration). Leave the version unless a param is
  added/removed.
- The harness must not import or mutate the global config singleton — only the
  isolated `persist:false` instance, exactly as `prop-tunnel` does.
