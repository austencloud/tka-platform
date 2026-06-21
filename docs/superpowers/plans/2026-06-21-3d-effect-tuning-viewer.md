# 3D Effect Tuning in the Viewer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Curated per-effect sliders + Copy Diagnostic + Save Defaults, expanded inline in the 3D viewer FX popover, with the 3D renderers actually consuming the tuned config — taming fire in the process.

**Architecture:** Wire the existing `EffectsConfig` intent → `resolve*3D()` translator → a new `updateConfig()` on each 3D renderer (dirty-checked in `EffectOrchestrator3D`). Surface curated knobs in `EffectsSettingsPanel.svelte` bound to `config.updateEffect(...)`. Add a baseline snapshot to the config state for Save Defaults / Reset. Reuse the `DiagnosticPanel` clipboard pattern and the existing range-slider CSS — no new primitives.

**Tech Stack:** Svelte 5 runes, Three.js/Threlte, Vitest, TypeScript.

**Scope:** 5 effects with live 3D renderers — Trails (already config-driven), Fire, LED, Charcoal, POV/LED-strip. The 10 effects with no 3D renderer get no panel.

**Spec:** `docs/superpowers/specs/2026-06-21-3d-effect-tuning-viewer-design.md`

**Curated knob → field map:**

| Effect | Knob | Intent field | 3D param it drives |
|--------|------|--------------|--------------------|
| Fire | Intensity | `fire.intensity` | emissionRate / volumetricDensity |
| Fire | Brightness | `fire.brightness` *(NEW)* | material `uEmissiveHot` (blowout lever) |
| Fire | Turbulence | `fire.turbulence` | curl/vortexStrength |
| Fire | Color | `fire.colorBlend` | preset blend (Natural↔Colored) |
| Trails | Thickness | `trails.thickness` | tubeRadius |
| Trails | Brightness | `trails.brightness` | emissive |
| Trails | Rainbow | `trails.rainbow` | rainbow toggle |
| LED | Brightness | `led.brightness` | material brightness uniform |
| LED | Pattern | `led.patternId` | pattern |
| LED | Speed | `led.patternSpeed` | pattern speed |
| Charcoal | Intensity | `charcoal.intensity` | emit rate |
| Charcoal | Spread | `charcoal.spread` | spawn spread |
| Charcoal | Glow | `charcoal.glow` | particleLifetime / material glow |
| POV | Brightness | `led.brightness` | material brightness |
| POV | Persistence | `led` (povPersistenceDuration via resolveLed3D) | strip persistence |

---

## Task 1: Add `fire.brightness` intent field

**Files:**
- Modify: `src/lib/shared/effects/domain/effects-config.ts` (FireIntent type + `EFFECTS_CONFIG_VERSION`)
- Modify: `src/lib/shared/effects/domain/defaults.ts:19-26` (fire default)
- Modify: `src/lib/shared/effects/domain/migrations.ts` (add migration step injecting `brightness`)
- Test: `src/lib/shared/effects/domain/migrations.test.ts` (or co-located existing test file)

- [ ] **Step 1: Read** `effects-config.ts` to find `FireIntent` and `EFFECTS_CONFIG_VERSION` (currently 21), and `migrations.ts` to learn the version-step pattern.

- [ ] **Step 2: Write failing test** — a config at the pre-bump version with no `fire.brightness` migrates to include `brightness` at the default.

```ts
import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "./migrations";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

describe("fire.brightness migration", () => {
  it("injects fire.brightness default when absent", () => {
    const legacy = { ...structuredClone(DEFAULT_EFFECTS_CONFIG), version: 21 } as any;
    delete legacy.fire.brightness;
    const out = migrateEffectsConfig(legacy);
    expect(out.fire.brightness).toBe(DEFAULT_EFFECTS_CONFIG.fire.brightness);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/shared/effects/domain/migrations.test.ts` — expect FAIL.

- [ ] **Step 4: Implement** — in `effects-config.ts` add `brightness: number;` to `FireIntent`, bump `EFFECTS_CONFIG_VERSION` to 22. In `defaults.ts` add `brightness: 1.0` to the `fire` block. In `migrations.ts` add a v21→v22 step that sets `fire.brightness ??= 1.0` (follow the existing step shape). 1.0 maps to the current material default; the blowout fix comes from the user dragging it down + the resolve mapping in Task 2.

- [ ] **Step 5: Run** the test — expect PASS. Run `npm run check` for type fallout from the new required field.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/domain/effects-config.ts src/lib/shared/effects/domain/defaults.ts src/lib/shared/effects/domain/migrations.ts src/lib/shared/effects/domain/migrations.test.ts
git commit -m "feat(effects): add fire.brightness intent field (v22)" -- src/lib/shared/effects/domain/effects-config.ts src/lib/shared/effects/domain/defaults.ts src/lib/shared/effects/domain/migrations.ts src/lib/shared/effects/domain/migrations.test.ts
```

---

## Task 2: Map Fire intent → 3D params (brightness → emissive)

**Files:**
- Modify: `src/lib/shared/effects/translators/webgl3d-types.ts` (add `emissiveHot` to `Fire3DParams`)
- Modify: `src/lib/shared/effects/translators/webgl3d-translator.ts:54-68` (`resolveFire3D`)
- Test: `src/lib/shared/effects/translators/webgl3d-translator.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveFire3D } from "./webgl3d-translator";

const base = { intensity: 0.7, brightness: 1.0, colorBlend: 0.5, turbulence: 0.5,
  colorCurve: null, propColors: null, customColors: null } as any;

describe("resolveFire3D", () => {
  it("maps brightness to emissiveHot", () => {
    expect(resolveFire3D({ ...base, brightness: 0 }).emissiveHot).toBeLessThan(
      resolveFire3D({ ...base, brightness: 1 }).emissiveHot,
    );
  });
  it("low brightness tames the core below the bloom-blowout zone", () => {
    expect(resolveFire3D({ ...base, brightness: 0.4 }).emissiveHot).toBeLessThanOrEqual(1.6);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run .../webgl3d-translator.test.ts` — expect FAIL.

- [ ] **Step 3: Implement** — add `emissiveHot: number;` to `Fire3DParams` in `webgl3d-types.ts`. In `resolveFire3D` defaults add: `emissiveHot: 0.6 + intent.brightness * 1.4,` (brightness 0→0.6 faint, 1→2.0 hot, 0.4→1.16 tamed). Keep existing `emissionRate`/`vortexStrength` mappings.

- [ ] **Step 4: Run** test — expect PASS.

- [ ] **Step 5: Commit** (`webgl3d-types.ts`, `webgl3d-translator.ts`, test) with explicit pathspec.

---

## Task 3: `FireRenderer3D.updateConfig()` consumes params

**Files:**
- Modify: `src/lib/shared/3d/effects/fire/fire-renderer-3d.ts`
- Modify: `src/lib/shared/3d/effects/fire/fire-particle-material-3d.ts` (runtime emissive setter)

- [ ] **Step 1:** In `fire-particle-material-3d.ts` add a setter beside `applyFireParticleColors`:

```ts
export function setFireEmissive(material: ShaderMaterial, emissiveHot: number): void {
  (material.uniforms.uEmissiveHot!.value as number) = emissiveHot;
  // uniforms hold primitives by value; assign directly:
  material.uniforms.uEmissiveHot!.value = emissiveHot;
}
```

- [ ] **Step 2:** In `fire-renderer-3d.ts` convert the hardcoded `EMIT_RATE[tier]`, `CURL_STRENGTH`, and emissive into mutable instance fields seeded in the constructor (keep the const maps as the seed source). Add:

```ts
import { setFireEmissive } from "./fire-particle-material-3d";
import type { Fire3DParams } from "$lib/shared/effects/translators/webgl3d-types";

// instance fields
private emitRate: number;          // seeded = EMIT_RATE[tier]
private curlStrength = CURL_STRENGTH;
private emissiveHot = 1.6;

updateConfig(params: Fire3DParams): void {
  // intensity already raises emissionRate in the translator; scale the wick rate
  // by it so the idle flame body responds too.
  this.emitRate = EMIT_RATE[this.qualityTier] * (0.4 + params.intensity * 1.2);
  this.curlStrength = CURL_STRENGTH * (0.4 + params.turbulence * 1.6);
  this.emissiveHot = params.emissiveHot;
  if (this.material) setFireEmissive(this.material, this.emissiveHot);
  if (params.preset) this.setPreset(params.preset as FireColorPreset); // colorBlend→preset upstream
}
```

Replace `EMIT_RATE[this.qualityTier]` at line ~324 with `this.emitRate`, and `CURL_STRENGTH` at lines ~260-261 with `this.curlStrength`. Apply `emissiveHot` at material creation in `initialize()` too: `createFireParticleMaterial({ colors: getFireColors(this.preset), emissiveHot: this.emissiveHot })`.

- [ ] **Step 3:** `npm run check` — type clean. (Renderer behavior verified via DevTools in Task 10; no unit test for GPU draw.)

- [ ] **Step 4: Commit** (`fire-renderer-3d.ts`, `fire-particle-material-3d.ts`).

---

## Task 4: Orchestrator pushes Fire config (dirty-checked)

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` (~L639-648 fire region + per-frame update)

- [ ] **Step 1: Read** the fire instantiation + update region.

- [ ] **Step 2: Implement** — after `fireRenderer.initialize(...)`, resolve and push on change:

```ts
// reactive — recompute only when fire intent changes
const fireParams = $derived(resolveFire3D(effectsState.fire));
$effect(() => {
  if (fireRenderer) fireRenderer.updateConfig(fireParams);
});
```

(Match the file's existing reactivity idiom; if it's imperative-per-frame, gate with a `prevFireVersion` dirty-check instead of `$effect`.) Import `resolveFire3D` from the translator.

- [ ] **Step 3:** `npm run check`. Commit (`EffectOrchestrator3D.svelte`).

---

## Task 5: Baseline store (Save Defaults / Reset)

**Files:**
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- Test: `effects-config-state.test.ts` (co-located)

- [ ] **Step 1: Write failing test**

```ts
it("saveAsBaseline + resetToBaseline round-trips", () => {
  const s = createEffectsConfigState(undefined, { persist: false });
  s.updateEffect("fire", { brightness: 0.3 });
  s.saveAsBaseline();
  s.updateEffect("fire", { brightness: 0.9 });
  s.resetToBaseline();
  expect(s.fire.brightness).toBe(0.3);
});
it("resetToBaseline with no baseline returns to factory", () => {
  const s = createEffectsConfigState(undefined, { persist: false });
  s.updateEffect("fire", { brightness: 0.1 });
  s.resetToBaseline();
  expect(s.fire.brightness).toBe(DEFAULT_EFFECTS_CONFIG.fire.brightness);
});
```

- [ ] **Step 2: Run** — expect FAIL.

- [ ] **Step 3: Implement** — add a `BASELINE_KEY = "tka_effects_baseline"`. Add `saveAsBaseline()` (writes `structuredClone(config)` to that key when `persist`, else an in-memory field) and `resetToBaseline()` (loads baseline or `DEFAULT_EFFECTS_CONFIG` via the existing `replace()`/clone path + `scheduleSave()`). Export both in the returned object.

```ts
let baselineMem: EffectsConfig | null = null;
function saveAsBaseline() {
  const snap = structuredClone(config);
  baselineMem = snap;
  if (persist && typeof window !== "undefined") {
    try { localStorage.setItem(BASELINE_KEY, JSON.stringify(snap)); } catch {}
  }
}
function resetToBaseline() {
  let next = baselineMem;
  if (!next && persist && typeof window !== "undefined") {
    try { const raw = localStorage.getItem(BASELINE_KEY); if (raw) next = migrateEffectsConfig(JSON.parse(raw)); } catch {}
  }
  replace(next ?? structuredClone(DEFAULT_EFFECTS_CONFIG));
}
```

- [ ] **Step 4: Run** — expect PASS. Commit.

---

## Task 6: Curated sliders + footer in the FX popover

**Files:**
- Create: `src/lib/shared/3d/components/controls/effect-curated-knobs.ts` (per-effect knob spec)
- Modify: `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`

- [ ] **Step 1:** Create `effect-curated-knobs.ts` — a data table the panel maps over. Each knob = `{ label, field, min, max, step, format }`. Only `fire`/`trails`/`led`/`charcoal` have entries (POV folds into led when the strip is active). Rainbow stays a toggle, not a slider.

```ts
import type { EffectId } from "$lib/shared/effects/state/effects-config-state.svelte";
export interface CuratedKnob { label: string; field: string; min: number; max: number; step: number; pct?: boolean; }
export const CURATED_KNOBS: Partial<Record<EffectId, CuratedKnob[]>> = {
  fire: [
    { label: "Intensity",  field: "intensity",  min: 0, max: 1, step: 0.05, pct: true },
    { label: "Brightness", field: "brightness", min: 0, max: 1, step: 0.05, pct: true },
    { label: "Turbulence", field: "turbulence", min: 0, max: 1, step: 0.05, pct: true },
    { label: "Color",      field: "colorBlend", min: 0, max: 1, step: 0.05, pct: true },
  ],
  trails: [
    { label: "Thickness",  field: "thickness",  min: 1, max: 10, step: 0.5 },
    { label: "Brightness", field: "brightness", min: 0, max: 2, step: 0.05 },
  ],
  led: [
    { label: "Brightness", field: "brightness", min: 1, max: 5, step: 0.25 },
    { label: "Speed",      field: "patternSpeed", min: 0, max: 3, step: 0.1 },
  ],
  charcoal: [
    { label: "Intensity",  field: "intensity",  min: 0, max: 1, step: 0.05, pct: true },
    { label: "Spread",     field: "spread",     min: 0, max: 1, step: 0.05, pct: true },
    { label: "Glow",       field: "glow",       min: 0, max: 1, step: 0.05, pct: true },
  ],
};
```

- [ ] **Step 2:** In `EffectsSettingsPanel.svelte`, replace the single `intensity-control` block (lines ~236-253) with a curated block: when `expandedEffect` has `CURATED_KNOBS[expandedEffect]`, render one `.knob-row` per knob — label, `<input type="range">` (reuse `.intensity-slider` CSS), and a `tabular-nums` value `<span>` (no-layout-shift rule). Each `oninput` calls `config.updateEffect(expandedEffect, { [knob.field]: value })`. Keep the existing Trails Rainbow/Track mode-chips. Effects without an entry (`zap` etc.) show nothing on expand.

- [ ] **Step 3:** Add the footer (after the chips grid, global scope only): three buttons reusing the `DiagnosticPanel` copy state-machine for Copy Diagnostic; Save Defaults → `config.saveAsBaseline()`; Reset → `config.resetToBaseline()`. Read `src/lib/features/lab/tabs/collision-lab/components/DiagnosticPanel.svelte:26-42` for the `idle→copied/failed` pattern. Copy serializes the tunable intents:

```ts
async function copyDiagnostic() {
  const { trails, fire, led, charcoal } = config.config;
  const json = JSON.stringify({ trails, fire, led, charcoal }, null, 2);
  try { await navigator.clipboard.writeText(json); copyStatus = "copied"; }
  catch { console.log("[3d-effect-tuning]", json); copyStatus = "failed"; }
  /* 2.5s reset timer */
}
```

Size the Copy button to its widest label ("Copy Diagnostic"/"Copied"/"Copy failed") so it doesn't reflow neighbors (no-layout-shift).

- [ ] **Step 4:** `npm run check`. Commit (`effect-curated-knobs.ts`, `EffectsSettingsPanel.svelte`).

---

## Task 7: Replicate the seam — Charcoal, LED, POV

**Files:**
- Modify: `src/lib/shared/3d/effects/charcoal/charcoal-renderer-3d.ts`
- Modify: `src/lib/shared/3d/effects/led/led-renderer-3d.ts`
- Modify: `src/lib/shared/3d/effects/poi/pov-strip-renderer-3d.ts`
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

- [ ] **Step 1: Charcoal** — add `updateConfig(params: Charcoal3DParams)` mutating emit-rate (intensity), spawn spread (spread), particleLifetime + material glow (glow). Replace the matching hardcoded constants with the instance fields. Orchestrator: `resolveCharcoal3D(effectsState.charcoal)` pushed like fire.

- [ ] **Step 2: LED** — it already takes material options; add `updateConfig(params: Led3DParams)` calling the existing `updateMaterialUniforms` for brightness and storing patternSpeed; orchestrator pushes `resolveLed3D(effectsState.led)`.

- [ ] **Step 3: POV strip** — add `updateConfig` wrapping `setPersistenceDuration(params.povPersistenceDuration)` + material brightness; orchestrator pushes the same `resolveLed3D` result when the strip is the active LED mode.

- [ ] **Step 4:** `npm run check`. Commit each renderer with its own pathspec (or one commit listing all four files).

---

## Task 8: Trails panel (renderer already config-driven)

**Files:**
- Modify: `EffectsSettingsPanel.svelte` (already covered by Task 6's CURATED_KNOBS.trails)

- [ ] **Step 1:** Confirm `TrailRenderer3D` reflects `thickness`/`brightness`/`rainbow` changes live (it consumes `Partial<TrailRendererConfig>`; verify the orchestrator already pushes config — `resolveTrails3D` is `✅ Used`). If the orchestrator does NOT re-push on intent change, add the same `$derived`+`$effect` push as fire. Commit if changed.

---

## Task 9: Verify no-renderer chips' behavior

- [ ] **Step 1:** In the running app, toggle Water (a no-3D-renderer effect) in the 3D viewer and observe: nothing renders / 2D fallback / console. Capture the finding (DevTools console + screenshot).
- [ ] **Step 2:** Add one line to the spec's "Known gap" section recording the observed behavior. No code change unless it errors. Commit the spec note.

---

## Task 10: End-to-end verification

- [ ] **Step 1:** Dev server on :5173 (user's). Open `/create/generate`, set Fire on all performers.
- [ ] **Step 2:** Screenshot the blown-out baseline. Drag Fire Brightness down. Screenshot again — blowout gone (before/after).
- [ ] **Step 3:** `mcp__chrome-devtools__evaluate_script` to read the fire material `uEmissiveHot` uniform reflects the slider.
- [ ] **Step 4:** Click Copy Diagnostic → confirm clipboard holds valid JSON (paste/log). Save Defaults → reload → values persist. Change → Reset → returns to baseline.
- [ ] **Step 5:** Final `npm run check` clean + `npm run build:fast` green.
- [ ] **Step 6:** Final commit if any verification fixups.

---

## Self-review notes

- Spec coverage: all 6 spec components mapped (seam=T3/T7, orchestrator=T4/T7, curated UI=T6/T8, footer=T6, baseline=T5, fire field=T1/T2). ✓
- The `brightness` field name is consistent across T1/T2/T6 (`fire.brightness`). Trails/LED already have `brightness`. ✓
- No new slider primitive — reuse `.intensity-slider` CSS + bare range input (never-hand-roll). Rainbow = toggle button, no checkbox (no-checkboxes). Copy button width pinned (no-layout-shift). ✓
- Don't reconstruct renderers on tune — mutate fields (avoids pool realloc). ✓
