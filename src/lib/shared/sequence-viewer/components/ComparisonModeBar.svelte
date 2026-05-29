<script lang="ts">
  import type { ComparisonMode } from '../services/viewer-state-persistence';

  interface Props {
    current: ComparisonMode;
    onSelect: (mode: ComparisonMode) => void;
  }

  let { current, onSelect }: Props = $props();

  const modes: { id: ComparisonMode; label: string }[] = [
    { id: '2d-card', label: '2D + Card' },
    { id: '3d-card', label: '3D + Card' },
    { id: '2d-3d', label: '2D + 3D' },
    { id: '2d-mandala', label: '2D + Mandala' }
  ];

  function handleSelect(id: ComparisonMode) {
    if (id !== current) onSelect(id);
  }
</script>

<div class="comparison-bar" role="group" aria-label="Comparison mode">
  {#each modes as mode (mode.id)}
    <button
      type="button"
      class="mode-chip"
      class:active={mode.id === current}
      aria-pressed={mode.id === current}
      onclick={() => handleSelect(mode.id)}
    >
      {mode.label}
    </button>
  {/each}
</div>

<style>
  .comparison-bar {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .mode-chip {
    padding: 5px 12px;
    border: none;
    border-radius: 14px;
    background: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .mode-chip:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.06);
  }

  .mode-chip.active {
    color: white;
    background: var(--theme-accent, #6366f1);
  }

  .mode-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
</style>
