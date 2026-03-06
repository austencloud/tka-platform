<script lang="ts">
  /**
   * PresetButtonGroup - Row of preset buttons
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   */

  interface Props {
    /** Preset names to display */
    presets: string[];
    /** Prop color for hover accent */
    color?: "blue" | "red";
    /** Handler when preset is selected */
    onSelect: (preset: string) => void;
  }

  let { presets, color = "blue", onSelect }: Props = $props();
</script>

<div
  class="preset-group"
  class:blue={color === "blue"}
  class:red={color === "red"}
>
  {#each presets as preset}
    <button type="button" class="preset-btn" onclick={() => onSelect(preset)} aria-label={`Select preset: ${preset}`}>
      {preset}
    </button>
  {/each}
</div>

<style>
  .preset-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-stroke);
  }

  .preset-btn {
    flex: 1 1 auto;
    min-height: var(--min-touch-target); /* WCAG AA touch target */
    min-width: 0;
    padding: 0.35rem 0.5rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    cursor: pointer;
    transition: all var(--duration-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preset-btn:hover {
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .blue .preset-btn:hover {
    background: var(--prop-blue);
    border-color: var(--prop-blue);
    color: white;
  }

  .red .preset-btn:hover {
    background: var(--prop-red);
    border-color: var(--prop-red);
    color: white;
  }
</style>
