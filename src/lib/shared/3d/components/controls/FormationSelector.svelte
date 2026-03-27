<script lang="ts">
  /**
   * FormationSelector - Formation preset buttons
   *
   * Quick access to formation presets: Grid, Line, Circle, V-Shape, Diagonal.
   * Shows active state and triggers transitions on selection.
   */

  import type { FormationPreset } from "../../domain/formation";
  import { FORMATION_PRESET_INFO } from "../../config/formation-presets";

  interface Props {
    /** Currently active preset */
    value: FormationPreset;
    /** Whether a transition is in progress */
    isTransitioning?: boolean;
    /** Number of performers (affects visual feedback) */
    performerCount?: number;
    /** Callback when preset is selected */
    onchange: (preset: FormationPreset) => void;
  }

  let {
    value,
    isTransitioning = false,
    performerCount = 1,
    onchange,
  }: Props = $props();
</script>

<div class="formation-bar" class:transitioning={isTransitioning}>
  {#each FORMATION_PRESET_INFO as preset}
    <button
      class="formation-btn"
      class:active={value === preset.id}
      onclick={() => onchange(preset.id)}
      aria-label={preset.description}
      aria-pressed={value === preset.id}
      title={preset.description}
      disabled={isTransitioning}
    >
      <i class="fa-solid fa-{preset.icon}" aria-hidden="true"></i>
      <span class="label">{preset.name}</span>
    </button>
  {/each}
</div>

<style>
  .formation-bar {
    display: flex;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 4px;
    gap: 2px;
  }

  .formation-bar.transitioning {
    opacity: 0.8;
    pointer-events: none;
  }

  .formation-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .formation-btn:hover:not(:disabled) {
    color: var(--theme-text);
    background: var(--theme-card-hover-bg);
  }

  .formation-btn.active {
    color: white;
    background: var(--theme-accent);
  }

  .formation-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .formation-btn i {
    font-size: 1rem;
  }

  .label {
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .formation-bar {
      padding: 2px;
    }

    .formation-btn {
      padding: 4px 6px;
    }

    .label {
      display: none;
    }
  }
</style>
