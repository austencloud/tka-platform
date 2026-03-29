<!--
  EffortSection.svelte

  Effort quality selector: 8 chips sourced from the effort-lab domain.
  Laban effort qualities + animation-inspired easings.
-->
<script lang="ts">
  import { EFFORTS } from '$lib/features/effort-lab/domain/effort-types';

  let {
    currentEffort,
    onSetEffort,
    onOpenMatrix,
  }: {
    currentEffort: string | undefined;
    onSetEffort: (effort: string) => void;
    onOpenMatrix?: () => void;
  } = $props();
</script>

<div class="effort-section">
  <div class="chip-grid" role="radiogroup" aria-label="Effort quality">
    {#each EFFORTS as effort}
      <button
        class="chip"
        class:active={currentEffort === effort.id}
        role="radio"
        aria-checked={currentEffort === effort.id}
        onclick={() => onSetEffort(effort.id)}
        style:--chip-color={effort.color}
      >
        <span class="color-dot" style:background={effort.color}></span>
        {effort.label}
      </button>
    {/each}
  </div>

  {#if onOpenMatrix}
    <button class="customize-btn" onclick={() => onOpenMatrix?.()}>
      <i class="fas fa-sliders" aria-hidden="true"></i> Customize per tip
    </button>
  {/if}
</div>

<style>
  .effort-section {
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
    background: color-mix(in srgb, var(--chip-color, #a855f7) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #a855f7) 30%, transparent);
    color: var(--chip-color, #a855f7);
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

  @media (prefers-reduced-motion: reduce) {
    .effort-section {
      animation: none;
    }

    .chip,
    .customize-btn {
      transition: none;
    }
  }
</style>
