# Tunnel View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tunnel" sub-mode to the 2D animation pane that overlays rotated/mirrored copies of the open sequence into a live kaleidoscope, with all-layer effects, per-effect tuning, and user-saveable presets.

**Architecture:** A `TunnelViewController` (Svelte 5 runes class, mirroring `MandalaViewerController`) owns the tunnel config + presets and derives the overlaid layer sequences. `AnimationPlayer` gains a `normal ↔ tunnel` toggle; in tunnel mode it derives each layer's prop state from the live `currentStep` and feeds them to `AnimatorCanvas` as `additionalLayers` plus a uniform `tipEffectMap`. Effect tuning reuses the viewer's shared effects-config-context and the existing per-effect panels. The all-layer effects engine work is already committed (`3e130a9a71`).

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest. Reuses `rotateSequence`/`mirrorSequence`, `interpolatePropAngles`, `AnimatorCanvas`, `effects-panel/customize/*` + `settings-panels/*`, `effects-config-context`.

---

## Reference implementation

The throwaway harness `src/routes/test/prop-tunnel/+page.svelte` is the proven, type-clean reference for every rendering/tuning behavior in this plan. When a task says "extract from the harness," that file is the source of truth for the exact logic.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.ts` | Pure: `TunnelConfig` type, `rotAmountsFor(fold)`, `stepToIndexProgress(currentStep, length)`. |
| `src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts` | Unit tests for the pure math. |
| `src/lib/shared/sequence-viewer/tunnel/tunnel-layer-builder.ts` | Pure-async: build rotated + mirrored layer sequences from a base sequence + config. |
| `src/lib/shared/sequence-viewer/tunnel/tunnel-presets.ts` | localStorage load/save/delete for `tka_tunnel_presets`. |
| `src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts` | Unit tests (jsdom). |
| `src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts` | Runes class: config $state, presets, derived layer sequences (rebuild on topology change), `additionalLayersAt(currentStep)`, derived `tipEffectMap`. |
| `src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte` | Knobs + effect picker + per-effect panel host + preset chips. |
| `src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte` (modify) | `normal ↔ tunnel` toggle; in tunnel mode pass `additionalLayers` + `tipEffectMap` to `AnimatorCanvas`, mount `TunnelControlStrip`. |
| `src/lib/shared/gamification/components/PropUnlockCelebration.svelte` (modify) | Consume `tunnel-layer-builder` + the shared derivation instead of its private copy. |

DRY: `tunnel-layer-builder` is the single source for "build rotated/mirrored layers"; both `AnimationPlayer` (via the controller) and `PropUnlockCelebration` use it.

---

### Task 1: Fold math (pure)

**Files:**
- Create: `src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.ts`
- Test: `src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tunnel-fold-math.test.ts
import { describe, it, expect } from "vitest";
import { rotAmountsFor, stepToIndexProgress, type TunnelConfig } from "./tunnel-fold-math";

describe("rotAmountsFor", () => {
  it("2-fold = single 180° copy", () => expect(rotAmountsFor(2)).toEqual([4]));
  it("4-fold = 90/180/270", () => expect(rotAmountsFor(4)).toEqual([2, 4, 6]));
  it("8-fold = every 45°", () => expect(rotAmountsFor(8)).toEqual([1, 2, 3, 4, 5, 6, 7]));
});

describe("stepToIndexProgress", () => {
  it("maps 1-indexed currentStep to 0-indexed idx + fractional progress", () => {
    expect(stepToIndexProgress(1.0, 8)).toEqual({ idx: 0, progress: 0 });
    expect(stepToIndexProgress(3.5, 8)).toEqual({ idx: 2, progress: 0.5 });
  });
  it("clamps below 1 to the first step", () => {
    expect(stepToIndexProgress(0.4, 8)).toEqual({ idx: 0, progress: 0 });
  });
  it("clamps past the end to the last step", () => {
    expect(stepToIndexProgress(99, 8)).toEqual({ idx: 7, progress: 0 });
  });
  it("returns idx 0 / progress 0 for empty sequences", () => {
    expect(stepToIndexProgress(3, 0)).toEqual({ idx: 0, progress: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts`
Expected: FAIL — "Cannot find module './tunnel-fold-math'".

- [ ] **Step 3: Write minimal implementation**

```ts
// tunnel-fold-math.ts
import type { EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";

/** Rotational symmetry of the tunnel. The TKA grid is 8 points (45° steps), so
 *  rotateSequence only lands on 45° multiples — 2/4/8 are the representable folds
 *  (120°/60° i.e. 3/6-fold are not). */
export type Fold = 2 | 4 | 8;

export interface TunnelConfig {
  fold: Fold;
  mirror: boolean;
  effect: EffectType;
}

/** rotateSequence amounts (1 unit = 45°) for each fold, excluding the base (0°). */
export function rotAmountsFor(fold: Fold): number[] {
  if (fold === 8) return [1, 2, 3, 4, 5, 6, 7];
  if (fold === 4) return [2, 4, 6];
  return [4];
}

/** Convert AnimationPlayer's 1-indexed fractional currentStep (where <1 is the
 *  start position) to a 0-indexed step index + fractional progress within it. */
export function stepToIndexProgress(
  currentStep: number,
  length: number,
): { idx: number; progress: number } {
  if (length <= 0) return { idx: 0, progress: 0 };
  const beat = Math.max(0, currentStep - 1); // 0-indexed
  const idx = Math.min(length - 1, Math.max(0, Math.floor(beat)));
  const progress = Math.max(0, Math.min(0.9999, beat - Math.floor(beat)));
  return { idx, progress };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.ts src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts
git commit -m "feat(tunnel): fold math + step->index/progress (pure)" -- src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.ts src/lib/shared/sequence-viewer/tunnel/tunnel-fold-math.test.ts
```

---

### Task 2: Layer-sequence builder

**Files:**
- Create: `src/lib/shared/sequence-viewer/tunnel/tunnel-layer-builder.ts`

No standalone unit test: it is a thin async composition of `rotateSequence`/`mirrorSequence` (already tested in `sequence-transforms`), and a meaningful test needs a full `SequenceData` fixture the transforms can process. It is covered by the harness and the controller's runtime use. (This is the YAGNI call — do not write a brittle mock-sequence test.)

- [ ] **Step 1: Write the implementation**

```ts
// tunnel-layer-builder.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { rotateSequence, mirrorSequence } from "$lib/shared/create/services/sequence-transforms";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { rotAmountsFor, type TunnelConfig } from "./tunnel-fold-math";

/**
 * Build the overlaid layer sequences (everything beyond the base) for a tunnel
 * config: one rotated copy per amount, plus a mirrored copy of the whole
 * rotational stack (base + rotated) when mirror is on. Returns layers in the
 * order the canvas should overlay them.
 */
export async function buildTunnelLayers(
  base: SequenceData,
  config: TunnelConfig,
): Promise<SequenceData[]> {
  const amounts = rotAmountsFor(config.fold);
  const rotExtras = await Promise.all(
    amounts.map((amt) => rotateSequence(base, amt, motionQueryHandler)),
  );
  const layers: SequenceData[] = [...rotExtras];

  if (config.mirror) {
    const mirroredBase = await mirrorSequence(base, motionQueryHandler);
    const mirroredExtras = await Promise.all(
      rotExtras.map((r) => mirrorSequence(r, motionQueryHandler)),
    );
    layers.push(mirroredBase, ...mirroredExtras);
  }

  return layers;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep tunnel-layer-builder || echo "clean"`
Expected: `clean` (no errors in the file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/tunnel-layer-builder.ts
git commit -m "feat(tunnel): rotated/mirrored layer-sequence builder" -- src/lib/shared/sequence-viewer/tunnel/tunnel-layer-builder.ts
```

---

### Task 3: Preset persistence

**Files:**
- Create: `src/lib/shared/sequence-viewer/tunnel/tunnel-presets.ts`
- Test: `src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tunnel-presets.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadTunnelPresets, saveTunnelPresets, type TunnelPreset } from "./tunnel-presets";

const sample: TunnelPreset = {
  id: "look-1",
  name: "Bloom 8x",
  config: { fold: 8, mirror: true, effect: "bloom" },
};

describe("tunnel presets", () => {
  beforeEach(() => localStorage.clear());

  it("returns [] when nothing is stored", () => {
    expect(loadTunnelPresets()).toEqual([]);
  });

  it("round-trips through localStorage", () => {
    saveTunnelPresets([sample]);
    expect(loadTunnelPresets()).toEqual([sample]);
  });

  it("returns [] on corrupt JSON", () => {
    localStorage.setItem("tka_tunnel_presets", "{not json");
    expect(loadTunnelPresets()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts`
Expected: FAIL — "Cannot find module './tunnel-presets'".

- [ ] **Step 3: Write minimal implementation**

```ts
// tunnel-presets.ts
import type { TunnelConfig } from "./tunnel-fold-math";

export interface TunnelPreset {
  id: string;
  name: string;
  config: TunnelConfig;
}

const STORAGE_KEY = "tka_tunnel_presets";

export function loadTunnelPresets(): TunnelPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TunnelPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveTunnelPresets(presets: TunnelPreset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // quota exceeded / private browsing — non-fatal
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/tunnel-presets.ts src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts
git commit -m "feat(tunnel): user-saveable preset persistence" -- src/lib/shared/sequence-viewer/tunnel/tunnel-presets.ts src/lib/shared/sequence-viewer/tunnel/tunnel-presets.test.ts
```

---

### Task 4: TunnelViewController

**Files:**
- Create: `src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts`

Mirrors `MandalaViewerController`: a runes class owning config + presets, rebuilding layers on topology change, and deriving per-layer prop states from the live `currentStep`. No unit test — its logic is `$state`/`$effect` orchestration plus the already-tested pure helpers; verified via the harness parity and the in-pane integration (Task 6).

- [ ] **Step 1: Write the implementation**

```ts
// tunnel-view-controller.svelte.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import { interpolatePropAngles } from "$lib/shared/animation-engine/services/prop-interpolator";
import { buildTunnelLayers } from "./tunnel-layer-builder";
import { stepToIndexProgress, type Fold, type TunnelConfig } from "./tunnel-fold-math";
import {
  loadTunnelPresets,
  saveTunnelPresets,
  type TunnelPreset,
} from "./tunnel-presets";

const DEFAULT_PROP_STATE: PropState = { centerPathAngle: 0, staffRotationAngle: 0 };

export interface TunnelControllerSources {
  /** The viewer's currently open sequence. */
  getSequence: () => SequenceData | null | undefined;
}

/** Reduced-motion caps the fold so a dense kaleidoscope doesn't spin for users
 *  who asked for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class TunnelViewController {
  // Tunnel sub-mode on/off (speed + play/pause ride the pane's existing transport).
  active = $state(false);

  // Config (a saved preset stores exactly this).
  fold = $state<Fold>(4);
  mirror = $state(false);
  effect = $state<TunnelConfig["effect"]>("none");

  presets = $state<TunnelPreset[]>([]);

  #sources: TunnelControllerSources;
  #layers = $state<SequenceData[]>([]);
  #buildToken = 0;

  constructor(sources: TunnelControllerSources) {
    this.#sources = sources;
    this.presets = loadTunnelPresets();

    // Rebuild the overlaid layers whenever the topology (sequence/fold/mirror)
    // changes. Effect/transport changes do NOT rebuild — they are per-frame.
    $effect(() => {
      const seq = this.#sources.getSequence();
      const fold = this.fold;
      const mirror = this.mirror;
      const on = this.active;
      if (!on || !seq) {
        this.#layers = [];
        return;
      }
      const token = ++this.#buildToken;
      void buildTunnelLayers(seq, { fold, mirror, effect: this.effect }).then((layers) => {
        if (token === this.#buildToken) this.#layers = layers;
      });
    });
  }

  /** Cap fold under reduced-motion (8/4 -> 2). */
  setFold(fold: Fold): void {
    this.fold = prefersReducedMotion() ? 2 : fold;
  }

  /** Uniform all-layer effect map. undefined when effect is "none". */
  tipEffectMap = $derived<TipEffectMap | undefined>(
    !this.active || this.effect === "none"
      ? undefined
      : { "*": { effect: this.effect } },
  );

  /** Per-layer prop states at the live playhead. Pass AnimationPlayer's
   *  1-indexed fractional currentStep. */
  additionalLayersAt(currentStep: number): AdditionalLayerProps[] {
    if (!this.active) return [];
    return this.#layers.map((seq) => {
      const p = this.#propsFor(seq, currentStep);
      return { blueProp: p.blue, redProp: p.red };
    });
  }

  #propsFor(
    seq: SequenceData,
    currentStep: number,
  ): { blue: PropState; red: PropState } {
    const steps = seq.steps ?? [];
    if (steps.length === 0) {
      return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    }
    const { idx, progress } = stepToIndexProgress(currentStep, steps.length);
    const step = steps[idx];
    if (!step) return { blue: { ...DEFAULT_PROP_STATE }, red: { ...DEFAULT_PROP_STATE } };
    const r = interpolatePropAngles(step, progress);
    return {
      blue: r.isValid ? (r.blueAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
      red: r.isValid ? (r.redAngles ?? { ...DEFAULT_PROP_STATE }) : { ...DEFAULT_PROP_STATE },
    };
  }

  // ── Presets ──────────────────────────────────────────────────
  saveCurrentAs(name: string): void {
    const trimmed = name.trim() || `Look ${this.presets.length + 1}`;
    const preset: TunnelPreset = {
      id: `${trimmed}-${this.presets.length}-${Math.floor(performance.now())}`,
      name: trimmed,
      config: { fold: this.fold, mirror: this.mirror, effect: this.effect },
    };
    this.presets = [...this.presets, preset];
    saveTunnelPresets(this.presets);
  }

  applyPreset(p: TunnelPreset): void {
    this.effect = p.config.effect;
    this.setFold(p.config.fold);
    this.mirror = p.config.mirror;
  }

  deletePreset(id: string): void {
    this.presets = this.presets.filter((p) => p.id !== id);
    saveTunnelPresets(this.presets);
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep tunnel-view-controller || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts
git commit -m "feat(tunnel): TunnelViewController (config, presets, layer derivation)" -- src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts
```

---

### Task 5: TunnelControlStrip

**Files:**
- Create: `src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte`

Composes the knobs + effect picker + the real per-effect panel (from the harness) + preset chips. Bound to a `TunnelViewController` instance passed as a prop. The per-effect panels read the viewer's shared `effects-config-context` (already in scope from `ViewerSplitPane`), so this component does NOT create its own config.

- [ ] **Step 1: Write the component**

```svelte
<!-- TunnelControlStrip.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import type { EffectType } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import type { Fold } from "./tunnel-fold-math";
  import type { TunnelViewController } from "./tunnel-view-controller.svelte";

  import FirePanel from "$lib/shared/animation-engine/components/settings-panels/FirePanel.svelte";
  import CharcoalPanel from "$lib/shared/animation-engine/components/settings-panels/CharcoalPanel.svelte";
  import LedPanel from "$lib/shared/animation-engine/components/settings-panels/LedPanel.svelte";
  import TrailsPanel from "$lib/shared/animation-engine/components/settings-panels/TrailsPanel.svelte";
  import ZapCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/ZapCustomize.svelte";
  import SparklesCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte";
  import EchoCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/EchoCustomize.svelte";
  import BloomCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/BloomCustomize.svelte";
  import WaterCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/WaterCustomize.svelte";
  import BubblesCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/BubblesCustomize.svelte";
  import PetalsCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/PetalsCustomize.svelte";
  import SmokeCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SmokeCustomize.svelte";
  import InkCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/InkCustomize.svelte";
  import FrostCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/FrostCustomize.svelte";
  import SilkCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/SilkCustomize.svelte";
  import PulseCustomize from "$lib/shared/animation-engine/components/effects-panel/customize/PulseCustomize.svelte";

  const { controller }: { controller: TunnelViewController } = $props();

  const folds: Fold[] = [2, 4, 8];
  const effectChoices: EffectType[] = [
    "none", "fire", "charcoal", "led", "trails", "zap", "sparkles", "echo",
    "bloom", "water", "bubbles", "petals", "smoke", "ink", "frost", "silk", "pulse",
  ];

  type PanelEntry = { comp: Component<any>; needsBack: boolean };
  const EFFECT_PANELS: Record<string, PanelEntry> = {
    fire: { comp: FirePanel, needsBack: false },
    charcoal: { comp: CharcoalPanel, needsBack: false },
    led: { comp: LedPanel, needsBack: false },
    trails: { comp: TrailsPanel, needsBack: false },
    zap: { comp: ZapCustomize, needsBack: true },
    sparkles: { comp: SparklesCustomize, needsBack: true },
    echo: { comp: EchoCustomize, needsBack: true },
    bloom: { comp: BloomCustomize, needsBack: true },
    water: { comp: WaterCustomize, needsBack: true },
    bubbles: { comp: BubblesCustomize, needsBack: true },
    petals: { comp: PetalsCustomize, needsBack: true },
    smoke: { comp: SmokeCustomize, needsBack: true },
    ink: { comp: InkCustomize, needsBack: true },
    frost: { comp: FrostCustomize, needsBack: true },
    silk: { comp: SilkCustomize, needsBack: true },
    pulse: { comp: PulseCustomize, needsBack: true },
  };
  const activePanel = $derived(
    controller.effect === "none" ? null : EFFECT_PANELS[controller.effect] ?? null,
  );
  const noBack = () => {};

  let newName = $state("");
</script>

<div class="tunnel-strip">
  <div class="knobs">
    <div class="group">
      <span class="lbl">Fold</span>
      {#each folds as f (f)}
        <button class:active={controller.fold === f} onclick={() => controller.setFold(f)}>{f}×</button>
      {/each}
      <button class:active={controller.mirror} onclick={() => (controller.mirror = !controller.mirror)}>Mirror</button>
    </div>
  </div>

  <div class="group effects">
    <span class="lbl">Effect</span>
    <div class="row">
      {#each effectChoices as e (e)}
        <button class:active={controller.effect === e} onclick={() => (controller.effect = e)}>{e}</button>
      {/each}
    </div>
  </div>

  {#if activePanel}
    {@const Panel = activePanel.comp}
    <div class="effect-panel">
      {#if activePanel.needsBack}
        <Panel onBack={noBack} />
      {:else}
        <Panel />
      {/if}
    </div>
  {/if}

  <div class="presets">
    <input
      class="name-input"
      type="text"
      placeholder="name this look…"
      bind:value={newName}
      onkeydown={(e) => { if (e.key === "Enter") { controller.saveCurrentAs(newName); newName = ""; } }}
    />
    <button onclick={() => { controller.saveCurrentAs(newName); newName = ""; }}>Save preset</button>
    <div class="chips">
      {#each controller.presets as p (p.id)}
        <div class="chip">
          <button class="chip-apply" onclick={() => controller.applyPreset(p)}>{p.name}</button>
          <button class="chip-del" aria-label={`Delete ${p.name}`} onclick={() => controller.deletePreset(p.id)}>×</button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .tunnel-strip { display: flex; flex-direction: column; gap: 10px; align-items: center; width: 100%; }
  .group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .group.effects { flex-direction: column; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .lbl { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; }
  button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; cursor: pointer;
    min-height: 44px;
  }
  button.active {
    background: var(--theme-accent, #8b5cf6); border-color: transparent; color: #fff;
  }
  .effect-panel {
    width: min(520px, 100%); padding: 12px 14px; border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(150, 120, 240, 0.3));
    background: var(--theme-panel-bg, rgba(20, 20, 30, 0.6));
  }
  .presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
  .name-input {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: inherit; padding: 6px 11px; border-radius: 9px; font-size: 0.8rem; min-height: 44px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; border: 1px solid var(--theme-accent, rgba(150,120,240,0.4)); border-radius: 999px; overflow: hidden; }
  .chip-apply { border: none; border-radius: 0; }
  .chip-del { border: none; border-radius: 0; padding: 6px 9px; }
</style>
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep TunnelControlStrip || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte
git commit -m "feat(tunnel): control strip (knobs + per-effect panels + presets)" -- src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte
```

---

### Task 6: AnimationPlayer integration

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte`

Add a `normal ↔ tunnel` toggle. Construct a `TunnelViewController` fed by the open sequence. In tunnel mode, pass `additionalLayers` (derived from the live `currentStep`) and the controller's `tipEffectMap` to BOTH `AnimatorCanvas` instances (vertical + horizontal), and render `TunnelControlStrip`. Speed/pause ride the existing transport (no new clock).

- [ ] **Step 1: Add imports + controller**

In the `<script>`, after the existing imports (around line 37), add:

```ts
import TunnelControlStrip from "../tunnel/TunnelControlStrip.svelte";
import { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
```

After `const animState = createAnimationPanelState();` (around line 91), add:

```ts
// Tunnel sub-mode: overlays rotated/mirrored copies of the sequence into a
// live kaleidoscope. Rides the existing transport (currentStep) — no new clock.
const tunnel = new TunnelViewController({ getSequence: () => sequenceData });
const tunnelLayers = $derived(tunnel.additionalLayersAt(currentStep));
```

- [ ] **Step 2: Add the toggle to the vertical layout**

Replace the vertical `<div class="canvas-wrap">` block's `AnimatorCanvas` opening (around line 337) by adding the two tunnel props, and add a toggle button + strip. The full edited vertical branch:

```svelte
{:else}
  <!-- Vertical mode: original layout -->
  <div class="tunnel-toggle-row">
    <button
      class="tunnel-toggle"
      class:active={tunnel.active}
      aria-pressed={tunnel.active}
      onclick={() => (tunnel.active = !tunnel.active)}
    >Tunnel</button>
  </div>
  <div class="canvas-wrap">
    <AnimatorCanvas
      blueProp={bluePropState}
      redProp={redPropState}
      additionalLayers={tunnel.active ? tunnelLayers : undefined}
      tipEffectMap={tunnel.tipEffectMap}
      gridVisible={true}
      {gridMode}
      {letter}
      {stepData}
      {sequenceData}
      {currentStep}
      {isPlaying}
      word={hideWordHeader ? null : (sequenceData?.word ?? sequence?.word ?? null)}
      onPlaybackToggle={togglePlayback}
      {trailSettings}
      onCanvasReady={handleCanvasReady}
      {previewDarkMode}
      {bluePropType}
      {redPropType}
      progressBarVariant="minimal"
      {hideProgressBar}
      {tapToToggle}
    />

    {#if isExporting && exportProgress}
      <ExportProgressOverlay progress={exportProgress} onCancel={cancelExport} />
    {/if}
  </div>

  {#if tunnel.active}
    <TunnelControlStrip controller={tunnel} />
  {/if}

  {#if showControls}
    <VerticalModeControls
      {controlsLevel}
      {useContext}
      {isPlaying}
      {bpm}
      {playbackMode}
      stepSize={stepSize}
      onPlaybackToggle={togglePlayback}
      onBpmChange={handleBpmChange}
      onPlaybackModeChange={setPlaybackMode}
      onStepSizeChange={setStepSize}
      onStepHalfBack={stepHalfBack}
      onStepHalfFwd={stepHalfFwd}
      onRestartToStart={restartToStart}
      onStepFullFwd={stepFullFwd}
    />
  {/if}
{/if}
```

- [ ] **Step 3: Mirror the two tunnel props into the horizontal `AnimatorCanvas`**

In the horizontal branch's `AnimatorCanvas` (around line 282), add the same two props right after `redProp={redPropState}`:

```svelte
        additionalLayers={tunnel.active ? tunnelLayers : undefined}
        tipEffectMap={tunnel.tipEffectMap}
```

(The horizontal toggle + strip are out of scope for v1 — the vertical pane is the viewer's 2D mode. Horizontal still benefits if tunnel is toggled, but its dedicated toggle UI is deferred; note this in the PR.)

- [ ] **Step 4: Add toggle styles**

Add to the `<style>` block:

```css
	.tunnel-toggle-row { display: flex; justify-content: center; }
	.tunnel-toggle {
		min-height: 44px;
		padding: 6px 16px;
		border-radius: 9px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
		color: inherit;
		cursor: pointer;
	}
	.tunnel-toggle.active {
		background: var(--theme-accent, #8b5cf6);
		border-color: transparent;
		color: #fff;
	}
```

- [ ] **Step 5: Verify type-check + dev server**

Run: `npm run check > /tmp/tunnel-int.log 2>&1; grep -iE "AnimationPlayer|TunnelControlStrip|tunnel-view-controller" /tmp/tunnel-int.log || echo "clean"`
Expected: `clean` (no new errors in the touched files).

Then visual smoke: open the sequence viewer, switch the 2D pane to a sequence, click **Tunnel**, confirm the kaleidoscope appears and effects/presets work. (Verification per `verification-protocol.md`: capture a screenshot or DOM/console check — do not claim visual success without evidence.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte
git commit -m "feat(tunnel): Tunnel sub-mode toggle in the 2D animation pane" -- src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte
```

---

### Task 7: Celebration refactor (DRY)

**Files:**
- Modify: `src/lib/shared/gamification/components/PropUnlockCelebration.svelte`

`PropUnlockCelebration` currently hand-rolls the rotate-and-overlay logic (`loadReveal` calling `rotateSequence` per amount). Replace that with `buildTunnelLayers` so both surfaces share one builder. The celebration keeps its own rAF clock (it is a standalone modal, not riding a viewer transport), but the layer construction comes from the shared module.

- [ ] **Step 1: Replace the inline rotate loop**

In `PropUnlockCelebration.svelte`, replace the body of `loadReveal` (the `Promise.all(amounts.map((amt) => rotateSequence(...)))` block) with a call to the shared builder. Change:

```ts
const copies = await Promise.all(
  amounts.map((amt) => rotateSequence(seq, amt, motionQueryHandler)),
);
```

to:

```ts
// Shared with Tunnel View. amounts here are the legacy [2,4,6]/[4] reveal
// shapes; map them to a fold so the one builder produces the same layers.
const fold = amounts.length >= 3 ? 4 : 2;
const copies = await buildTunnelLayers(seq, { fold, mirror: false, effect: "none" });
```

Add the import at the top:

```ts
import { buildTunnelLayers } from "$lib/shared/sequence-viewer/tunnel/tunnel-layer-builder";
```

Remove the now-unused `rotateSequence` / `motionQueryHandler` imports if nothing else in the file uses them (grep first: `grep -nE "rotateSequence|motionQueryHandler" src/lib/shared/gamification/components/PropUnlockCelebration.svelte`).

- [ ] **Step 2: Verify type-check**

Run: `npm run check > /tmp/tunnel-celeb.log 2>&1; grep -iE "PropUnlockCelebration" /tmp/tunnel-celeb.log || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Visual smoke**

Trigger the prop-unlock celebration (or its existing entry point) and confirm the REVEAL tunnel still renders identically. Evidence required per `verification-protocol.md`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/gamification/components/PropUnlockCelebration.svelte
git commit -m "refactor(gamification): celebration reuses shared tunnel layer builder" -- src/lib/shared/gamification/components/PropUnlockCelebration.svelte
```

---

### Task 8: Perf guard

**Files:**
- Modify: `src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts`

Heavy effects (fire/charcoal/trails) across an 8×+mirror stack are the cost center. Add a derived guard that surfaces when the current fold+effect is in the expensive zone, plus the already-present reduced-motion fold cap (`setFold`). v1 is advisory (a flag the strip can show), not a hard block — the user explicitly drives the knobs.

- [ ] **Step 1: Add the guard derived**

In `TunnelViewController`, after `tipEffectMap`, add:

```ts
/** Effects with real per-tip GPU/2D cost per layer. */
static readonly HEAVY_EFFECTS = new Set(["fire", "charcoal", "trails"]);

/** True when the current config is in the expensive zone (heavy effect on a
 *  large stack). Advisory — the strip can warn; not a hard cap. */
heavyLoad = $derived(
  this.active &&
    TunnelViewController.HEAVY_EFFECTS.has(this.effect) &&
    (this.fold === 8 || this.mirror),
);
```

- [ ] **Step 2: Surface it in the strip**

In `TunnelControlStrip.svelte`, add under the effect picker:

```svelte
{#if controller.heavyLoad}
  <p class="warn">Heavy effect on a large stack — may drop frames on weaker devices.</p>
{/if}
```

and style:

```css
  .warn { margin: 0; font-size: 0.72rem; color: var(--semantic-warning, #fbbf24); text-align: center; }
```

- [ ] **Step 3: Verify type-check**

Run: `npm run check > /tmp/tunnel-perf.log 2>&1; grep -iE "tunnel-view-controller|TunnelControlStrip" /tmp/tunnel-perf.log || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte
git commit -m "feat(tunnel): advisory heavy-load guard + reduced-motion fold cap" -- src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts src/lib/shared/sequence-viewer/tunnel/TunnelControlStrip.svelte
```

---

## Final verification

- [ ] `npm run check` is green for all touched files (capture once; grep the log).
- [ ] `npx vitest run src/lib/shared/sequence-viewer/tunnel/` passes.
- [ ] Visual: viewer 2D pane → Tunnel toggle → kaleidoscope renders; fold/mirror/effect knobs work; per-effect panel tunes the live look; save/apply/delete a preset; reload persists presets; reduced-motion caps fold at 2. Evidence captured per `verification-protocol.md`.
- [ ] Celebration REVEAL unchanged.

## Self-review notes (resolved)

- **Spec §3 speed/paused:** dropped from `TunnelConfig` — in the real pane these ride the existing transport (BPM + play/pause), so duplicating them would violate DRY. Presets store fold/mirror/effect only. (Refinement discovered while reading `AnimationPlayer`.)
- **Spec §6 engine changes:** already committed (`3e130a9a71`); not re-planned here.
- **Spec §3 effect tuning shared with viewer:** the strip mounts the real per-effect panels which read the viewer's `effects-config-context`; no isolated config is created in-pane.
- **Tint (spec §1 non-goal):** not planned.
