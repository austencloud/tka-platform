<script lang="ts">
  /**
   * ChoreoCardLayoutPanel
   *
   * Column count picker (chip-style) and Card Settings button
   * for the 2D choreo card viewer gear popover.
   */

  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

  interface Props {
    stepCount: number;
    onOpenSettings: () => void;
  }

  let { stepCount, onOpenSettings }: Props = $props();

  const composition = getImageCompositionManager();

  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    composition.registerObserver(bump);
    return () => composition.unregisterObserver(bump);
  });

  function getCurrentCols(): number | null {
    void version;
    return composition.getColumnCountForStepCount(stepCount);
  }

  // Even column options up to min(stepCount, 8), only for 4+ steps
  const columnOptions = $derived.by(() => {
    if (stepCount < 4) return [];
    const options: (number | null)[] = [null]; // null = Auto
    for (let c = 2; c <= Math.min(stepCount, 8); c += 2) {
      options.push(c);
    }
    return options;
  });

  function selectColumns(cols: number | null) {
    composition.setColumnCountForStepCount(stepCount, cols);
  }
</script>

{#if columnOptions.length > 0}
  <div class="section-label">Columns</div>
  <div class="column-chips">
    {#each columnOptions as cols}
      {@const current = getCurrentCols()}
      {@const isActive = cols === current}
      <button
        class="chip"
        class:active={isActive}
        onclick={() => selectColumns(cols)}
        aria-pressed={isActive}
      >
        {cols === null ? "Auto" : cols}
      </button>
    {/each}
  </div>
{/if}

<div class="settings-row">
  <button class="settings-btn" onclick={onOpenSettings}>
    <i class="fas fa-sliders" aria-hidden="true"></i>
    Card Settings
  </button>
</div>

<style>
  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .column-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
    margin-bottom: 12px;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .settings-row {
    padding-top: 4px;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
  }

  .settings-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }
</style>
