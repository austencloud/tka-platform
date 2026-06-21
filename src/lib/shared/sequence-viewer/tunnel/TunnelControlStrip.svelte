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
  <div class="group">
    <span class="lbl">Fold</span>
    {#each folds as f (f)}
      <button class:active={controller.fold === f} onclick={() => controller.setFold(f)}>{f}×</button>
    {/each}
    <button class:active={controller.mirror} onclick={() => (controller.mirror = !controller.mirror)}>Mirror</button>
  </div>

  <div class="group effects">
    <span class="lbl">Effect</span>
    <div class="row">
      {#each effectChoices as e (e)}
        <button class:active={controller.effect === e} onclick={() => (controller.effect = e)}>{e}</button>
      {/each}
    </div>
  </div>

  {#if controller.heavyLoad}
    <p class="warn">Heavy effect on a large stack — may drop frames on weaker devices.</p>
  {/if}

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
  .warn { margin: 0; font-size: 0.72rem; color: var(--semantic-warning, #fbbf24); text-align: center; }
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
