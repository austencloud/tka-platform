<!--
  EffectsSection.svelte

  Visual effect selector: radio-style chips for None, Fire, Charcoal, LED, Trails.
  When Trails is selected, shows a sub-group for trail mode (Fade, Persistent, Loop Clear).
-->
<script lang="ts">
  import type { CellEffect } from "$lib/features/compose/compose/domain/types";
  import { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";

  let {
    currentEffect,
    currentTrailMode,
    onSetEffect,
    onSetTrailMode,
    onOpenMatrix,
  }: {
    currentEffect: CellEffect;
    currentTrailMode: TrailMode | undefined;
    onSetEffect: (effect: CellEffect) => void;
    onSetTrailMode: (mode: TrailMode) => void;
    onOpenMatrix?: () => void;
  } = $props();

  const effects: { value: CellEffect; label: string; icon?: string; dot?: string }[] = [
    { value: "none", label: "None", icon: "fa-ban" },
    { value: "fire", label: "Fire", dot: "#f97316" },
    { value: "charcoal", label: "Charcoal", dot: "#a855f7" },
    { value: "led", label: "LED", dot: "#22c55e" },
    { value: "trails", label: "Trails", icon: "fa-wind" },
  ];

  const trailModes: { value: TrailMode; label: string }[] = [
    { value: TrailMode.FADE, label: "Fade" },
    { value: TrailMode.PERSISTENT, label: "Persistent" },
    { value: TrailMode.LOOP_CLEAR, label: "Loop Clear" },
  ];
</script>

<div class="effects-section">
  <div class="chip-grid" role="radiogroup" aria-label="Visual effect">
    {#each effects as effect}
      <button
        class="chip"
        class:active={currentEffect === effect.value}
        role="radio"
        aria-checked={currentEffect === effect.value}
        onclick={() => onSetEffect(effect.value)}
        style:--chip-color={effect.dot ?? "#60a5fa"}
      >
        {#if effect.icon}
          <i class="fas {effect.icon}" aria-hidden="true"></i>
        {:else if effect.dot}
          <span class="color-dot" style:background={effect.dot}></span>
        {/if}
        {effect.label}
      </button>
    {/each}
  </div>

  {#if onOpenMatrix}
    <button class="customize-btn" onclick={() => onOpenMatrix?.()}>
      <i class="fas fa-sliders" aria-hidden="true"></i> Customize per tip
    </button>
  {/if}

  {#if currentEffect === "trails"}
    <div class="sub-group">
      <span class="sub-label" id="trail-mode-label">TRAIL MODE</span>
      <div class="chip-grid" role="radiogroup" aria-labelledby="trail-mode-label">
        {#each trailModes as mode}
          <button
            class="chip"
            class:active={currentTrailMode === mode.value}
            role="radio"
            aria-checked={currentTrailMode === mode.value}
            onclick={() => onSetTrailMode(mode.value)}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .effects-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    border-radius: 22px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color, #f97316) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #f97316) 30%, transparent);
    color: var(--chip-color, #f97316);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .customize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .customize-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.18);
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }

  .sub-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    font-weight: 600;
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .effects-section {
      animation: none;
    }

    .chip,
    .customize-btn {
      transition: none;
    }
  }
</style>
