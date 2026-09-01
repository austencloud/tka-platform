<script lang="ts">
  /**
   * PerformerManager
   *
   * Dynamic UI to manage 1-4 performers in the 3D scene.
   * Supports selecting active performer and add/remove operations.
   */

  import type { CharacterInstanceState } from "../../state/character-instance-state.svelte";

  interface Props {
    performerStates: CharacterInstanceState[];
    activePerformerIndex: number;
    maxPerformers: number;
    onSelect: (index: number) => void;
    onAdd: () => void;
    onRemove: () => void;
  }

  let {
    performerStates,
    activePerformerIndex,
    maxPerformers,
    onSelect,
    onAdd,
    onRemove,
  }: Props = $props();

  const canAdd = $derived(performerStates.length < maxPerformers);
  const canRemove = $derived(performerStates.length > 1);
</script>

<div class="performer-manager">
  <header class="manager-header">
    <span class="header-title">Performers</span>
    <div class="header-actions">
      <button
        class="action-btn add-btn"
        onclick={onAdd}
        disabled={!canAdd}
        aria-label={canAdd
          ? "Add performer"
          : `Maximum ${maxPerformers} performers reached`}
        title={canAdd ? "Add performer" : `Maximum ${maxPerformers} performers`}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </header>

  <div class="performer-grid">
    {#each performerStates as performer, i (performer.id)}
      <button
        class="performer-chip"
        class:active={activePerformerIndex === i}
        onclick={() => onSelect(i)}
        aria-label={`Select performer ${i + 1}`}
        aria-pressed={activePerformerIndex === i}
      >
        <span class="performer-number">{i + 1}</span>
        {#if performer.hasSequence}
          <span class="sequence-indicator"></span>
        {/if}
      </button>
    {/each}
  </div>

  {#if canRemove}
    <button
      class="remove-btn"
      onclick={onRemove}
      aria-label="Remove last performer"
      title="Remove last performer"
    >
      <i class="fas fa-minus" aria-hidden="true"></i>
      <span>Remove</span>
    </button>
  {/if}
</div>

<style>
  .performer-manager {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .manager-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .header-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent, #64b5f6);
    border: none;
    border-radius: 8px;
    color: var(--theme-on-accent, #000);
    font-size: 0.875rem;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast),
      transform var(--transition-fast);
  }

  .action-btn:hover:not(:disabled) {
    background: var(
      --prop-blue-light,
      color-mix(in srgb, var(--theme-accent) 60%, white)
    );
    transform: scale(1.05);
  }

  .action-btn:disabled {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    cursor: not-allowed;
  }

  .performer-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .performer-chip {
    position: relative;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border: 2px solid transparent;
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .performer-chip:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .performer-chip.active {
    background: var(--theme-accent, #64b5f6);
    border-color: var(--theme-accent, #64b5f6);
    color: var(--theme-on-accent, #000);
  }

  .performer-number {
    z-index: 1;
  }

  .sequence-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 10px;
    height: 10px;
    background: var(--semantic-success, #4caf50);
    border-radius: 50%;
    border: 2px solid var(--theme-card-bg, #1a1a2e);
  }

  .performer-chip.active .sequence-indicator {
    border-color: var(--theme-accent, #64b5f6);
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .remove-btn:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 30%,
      transparent
    );
    color: var(--semantic-error, #ef4444);
  }

  .remove-btn i {
    font-size: 0.75rem;
  }
</style>
