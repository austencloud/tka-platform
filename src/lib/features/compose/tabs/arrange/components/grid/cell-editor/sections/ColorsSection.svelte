<!--
  ColorsSection.svelte

  Prop color combo selector. 4 fixed pairings from TUNNEL_LAYER_COLORS.
  Each pairing shows both colors side by side as a selectable chip.
-->
<script lang="ts">
  import { TUNNEL_LAYER_COLORS, type PropColors } from '$lib/features/compose/compose/domain/types';

  let {
    currentColors,
    onSetColors,
  }: {
    currentColors: PropColors;
    onSetColors: (colors: PropColors) => void;
  } = $props();

  const combos: { label: string; colors: PropColors }[] = [
    { label: 'Blue / Red', colors: TUNNEL_LAYER_COLORS[0]! },
    { label: 'Purple / Orange', colors: TUNNEL_LAYER_COLORS[1]! },
    { label: 'Emerald / Pink', colors: TUNNEL_LAYER_COLORS[2]! },
    { label: 'Cyan / Yellow', colors: TUNNEL_LAYER_COLORS[3]! },
  ];

  function isSelected(combo: PropColors): boolean {
    return combo.left === currentColors.left && combo.right === currentColors.right;
  }
</script>

<div class="colors-section">
  <div class="combo-grid" role="radiogroup" aria-label="Prop color combo">
    {#each combos as combo}
      <button
        class="combo-chip"
        class:active={isSelected(combo.colors)}
        role="radio"
        aria-checked={isSelected(combo.colors)}
        onclick={() => onSetColors(combo.colors)}
      >
        <span class="color-pair">
          <span class="color-swatch" style:background={combo.colors.left}></span>
          <span class="color-swatch" style:background={combo.colors.right}></span>
        </span>
        <span class="combo-label">{combo.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .colors-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .combo-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .combo-chip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    min-height: 48px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .combo-chip:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .combo-chip.active {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.35);
    color: var(--theme-text, white);
  }

  .color-pair {
    display: flex;
    gap: 4px;
  }

  .color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
  }

  .combo-label {
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .colors-section { animation: none; }
    .combo-chip { transition: none; }
  }
</style>
