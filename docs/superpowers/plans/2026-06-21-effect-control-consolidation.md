# Effect Control Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One shared per-effect control manifest, rendered by both the 2D customize panels and the 3D viewer popover via a single `EffectControlStack`, with a uniform Primary row + Advanced disclosure per effect.

**Architecture:** A data manifest (`effect-control-manifest.ts`) describes each effect's controls as typed descriptors tagged primary/tracking/advanced. `EffectControlStack.svelte` maps descriptors → existing primitives (inline slider/color patterns centralized here + shared `SegmentedControl`). 2D panels and the 3D popover both mount the stack against the shared `EffectsConfigState`, so editing the manifest changes both.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest. Reuse `SegmentedControl`; centralize the repeated inline slider/color/palette markup (no shared input library exists today).

**Spec:** `docs/superpowers/specs/2026-06-21-effect-control-consolidation-design.md`

## File structure

- Create `src/lib/shared/effects/domain/effect-control-manifest.ts` — descriptor types + `EFFECT_CONTROLS` for all 16 effects + `EFFECTS_WITH_3D_RENDERER`.
- Create `src/lib/shared/effects/components/EffectControlStack.svelte` — descriptor→primitive renderer.
- Create `src/lib/shared/effects/components/controls/` small leaf components only if a control type needs >inline markup (color pair, palette swatches, LED pattern select).
- Modify `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — render the stack; filter chips to renderer-backed; delete local curated knobs.
- Delete `src/lib/shared/3d/components/controls/effect-curated-knobs.ts`.
- Modify `src/lib/shared/animation-engine/components/effects-panel/customize/*Customize.svelte` — render the stack + Advanced disclosure (one effect per task).

---

## Task 1: Descriptor types + manifest (renderer-backed effects first)

**Files:**
- Create: `src/lib/shared/effects/domain/effect-control-manifest.ts`
- Test: `src/lib/shared/effects/domain/effect-control-manifest.test.ts`

- [ ] **Step 1: Write the manifest types + the 4 renderer-backed effects + the emission archetype.**

```ts
import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

export type ControlType =
  | "slider" | "toggle" | "segmented" | "color" | "colorPair" | "palette" | "paletteSwatches" | "ledPattern";
export type ControlTier = "primary" | "tracking" | "advanced";

export interface ControlDescriptor {
  id: string;
  label: string;
  type: ControlType;
  /** Intent field on the effect's config object (the key passed to updateEffect). */
  field: string;
  tier: ControlTier;
  // slider
  min?: number; max?: number; step?: number; pct?: boolean;
  // segmented / select
  options?: { value: string; label: string }[];
  // colorPair: the two fields (e.g. blueColor/redColor)
  pairFields?: [string, string];
  // palette: named options carry a swatch color
  paletteOptions?: { value: string; label: string; swatch: string }[];
  // conditional visibility (e.g. tint only when colorMode === "solid")
  showWhen?: (intent: Record<string, unknown>) => boolean;
}

const TRACK_OPTS = [
  { value: "left_end", label: "Left" },
  { value: "both_ends", label: "Both" },
  { value: "right_end", label: "Right" },
];

export const EFFECT_CONTROLS: Record<EffectId, ControlDescriptor[]> = {
  trails: [
    { id: "trails-color", label: "Color", type: "colorPair", field: "blueColor", pairFields: ["blueColor", "redColor"], tier: "primary" },
    { id: "trails-rainbow", label: "Rainbow", type: "toggle", field: "rainbow", tier: "primary" },
    { id: "trails-brightness", label: "Brightness", type: "slider", field: "brightness", min: 0.3, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "trails-thickness", label: "Thickness", type: "slider", field: "thickness", min: 1, max: 12, step: 1, tier: "primary" },
    { id: "trails-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
  ],
  fire: [
    { id: "fire-color", label: "Color", type: "slider", field: "colorBlend", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "fire-intensity", label: "Intensity", type: "slider", field: "intensity", min: 0.45, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "fire-brightness", label: "Brightness", type: "slider", field: "brightness", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "fire-turbulence", label: "Turbulence", type: "slider", field: "turbulence", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
  ],
  led: [
    { id: "led-palette", label: "Color", type: "color", field: "primaryColor", tier: "primary" },
    { id: "led-brightness", label: "Brightness", type: "slider", field: "brightness", min: 1, max: 5, step: 1, tier: "primary" },
    { id: "led-pattern", label: "Pattern", type: "ledPattern", field: "patternId", tier: "primary" },
    { id: "led-speed", label: "Speed", type: "slider", field: "patternSpeed", min: 0.1, max: 5, step: 0.1, tier: "primary" },
    { id: "led-colormode", label: "Color mode", type: "segmented", field: "colorMode", options: [
      { value: "unified", label: "Unified" }, { value: "per-hand", label: "Per-hand" }, { value: "prop-matched", label: "Prop" },
    ], tier: "advanced" },
  ],
  charcoal: [
    { id: "charcoal-intensity", label: "Intensity", type: "slider", field: "intensity", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "charcoal-spread", label: "Spread", type: "slider", field: "spread", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
    { id: "charcoal-glow", label: "Glow", type: "slider", field: "glow", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
  ],
  // ... remaining effects added in Task 1b (see matrix). Placeholder empty arrays
  // are replaced there; this task ships the 4 renderer-backed effects + types.
  zap: [], sparkles: [], echo: [], bloom: [], water: [], bubbles: [], petals: [],
  smoke: [], ink: [], frost: [], silk: [], pulse: [],
};

/** Effects that have a live 3D renderer — the only ones the 3D viewer lists. */
export const EFFECTS_WITH_3D_RENDERER: ReadonlySet<EffectId> = new Set([
  "trails", "fire", "led", "charcoal",
]);

export function primaryControls(effect: EffectId): ControlDescriptor[] {
  return EFFECT_CONTROLS[effect].filter((c) => c.tier === "primary" || c.tier === "tracking");
}
export function advancedControls(effect: EffectId): ControlDescriptor[] {
  return EFFECT_CONTROLS[effect].filter((c) => c.tier === "advanced");
}
```

- [ ] **Step 2: Write failing test** — every descriptor's `field` exists on the effect's default intent; renderer-backed effects have a non-empty primary row.

```ts
import { describe, it, expect } from "vitest";
import { EFFECT_CONTROLS, EFFECTS_WITH_3D_RENDERER, primaryControls } from "./effect-control-manifest";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

describe("effect-control-manifest", () => {
  it("every descriptor field exists on the effect's default intent", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const intent = (DEFAULT_EFFECTS_CONFIG as Record<string, Record<string, unknown>>)[effect];
      if (!controls.length) continue; // not yet authored
      for (const c of controls) {
        expect(intent, `${effect}.${c.field}`).toHaveProperty(c.field);
        if (c.pairFields) for (const f of c.pairFields) expect(intent).toHaveProperty(f);
      }
    }
  });

  it("renderer-backed effects each expose a primary row", () => {
    for (const effect of EFFECTS_WITH_3D_RENDERER) {
      expect(primaryControls(effect).length, effect).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/shared/effects/domain/effect-control-manifest.test.ts` — expect PASS (fields match the intents from `effects-config.ts`).

- [ ] **Step 4: Commit** `effect-control-manifest.ts` + test with explicit pathspec.

---

## Task 1b: Author remaining 12 effects in the manifest

**Files:** Modify `src/lib/shared/effects/domain/effect-control-manifest.ts`

- [ ] **Step 1:** Replace the empty arrays with descriptors built from the spec matrix + the field inventory. Emission archetype (apply to water/bubbles/petals/smoke/ink/frost), example WATER:

```ts
water: [
  { id: "water-palette", label: "Color", type: "palette", field: "palette", tier: "primary", paletteOptions: [
    { value: "classic", label: "Classic", swatch: "#3a7fd9" }, { value: "mercury", label: "Mercury", swatch: "#c0c0c8" },
    { value: "acid", label: "Acid", swatch: "#7fff00" }, { value: "blood", label: "Blood", swatch: "#b01030" },
    { value: "spirit", label: "Spirit", swatch: "#a0e0ff" }, { value: "custom", label: "Custom", swatch: "#3a7fd9" },
  ] },
  { id: "water-custom", label: "Tint", type: "color", field: "customColor", tier: "primary", showWhen: (i) => i.palette === "custom" },
  { id: "water-intensity", label: "Intensity", type: "slider", field: "intensity", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
  { id: "water-ambient", label: "Ambient", type: "slider", field: "ambientEmission", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
  { id: "water-motion", label: "Motion", type: "slider", field: "motionEmission", min: 0, max: 1, step: 0.05, pct: true, tier: "primary" },
  { id: "water-track", label: "Track", type: "segmented", field: "trackingMode", options: TRACK_OPTS, tier: "tracking" },
  { id: "water-style", label: "Style", type: "segmented", field: "spewStyle", options: [
    { value: "splash", label: "Splash" }, { value: "flow", label: "Flow" }, { value: "mist", label: "Mist" } ], tier: "advanced" },
  { id: "water-clarity", label: "Clarity", type: "slider", field: "clarity", min: 0, max: 1, step: 0.05, pct: true, tier: "advanced" },
  { id: "water-tension", label: "Tension", type: "slider", field: "surfaceTension", min: 0, max: 1, step: 0.05, pct: true, tier: "advanced" },
],
```

Author the remaining effects (zap, sparkles, echo, bloom, bubbles, petals, smoke, ink, frost, silk, pulse) the same way — Primary = the 4 from the matrix, `tier: "tracking"` for trackingMode, everything else `tier: "advanced"`. Palette options + swatches come from `effects-config.ts` union types + the per-palette default colors in `defaults.ts`. Tint fields use `showWhen: (i) => i.palette === "custom"` (or `i.colorMode === "solid"` for sparkles/echo/bloom/pulse).

- [ ] **Step 2: Run** the Task 1 test — still PASS (the field-existence test now covers all 16).

- [ ] **Step 3:** Add a test asserting each effect's primary count is 3–5 (uniform feel):

```ts
it("primary rows are uniformly small (3-5 controls)", () => {
  for (const effect of Object.keys(EFFECT_CONTROLS)) {
    const n = EFFECT_CONTROLS[effect].filter((c) => c.tier === "primary").length;
    if (n === 0) continue;
    expect(n, effect).toBeGreaterThanOrEqual(3);
    expect(n, effect).toBeLessThanOrEqual(5);
  }
});
```

- [ ] **Step 4: Run** test — PASS. **Commit.**

---

## Task 2: EffectControlStack renderer

**Files:**
- Create: `src/lib/shared/effects/components/EffectControlStack.svelte`

- [ ] **Step 1:** Implement the renderer. It iterates descriptors of the requested tiers and renders each via the canonical primitive. Reuse `SegmentedControl`; centralize the inline slider/color/palette markup (the repeated pattern from the 2D panels — there is no shared input component, so this component becomes it).

```svelte
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { EFFECT_CONTROLS, type ControlDescriptor, type ControlTier } from "$lib/shared/effects/domain/effect-control-manifest";

  interface Props {
    effect: EffectId;
    config: EffectsConfigState;
    tiers?: ControlTier[];
  }
  let { effect, config, tiers = ["primary", "tracking"] }: Props = $props();

  const intent = $derived(config.effect(effect) as unknown as Record<string, unknown>);
  const controls = $derived(
    EFFECT_CONTROLS[effect].filter(
      (c) => tiers.includes(c.tier) && (!c.showWhen || c.showWhen(intent)),
    ),
  );

  function get(field: string): unknown { return intent[field]; }
  function set(field: string, value: unknown) { config.updateEffect(effect, { [field]: value } as never); }
  function fmt(c: ControlDescriptor, v: number): string {
    return c.pct ? `${Math.round(v * 100)}%` : Number.isInteger(v) ? `${v}` : v.toFixed(1);
  }
</script>

<div class="control-stack">
  {#each controls as c (c.id)}
    {#if c.type === "slider"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <input type="range" min={c.min} max={c.max} step={c.step}
          value={get(c.field) as number}
          oninput={(e) => set(c.field, parseFloat(e.currentTarget.value))} class="ctl-slider" />
        <span class="ctl-value">{fmt(c, get(c.field) as number)}</span>
      </div>
    {:else if c.type === "segmented"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <SegmentedControl options={c.options!} value={get(c.field) as string}
          onchange={(v) => set(c.field, v)} color="accent" size="sm" />
      </div>
    {:else if c.type === "toggle"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <button class="ctl-toggle" class:on={get(c.field) === true}
          aria-pressed={get(c.field) === true} onclick={() => set(c.field, !(get(c.field) as boolean))}>
          <span class="ctl-toggle-dot"></span>
        </button>
      </div>
    {:else if c.type === "color"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <label class="ctl-color"><input type="color" value={get(c.field) as string}
          oninput={(e) => set(c.field, e.currentTarget.value)} /></label>
      </div>
    {:else if c.type === "colorPair"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <div class="ctl-pair">
          <label class="ctl-color"><input type="color" value={intent[c.pairFields![0]] as string}
            oninput={(e) => set(c.pairFields![0], e.currentTarget.value)} /></label>
          <label class="ctl-color"><input type="color" value={intent[c.pairFields![1]] as string}
            oninput={(e) => set(c.pairFields![1], e.currentTarget.value)} /></label>
        </div>
      </div>
    {:else if c.type === "palette"}
      <div class="ctl-row">
        <span class="ctl-label">{c.label}</span>
        <SegmentedControl
          options={c.paletteOptions!.map((p) => ({ value: p.value, label: p.label }))}
          value={get(c.field) as string} onchange={(v) => set(c.field, v)} color="accent" size="sm" />
      </div>
    {/if}
  {/each}
</div>

<style>
  .control-stack { display: flex; flex-direction: column; gap: 0.6rem; }
  .ctl-row { display: grid; grid-template-columns: 4.5rem 1fr auto; align-items: center; gap: 0.5rem; }
  .ctl-label { font-size: var(--font-size-compact, 0.75rem); color: var(--theme-text-dim); }
  .ctl-slider { width: 100%; height: 6px; appearance: none; background: var(--theme-panel-bg); border-radius: 3px; cursor: pointer; }
  .ctl-slider::-webkit-slider-thumb { appearance: none; width: 18px; height: 18px; background: var(--theme-accent, #4a9eff); border-radius: 50%; cursor: pointer; }
  .ctl-value { font-size: var(--font-size-compact, 0.75rem); color: var(--theme-text); text-align: right; font-variant-numeric: tabular-nums; min-width: 3ch; }
  .ctl-color { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; cursor: pointer; }
  .ctl-color input { width: 150%; height: 150%; margin: -25%; border: none; padding: 0; background: none; cursor: pointer; }
  .ctl-pair { display: flex; gap: 0.4rem; }
  .ctl-toggle { width: 40px; height: 22px; border-radius: 11px; border: 1px solid var(--theme-stroke); background: var(--theme-panel-bg); position: relative; cursor: pointer; }
  .ctl-toggle.on { background: var(--theme-accent, #4a9eff); }
  .ctl-toggle-dot { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left var(--duration-fast, 0.15s); }
  .ctl-toggle.on .ctl-toggle-dot { left: 20px; }
</style>
```

Note: `paletteSwatches` (custom hex array) and `ledPattern` (the bespoke LED category picker) are deferred to Task 2b — they only appear in Advanced and LED primary respectively; primary rows for the renderer-backed effects (fire/trails/charcoal/led-minus-pattern) render with the types above.

- [ ] **Step 2:** `npm run check` — clean. **Commit.**

---

## Task 2b: LED pattern + palette-swatch controls

**Files:**
- Create: `src/lib/shared/effects/components/controls/LedPatternSelect.svelte` (extract the existing picker from `LedPanel.svelte:64-91`)
- Create: `src/lib/shared/effects/components/controls/PaletteSwatches.svelte` (extract from `SparklesCustomize.svelte:124-137`)
- Modify: `EffectControlStack.svelte` to render `ledPattern` → `LedPatternSelect`, `paletteSwatches` → `PaletteSwatches`.

- [ ] **Step 1:** Move the LED pattern picker markup/logic out of `LedPanel.svelte` into `LedPatternSelect.svelte` with props `{ value: string; onchange: (id: string) => void }`. Move the 5-swatch custom palette editor into `PaletteSwatches.svelte` with `{ palette: string[]; onchange: (next: string[]) => void }`.
- [ ] **Step 2:** Wire both into the stack's `{#if}` chain.
- [ ] **Step 3:** `npm run check` clean. **Commit.**

---

## Task 3: 3D viewer renders the stack (fixes trail-color regression)

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`
- Delete: `src/lib/shared/3d/components/controls/effect-curated-knobs.ts`

- [ ] **Step 1:** Replace the curated-knobs block + trails Rainbow/Track mode-chips with `<EffectControlStack effect={activeEffectKey} config={config} />` (primary+tracking) for the active renderer-backed effect, rendered above the chip grid. Add an "Advanced" `<details>` rendering `tiers={["advanced"]}`.
- [ ] **Step 2:** Filter `effectChips` to `EFFECTS_WITH_3D_RENDERER` (+ keep "motion"). Import the set from the manifest. Remove `CURATED_KNOBS`/`formatKnobValue` imports + `effect-curated-knobs.ts`.
- [ ] **Step 3:** Keep the footer (Copy/Save/Reset) as-is.
- [ ] **Step 4:** `npm run check` clean. **Commit.** (DevTools verify in Task 5: trails shows per-hand color, no Rainbow/Solid binary; fire primary row matches 2D.)

---

## Task 4: Migrate 2D panels to the stack (one effect per commit)

**Files:** Modify each `src/lib/shared/animation-engine/components/effects-panel/customize/*Customize.svelte`

- [ ] **Step 1 (Fire reference):** In `FireCustomize.svelte`, replace the `FirePanel` body with `<EffectControlStack effect="fire" {config} />` + an Advanced `<details>` (`tiers={["advanced"]}`). Source `config` from `getEffectsConfigContext()`. Before deleting `FirePanel.svelte`, confirm the rendered controls match (Primary ∪ Advanced == old set).
- [ ] **Step 2:** Repeat per effect: trails, led, charcoal, zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse — one commit each, parity-checked.
- [ ] **Step 3:** After all consumers use the stack, delete the dead `*Panel.svelte` bodies and `effect-primary-param.ts`. **Commit.**

---

## Task 5: Verification

- [ ] DevTools on `/create/generate`: trails active in 3D shows **per-hand color pickers** (prop-matched default), no Rainbow/Solid binary; Fire primary row identical in 2D Lab and 3D popover; dragging any primary slider changes the render.
- [ ] Each migrated 2D effect: control set unchanged vs pre-migration (primary + advanced union).
- [ ] `npx vitest run src/lib/shared/effects` green; `npm run check` clean for touched files; `npm run build:fast` exit 0.

---

## Self-review notes

- Spec coverage: manifest (T1/1b), shared renderer (T2/2b), 3D mirror + chip filter + delete curated (T3), 2D migration + dead-code removal (T4), verify incl. trail-color fix (T5). ✓
- Type consistency: `ControlDescriptor`/`ControlTier`/`EFFECT_CONTROLS`/`EFFECTS_WITH_3D_RENDERER`/`primaryControls`/`advancedControls` used consistently across tasks. ✓
- Reuse: `SegmentedControl` for all single-selects (chip-primitives); inline slider/color centralized in the stack (no shared input lib exists); LED pattern + palette-swatches extracted from existing panels, not rebuilt (never-hand-roll). ✓ No checkboxes — toggle is button + dot (no-checkboxes). ✓
- Charcoal ember-tint Color: deferred from T1 (charcoal ships 3 primaries); add a `color`→`coreColor` descriptor in T1b once the RGB-vs-hex mapping is settled, or leave at 3. Flag at T1b.
