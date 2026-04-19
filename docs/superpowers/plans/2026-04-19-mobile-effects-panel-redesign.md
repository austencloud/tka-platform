# Mobile Effects Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vertical-stack `<EffectsPanel>` in the mobile Effects sub-sheet with a compact horizontal-strips layout (`MobileEffectsPanel`) that fits under 300px while exposing all 10 effects, their presets, a live primary-parameter slider, and a path to full customize — keeping the canvas visible above.

**Architecture:** Extract effect metadata to a shared `effect-registry.ts` (Phase 2 seam). Build a pure-TS `effect-primary-param.ts` adapter that maps each effect id to a getter/setter on `EffectsConfigState`. Build `MobileEffectsPanel.svelte` consuming both. Swap it into `ExportVideoDrawer.svelte`'s Effects sub-sheet. Desktop `EffectsPanel.svelte` and 3D `EffectsSettingsPanel.svelte` are untouched except for importing the shared registry.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest, existing `RailBentoSheet` + `rail-tile.css` primitives, existing `PRESET_GROUP` data, existing `*Customize.svelte` components.

---

### Task 1: Effect Registry

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
- Create: `tests/unit/effect-registry.test.ts`
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` (lines 2-13 — replace inline EFFECTS const with import)
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` (lines 109-133 — replace inline EFFECT_COLORS / EFFECT_LABELS with import)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/effect-registry.test.ts
import { describe, it, expect } from "vitest";
import {
  EFFECTS,
  EFFECT_COLORS,
  EFFECT_LABELS,
  type EffectMeta,
} from "../../src/lib/shared/animation-engine/components/effects-panel/effect-registry";

describe("effect-registry", () => {
  it("has all 10 effects in stable order", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(ids).toEqual([
      "trails", "fire", "led", "charcoal", "zap",
      "sparkles", "echo", "bloom", "water", "bubbles",
    ]);
  });

  it("every entry has id, label, icon, color", () => {
    for (const e of EFFECTS) {
      expect(e.id).toMatch(/^[a-z]+$/);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.icon).toMatch(/^fa-/);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("EFFECT_COLORS maps every effect id to its hex color", () => {
    for (const e of EFFECTS) {
      expect(EFFECT_COLORS[e.id]).toBe(e.color);
    }
  });

  it("EFFECT_LABELS maps every effect id to its display label", () => {
    for (const e of EFFECTS) {
      expect(EFFECT_LABELS[e.id]).toBe(e.label);
    }
  });

  it("effect ids are unique", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("EffectMeta type is re-exported", () => {
    const sample: EffectMeta = EFFECTS[0]!;
    expect(sample.id).toBe("trails");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd E:/tka-platform && npx vitest run tests/unit/effect-registry.test.ts
```

Expected: FAIL — "Cannot find module … effect-registry".

- [ ] **Step 3: Write the registry**

```ts
// src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts
/**
 * Shared effect metadata. Single source of truth for id/label/icon/color
 * across the 2D EffectsPanel (desktop), MobileEffectsPanel, and
 * EffectSelector. Phase 2 will extend EffectMeta with a `modes` field
 * and add the 3D-only Motion entry; for now this is 2D's 10 effects.
 */

export interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
}

export const EFFECTS: readonly EffectMeta[] = [
  { id: "trails",   label: "Trails",  icon: "fa-route",         color: "#60a5fa" },
  { id: "fire",     label: "Fire",    icon: "fa-fire",          color: "#f97316" },
  { id: "led",      label: "LED",     icon: "fa-lightbulb",     color: "#22c55e" },
  { id: "charcoal", label: "Coal",    icon: "fa-diamond",       color: "#a855f7" },
  { id: "zap",      label: "Zap",     icon: "fa-bolt",          color: "#38bdf8" },
  { id: "sparkles", label: "Sparkle", icon: "fa-star",          color: "#fbbf24" },
  { id: "echo",     label: "Echo",    icon: "fa-clone",         color: "#22d3ee" },
  { id: "bloom",    label: "Bloom",   icon: "fa-sun",           color: "#f472b6" },
  { id: "water",    label: "Water",   icon: "fa-droplet",       color: "#3a7fd9" },
  { id: "bubbles",  label: "Bubbles", icon: "fa-circle-notch",  color: "#c8e0ff" },
] as const;

export const EFFECT_COLORS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.color]),
);

export const EFFECT_LABELS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.label]),
);
```

- [ ] **Step 4: Run test — should pass**

```bash
cd E:/tka-platform && npx vitest run tests/unit/effect-registry.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Migrate EffectSelector.svelte to the registry**

In `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte`, replace lines 2–13 (the inline `EFFECTS` const) with:

```ts
  import { EFFECTS } from "./effect-registry";
```

The rest of the file (`getButtonStyle`, the template, styles) stays identical. The registry's `EffectMeta.color` type is `\`#${string}\`` which is assignable to the existing `string` usage in `getButtonStyle`.

- [ ] **Step 6: Migrate EffectsPanel.svelte to the registry**

In `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`, delete lines 109–133 (the two inline maps) and add this import near the top:

```ts
  import { EFFECT_COLORS, EFFECT_LABELS } from "./effect-registry";
```

Everything else stays identical.

- [ ] **Step 7: Type check passes**

```bash
cd E:/tka-platform && npx svelte-check --tsconfig ./tsconfig.json --no-tsconfig 2>&1 | grep -E "(effect-registry|EffectSelector|EffectsPanel)" | head
```

Expected: no new errors.

- [ ] **Step 8: Build passes**

```bash
cd E:/tka-platform && NODE_OPTIONS=--max-old-space-size=8192 npx vite build 2>&1 | tail -20
```

Expected: build completes.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts \
       src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte \
       src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte \
       tests/unit/effect-registry.test.ts
git commit -m "refactor(effects): extract shared effect-registry"
```

---

### Task 2: Primary-Parameter Adapter

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts`
- Create: `tests/unit/effect-primary-param.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/effect-primary-param.test.ts
import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import {
  PRIMARY_PARAMS,
  getPrimaryParam,
  setPrimaryParam,
} from "../../src/lib/shared/animation-engine/components/effects-panel/effect-primary-param";

describe("effect-primary-param", () => {
  it("has an entry for all 10 effects", () => {
    const ids = Object.keys(PRIMARY_PARAMS).sort();
    expect(ids).toEqual([
      "bloom", "bubbles", "charcoal", "echo", "fire",
      "led", "sparkles", "trails", "water", "zap",
    ]);
  });

  it("each entry declares label, min, max, step, format", () => {
    for (const [id, p] of Object.entries(PRIMARY_PARAMS)) {
      expect(p.label.length, `${id} label`).toBeGreaterThan(0);
      expect(typeof p.min).toBe("number");
      expect(typeof p.max).toBe("number");
      expect(p.max).toBeGreaterThan(p.min);
      expect(typeof p.step).toBe("number");
      expect(typeof p.format(p.min)).toBe("string");
    }
  });

  it("Trails thickness round-trips through state (1-12, step 1)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("trails", s, 7);
    expect(getPrimaryParam("trails", s)).toBe(7);
    expect(PRIMARY_PARAMS.trails.min).toBe(1);
    expect(PRIMARY_PARAMS.trails.max).toBe(12);
    expect(PRIMARY_PARAMS.trails.step).toBe(1);
  });

  it("Fire intensity round-trips (0.45-1, step 0.01)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("fire", s, 0.7);
    expect(getPrimaryParam("fire", s)).toBeCloseTo(0.7);
    expect(PRIMARY_PARAMS.fire.min).toBeCloseTo(0.45);
    expect(PRIMARY_PARAMS.fire.max).toBe(1);
    expect(PRIMARY_PARAMS.fire.step).toBe(0.01);
  });

  it("LED brightness round-trips (1-5 integer)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("led", s, 4);
    expect(getPrimaryParam("led", s)).toBe(4);
    expect(PRIMARY_PARAMS.led.step).toBe(1);
  });

  it.each([
    ["charcoal", 0.3],
    ["zap", 0.5],
    ["sparkles", 0.4],
    ["echo", 0.6],
    ["bloom", 0.8],
    ["water", 0.2],
    ["bubbles", 0.55],
  ])("%s primary param round-trips to %f", (id, value) => {
    const s = createEffectsConfigState();
    setPrimaryParam(id, s, value);
    expect(getPrimaryParam(id, s)).toBeCloseTo(value);
  });

  it("unknown effect id throws", () => {
    const s = createEffectsConfigState();
    expect(() => getPrimaryParam("nonexistent", s)).toThrow();
    expect(() => setPrimaryParam("nonexistent", s, 0.5)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd E:/tka-platform && npx vitest run tests/unit/effect-primary-param.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts
/**
 * Primary-parameter adapter for the mobile Effects strips layout.
 *
 * Each effect exposes one dominant scalar that the mobile panel surfaces
 * as a primary slider (beneath the preset strip). The adapter is a pure
 * data structure — no Svelte, no VM. Phase 2 will extend it with a 3D
 * branch once the 3D renderer shares this state.
 *
 * All params map to existing properties on EffectsConfigState
 * (src/lib/shared/effects/domain/EffectsConfig.ts).
 */

type EffectsConfigState = ReturnType<
  typeof import("$lib/shared/effects/state/effects-config-state.svelte").createEffectsConfigState
>;

export interface PrimaryParamSpec {
  /** Short uppercase label shown left of the slider. */
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Renders the current value into the readout on the right. */
  readonly format: (value: number) => string;
  /** Reads the current value from state. */
  readonly get: (state: EffectsConfigState) => number;
  /** Writes the new value via the state's canonical update fn (also clears activePresets[effect]). */
  readonly set: (state: EffectsConfigState, value: number) => void;
}

const fmt2 = (v: number) => v.toFixed(2);
const fmtInt = (v: number) => String(Math.round(v));

export const PRIMARY_PARAMS: Record<string, PrimaryParamSpec> = {
  trails: {
    label: "Thickness",
    min: 1, max: 12, step: 1,
    format: fmtInt,
    get: (s) => s.config.trails.thickness,
    set: (s, v) => s.updateTrails({ thickness: Math.round(v) }),
  },
  fire: {
    label: "Intensity",
    min: 0.45, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.fire.intensity,
    set: (s, v) => s.updateFire({ intensity: v }),
  },
  led: {
    label: "Brightness",
    min: 1, max: 5, step: 1,
    format: fmtInt,
    get: (s) => s.config.led.brightness,
    set: (s, v) => s.updateLed({ brightness: Math.round(v) }),
  },
  charcoal: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.charcoal.intensity,
    set: (s, v) => s.updateCharcoal({ intensity: v }),
  },
  zap: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.zap.intensity,
    set: (s, v) => s.updateZap({ intensity: v }),
  },
  sparkles: {
    label: "Rate",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.sparkles.rate,
    set: (s, v) => s.updateSparkles({ rate: v }),
  },
  echo: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.echo.intensity,
    set: (s, v) => s.updateEcho({ intensity: v }),
  },
  bloom: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.bloom.intensity,
    set: (s, v) => s.updateBloom({ intensity: v }),
  },
  water: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.water.intensity,
    set: (s, v) => s.updateWater({ intensity: v }),
  },
  bubbles: {
    label: "Intensity",
    min: 0, max: 1, step: 0.01,
    format: fmt2,
    get: (s) => s.config.bubbles.intensity,
    set: (s, v) => s.updateBubbles({ intensity: v }),
  },
};

export function getPrimaryParam(effectId: string, state: EffectsConfigState): number {
  const spec = PRIMARY_PARAMS[effectId];
  if (!spec) throw new Error(`No primary param registered for effect "${effectId}"`);
  return spec.get(state);
}

export function setPrimaryParam(
  effectId: string,
  state: EffectsConfigState,
  value: number,
): void {
  const spec = PRIMARY_PARAMS[effectId];
  if (!spec) throw new Error(`No primary param registered for effect "${effectId}"`);
  spec.set(state, value);
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd E:/tka-platform && npx vitest run tests/unit/effect-primary-param.test.ts
```

Expected: all tests pass (approximately 13 assertions).

**If `config` is not a public field on the state object,** inspect `src/lib/shared/effects/state/effects-config-state.svelte.ts` to find the public accessor (the factory file starts at line 49) and adjust the getters accordingly. The setters (`updateTrails`, `updateFire`, …) are confirmed public from direct reading.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts \
       tests/unit/effect-primary-param.test.ts
git commit -m "feat(effects): primary-param adapter for mobile strips layout"
```

---

### Task 3: MobileEffectsPanel — Strips Layout (No Customize Yet)

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte`

- [ ] **Step 1: Write the component (strips only, no More-tuning wiring)**

Mirrors the state-management pattern of `EffectsPanel.svelte` (lines 68–208). Read the existing file first if you haven't. The mobile variant does not mount `TempoControl` or `TransportControls` (those live elsewhere in the bento). It does not render the children snippet (no export controls embedded).

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { EffectType } from "../../domain/types/TipEffectTypes";
  import { EFFECTS, EFFECT_LABELS } from "./effect-registry";
  import { PRIMARY_PARAMS, getPrimaryParam, setPrimaryParam } from "./effect-primary-param";
  import { LED_PRESET_GROUP } from "./presets/led-presets";
  import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
  import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
  import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
  import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
  import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
  import { ECHO_PRESET_GROUP } from "./presets/echo-presets";
  import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
  import { WATER_PRESET_GROUP } from "./presets/water-presets";
  import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
  import type { EffectPresetGroup } from "./presets/types";

  const vm = getAnimationVisibilityManager();
  const effectsConfigState = getEffectsConfigContext();

  const PRESET_STORAGE_KEY = "tka_active_effect_presets";

  function loadPresetMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }

  function savePresetId(effect: string, presetId: string | null): void {
    try {
      const map = loadPresetMap();
      if (presetId) map[effect] = presetId;
      else delete map[effect];
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  let activeEffect = $state<string>(vm.getActiveEffect());
  let activePresetId = $state<string | null>(
    vm.getActiveEffect() === "led" ? vm.getActivePresetId() : null
  );
  let syncTick = $state(0);

  function syncFromVM(): void {
    activeEffect = vm.getActiveEffect();
    if (activeEffect === "led") activePresetId = vm.getActivePresetId();
    syncTick++;
  }

  onMount(() => {
    syncFromVM();
    if (activeEffect !== "none") {
      const saved = loadPresetMap()[activeEffect];
      if (saved) {
        activePresetId = saved;
        handlePresetSelect(saved);
      }
    }
    vm.registerObserver(syncFromVM);
  });

  onDestroy(() => {
    vm.unregisterObserver(syncFromVM);
  });

  function getPresetGroup(effect: string): EffectPresetGroup | null {
    switch (effect) {
      case "led": return LED_PRESET_GROUP;
      case "fire": return FIRE_PRESET_GROUP;
      case "trails": return TRAIL_PRESET_GROUP;
      case "charcoal": return CHARCOAL_PRESET_GROUP;
      case "zap": return ZAP_PRESET_GROUP;
      case "sparkles": return SPARKLES_PRESET_GROUP;
      case "echo": return ECHO_PRESET_GROUP;
      case "bloom": return BLOOM_PRESET_GROUP;
      case "water": return WATER_PRESET_GROUP;
      case "bubbles": return BUBBLES_PRESET_GROUP;
      default: return null;
    }
  }

  function handleEffectSelect(effectId: string): void {
    if (effectId === activeEffect) {
      vm.setActiveEffect("none" as EffectType);
      activeEffect = "none";
      activePresetId = null;
      return;
    }
    vm.setActiveEffect(effectId as EffectType);
    activeEffect = effectId;
    activePresetId = null;
  }

  function handlePresetSelect(presetId: string): void {
    const group = getPresetGroup(activeEffect);
    if (!group) return;
    const preset = group.presets.find((p) => p.id === presetId);
    if (!preset) return;
    preset.apply(vm, effectsConfigState);
    activePresetId = presetId;
    savePresetId(activeEffect, presetId);
  }

  const primarySpec = $derived(
    activeEffect !== "none" ? PRIMARY_PARAMS[activeEffect] ?? null : null
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  const primaryValue = $derived.by(() => {
    syncTick; // read tick so this recomputes after VM observer fires
    if (!primarySpec || !effectsConfigState) return 0;
    return getPrimaryParam(activeEffect, effectsConfigState);
  });

  function handleSliderInput(ev: Event) {
    if (!primarySpec || !effectsConfigState) return;
    const v = parseFloat((ev.currentTarget as HTMLInputElement).value);
    setPrimaryParam(activeEffect, effectsConfigState, v);
    syncTick++;
  }
</script>

<div class="mep">
  <!-- Row 1: Effect tile strip -->
  <div class="fx-strip" role="radiogroup" aria-label="Select effect">
    {#each EFFECTS as e (e.id)}
      {@const isActive = activeEffect === e.id}
      <button
        type="button"
        class="fx-tile"
        class:active={isActive}
        role="radio"
        aria-checked={isActive}
        aria-label={e.label}
        style:--fx={e.color}
        onclick={() => handleEffectSelect(e.id)}
      >
        <i class="fas {e.icon}" aria-hidden="true"></i>
        <span>{e.label}</span>
        {#if isActive}<span class="dot" aria-hidden="true"></span>{/if}
      </button>
    {/each}
  </div>

  {#if activeEffect !== "none"}
    {@const group = getPresetGroup(activeEffect)}

    <!-- Row 2: Preset chips -->
    {#if group}
      <div class="preset-strip" role="radiogroup" aria-label="{EFFECT_LABELS[activeEffect] ?? activeEffect} presets">
        {#each group.presets as preset (preset.id)}
          {@const isActive = activePresetId === preset.id}
          <button
            type="button"
            class="preset-chip"
            class:active={isActive}
            role="radio"
            aria-checked={isActive}
            onclick={() => handlePresetSelect(preset.id)}
          >
            {#if preset.previewColor === "rainbow"}
              <span class="swatch rainbow" aria-hidden="true"></span>
            {:else}
              <span class="swatch" style:background={preset.previewColor} aria-hidden="true"></span>
            {/if}
            {preset.name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Row 3: Primary slider -->
    {#if primarySpec}
      <div class="slider-row">
        <span class="slider-label">{primarySpec.label}</span>
        <input
          type="range"
          class="slider"
          min={primarySpec.min}
          max={primarySpec.max}
          step={primarySpec.step}
          value={primaryValue}
          oninput={handleSliderInput}
          aria-label="{primarySpec.label} for {EFFECT_LABELS[activeEffect] ?? activeEffect}"
        />
        <span class="slider-val">{primarySpec.format(primaryValue)}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .mep {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .fx-strip,
  .preset-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .fx-strip::-webkit-scrollbar,
  .preset-strip::-webkit-scrollbar { display: none; }

  .fx-tile {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.65);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .fx-tile i { font-size: 18px; line-height: 1; }
  .fx-tile.active {
    background: color-mix(in srgb, var(--fx) 22%, rgba(20, 22, 32, 0.6));
    border-color: color-mix(in srgb, var(--fx) 55%, transparent);
    color: var(--fx);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--fx) 30%, transparent);
  }
  .fx-tile .dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fx);
    box-shadow: 0 0 6px var(--fx);
  }

  .preset-chip {
    flex-shrink: 0;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .preset-chip.active {
    background: color-mix(in srgb, #4a9eff 18%, rgba(20, 22, 32, 0.6));
    border-color: color-mix(in srgb, #4a9eff 45%, transparent);
    color: #c5ddff;
  }
  .preset-chip .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .preset-chip .swatch.rainbow {
    background: conic-gradient(
      from 0deg,
      #ef4444, #f59e0b, #eab308, #22c55e,
      #06b6d4, #3b82f6, #8b5cf6, #ef4444
    );
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }
  .slider-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    width: 72px;
    flex-shrink: 0;
  }
  .slider {
    flex: 1;
    height: 22px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(
      to right,
      #4a9eff 0%,
      #4a9eff var(--val, 50%),
      rgba(255, 255, 255, 0.08) var(--val, 50%),
      rgba(255, 255, 255, 0.08) 100%
    );
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
  }
  .slider::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: #4a9eff;
  }
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider-val {
    font-size: 11px;
    font-weight: 700;
    color: #c5ddff;
    min-width: 44px;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .fx-tile,
    .preset-chip { transition: none; }
  }
</style>
```

- [ ] **Step 2: Type check**

```bash
cd E:/tka-platform && npx svelte-check --tsconfig ./tsconfig.json --no-tsconfig 2>&1 | grep "MobileEffectsPanel"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte
git commit -m "feat(effects): MobileEffectsPanel strips layout"
```

---

### Task 4: More-Tuning Mode

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte`

- [ ] **Step 1: Add customizeOpen state and header reporting**

Near the other `$state` declarations:

```ts
  let customizeOpen = $state(false);
```

The sheet header lives in `RailBentoSheet` (parent). For Phase 1 we surface the back affordance **inside** the panel body, because the parent sheet's header shows a static "Effects" title. Add a top-of-body back row that appears only when `customizeOpen` is true.

Replace the root template `<div class="mep">…</div>` with:

```svelte
<div class="mep">
  {#if customizeOpen}
    <button
      type="button"
      class="back-row"
      onclick={() => (customizeOpen = false)}
      aria-label="Back to effect presets"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      <span class="back-row-title">
        <span class="back-row-label">{EFFECT_LABELS[activeEffect] ?? activeEffect}</span>
        <span class="back-row-sub">More tuning</span>
      </span>
    </button>

    <!-- Customize component slot — see Step 2 -->
    {@render customizeSlot()}
  {:else}
    <!-- Row 1/2/3 as before (fx-strip, preset-strip, slider-row) -->
    ... existing strips template ...

    <!-- Row 4: More tuning button (only when an effect is active) -->
    {#if activeEffect !== "none" && primarySpec}
      <button
        type="button"
        class="more-btn"
        onclick={() => (customizeOpen = true)}
      >
        <span>More tuning…</span>
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    {/if}
  {/if}
</div>
```

- [ ] **Step 2: Add Customize component imports + snippet**

Import every Customize component:

```ts
  import LedCustomize from "./customize/LedCustomize.svelte";
  import FireCustomize from "./customize/FireCustomize.svelte";
  import TrailCustomize from "./customize/TrailCustomize.svelte";
  import CharcoalCustomize from "./customize/CharcoalCustomize.svelte";
  import ZapCustomize from "./customize/ZapCustomize.svelte";
  import SparklesCustomize from "./customize/SparklesCustomize.svelte";
  import EchoCustomize from "./customize/EchoCustomize.svelte";
  import BloomCustomize from "./customize/BloomCustomize.svelte";
  import WaterCustomize from "./customize/WaterCustomize.svelte";
  import BubblesCustomize from "./customize/BubblesCustomize.svelte";
```

Define the snippet at the bottom of the `<script>` block (Svelte 5 snippets can be defined in markup too — use whichever fits):

```svelte
{#snippet customizeSlot()}
  {#if activeEffect === "led"}
    <LedCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "fire"}
    <FireCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "trails"}
    <TrailCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "charcoal"}
    <CharcoalCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "zap"}
    <ZapCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "sparkles"}
    <SparklesCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "echo"}
    <EchoCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "bloom"}
    <BloomCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "water"}
    <WaterCustomize onBack={() => (customizeOpen = false)} />
  {:else if activeEffect === "bubbles"}
    <BubblesCustomize onBack={() => (customizeOpen = false)} />
  {/if}
{/snippet}
```

- [ ] **Step 3: Reset `customizeOpen` when activeEffect changes to "none"**

Modify `handleEffectSelect`:

```ts
  function handleEffectSelect(effectId: string): void {
    customizeOpen = false; // new line
    if (effectId === activeEffect) {
      ...
    }
    ...
  }
```

- [ ] **Step 4: Add `.back-row` + `.more-btn` styles**

Append to `<style>`:

```css
  .more-btn {
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 150ms ease;
  }
  .more-btn:hover { background: rgba(255, 255, 255, 0.07); }

  .back-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.75);
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .back-row i { width: 20px; text-align: center; }
  .back-row-title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }
  .back-row-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .back-row-sub {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(74, 158, 255, 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .more-btn, .back-row { transition: none; }
  }
```

- [ ] **Step 5: Type check**

```bash
cd E:/tka-platform && npx svelte-check --tsconfig ./tsconfig.json --no-tsconfig 2>&1 | grep "MobileEffectsPanel"
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte
git commit -m "feat(effects): MobileEffectsPanel more-tuning mode"
```

---

### Task 5: Swap Into ExportVideoDrawer

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

- [ ] **Step 1: Locate the Effects sub-sheet**

```bash
cd E:/tka-platform && grep -n "EffectsPanel\|openSheet.*effects\|title=\"Effects\"" src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
```

- [ ] **Step 2: Replace the import and the usage**

At the top of the `<script>`:

```ts
  // before:
  // import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  // after:
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
```

In the template, find the Effects sub-sheet block. Replace `<EffectsPanel {bpm} {onBpmChange} {isPlaying} … />` with `<MobileEffectsPanel />`. MobileEffectsPanel takes **no props** — it reads everything from context / VM. Remove any binding.

- [ ] **Step 3: Type check**

```bash
cd E:/tka-platform && npx svelte-check --tsconfig ./tsconfig.json --no-tsconfig 2>&1 | grep "ExportVideoDrawer"
```

Expected: no new errors. If svelte-check flags unused `bpm`/`onBpmChange`/`isPlaying` imports elsewhere in the file, leave them — they're still used by Playback and Tempo sub-sheets.

- [ ] **Step 4: Build**

```bash
cd E:/tka-platform && NODE_OPTIONS=--max-old-space-size=8192 npx vite build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "feat(viewer): mobile Effects sub-sheet uses MobileEffectsPanel"
```

---

### Task 6: Visual Smoke (Manual, with Screenshot Evidence)

- [ ] **Step 1: Confirm dev server is up**

```bash
cd E:/tka-platform && curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

Expected: `200`. If not, tell the user to start their VS Code dev server (per project CLAUDE.md, port 5173 is user-managed).

- [ ] **Step 2: Open sequence viewer on iPhone SE emulation via Chrome DevTools MCP**

Follow `feedback_use_devtools.md` — use MCP tools, not ask-user-to-verify.

1. Launch Chrome if needed.
2. `new_page` on a viewer URL with a known sequence loaded.
3. `emulate` iPhone SE (375×667).
4. `take_screenshot` of the baseline.
5. Open the bento, tap Effects.
6. `take_screenshot` — verify canvas visible above the sheet.
7. Tap Trails tile, `take_screenshot` — preset strip + slider + More-tuning visible.
8. Tap a preset, `take_screenshot` — preset active, slider value shifts.
9. Drag the slider, `take_screenshot` — canvas updates.
10. Tap More tuning, `take_screenshot` — TrailCustomize renders in place; back affordance visible.
11. Tap the back-row, `take_screenshot` — strips view restored, active effect still Trails.
12. Tap the active Trails tile, `take_screenshot` — tile turns off; strips 2/3/4 hide.

- [ ] **Step 3: If any screenshot reveals a bug, fix and re-capture**

Common bugs to watch for:
- Slider `--val` custom property not set (Chrome track won't fill progressively without the `::-moz-range-progress` equivalent — safe to ignore; Firefox-only cosmetic).
- `config` accessor on state object named differently than assumed → primary-param adapter throws → fix in Task 2's file.
- Customize component inner back button + outer back-row both visible → acceptable for Phase 1 per spec.

- [ ] **Step 4: Commit screenshots to the plan doc's /evidence dir (optional)**

Skip if no bugs found. If any fixes landed, commit them.

---

### Task 7: Cleanup & Verification

- [ ] **Step 1: Run all unit tests**

```bash
cd E:/tka-platform && npx vitest run tests/unit/effect-registry.test.ts tests/unit/effect-primary-param.test.ts tests/unit/bento/columns-stepper.test.ts
```

Expected: all pass.

- [ ] **Step 2: Full type check**

```bash
cd E:/tka-platform && NODE_OPTIONS=--max-old-space-size=8192 npx svelte-check --tsconfig ./tsconfig.json --no-tsconfig 2>&1 | tail -30
```

Expected: no new errors attributable to this work (4 pre-existing unrelated errors from earlier scope are fine).

- [ ] **Step 3: Full build**

```bash
cd E:/tka-platform && NODE_OPTIONS=--max-old-space-size=8192 npx vite build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Final review of MobileEffectsPanel.svelte**

Read the file top to bottom. Confirm:
- No 2D-specific assumptions that would block Phase 2 (all effect data flows through registry + adapter + PRESET_GROUP).
- No hard-coded effect ids in the template — the `{#each EFFECTS}` and the `getPresetGroup` switch are the only mentions, and both are data-driven in an acceptable way for Phase 1 (switch is a temporary dispatcher Phase 2 replaces with a registry lookup).
- Back-row + More-tuning button don't leak outside the sheet.

- [ ] **Step 5: Final commit (if any fixes in step 4)**

```bash
git status
# if anything changed:
git add <files>
git commit -m "chore(effects): polish pass after mobile strips redesign"
```

---

## Summary

After all 7 tasks:

- `effect-registry.ts` is the single source for effect metadata (Phase 2 seam #1 established).
- `effect-primary-param.ts` is the pure-TS adapter for the dominant scalar per effect (Phase 2 seam #2 established).
- `MobileEffectsPanel.svelte` renders the compact strips layout with preset chips, live primary slider, and More-tuning modal using existing `*Customize.svelte` components (no duplicate code).
- `ExportVideoDrawer.svelte`'s mobile Effects sub-sheet uses the new panel.
- Desktop `EffectsPanel.svelte` and 3D `EffectsSettingsPanel.svelte` are untouched (beyond registry imports).
- All paths to Phase 2 (unified effects engine) are clear and un-muddied.
