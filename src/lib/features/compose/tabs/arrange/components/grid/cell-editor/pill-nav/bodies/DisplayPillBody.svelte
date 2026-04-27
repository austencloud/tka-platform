<script lang="ts">
  import type { CellMediaType } from '$lib/features/compose/compose/domain/types';

  let {
    currentMediaType = 'animation' as CellMediaType,
    layerCount = 1,
    blueVisible = true,
    redVisible = true,
    onMediaTypeChange,
    onToggleBlueVisibility,
    onToggleRedVisibility,
  }: {
    currentMediaType?: CellMediaType;
    layerCount?: number;
    blueVisible?: boolean;
    redVisible?: boolean;
    onMediaTypeChange: (type: CellMediaType) => void;
    onToggleBlueVisibility: () => void;
    onToggleRedVisibility: () => void;
  } = $props();

  const choreoDisabled = $derived(layerCount > 1);
</script>

<div class="display-body">
  <span class="section-label">MEDIA TYPE</span>
  <div class="toggle-row">
    <button
      class="toggle-chip"
      class:active={currentMediaType === 'animation'}
      onclick={() => onMediaTypeChange('animation')}
    >
      <i class="fas fa-film" aria-hidden="true"></i>
      Animation
    </button>
    <button
      class="toggle-chip"
      class:active={currentMediaType === 'choreo-card'}
      disabled={choreoDisabled}
      onclick={() => onMediaTypeChange('choreo-card')}
      title={choreoDisabled ? 'Choreo Card requires a single layer' : ''}
    >
      <i class="fas fa-id-card" aria-hidden="true"></i>
      Choreo Card
    </button>
  </div>

  <span class="section-label">VISIBILITY</span>
  <div class="toggle-row">
    <button
      class="toggle-chip"
      class:active={blueVisible}
      onclick={onToggleBlueVisibility}
    >
      <span class="color-dot" style:background="#3b82f6"></span>
      Blue Hand
    </button>
    <button
      class="toggle-chip"
      class:active={redVisible}
      onclick={onToggleRedVisibility}
    >
      <span class="color-dot" style:background="#ef4444"></span>
      Red Hand
    </button>
  </div>
</div>

<style>
  .display-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .toggle-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 14px;
    border-radius: var(--chip-radius, 22px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-chip:hover:not(:disabled) {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .toggle-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 35%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .toggle-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-chip { transition: none; }
  }
</style>
