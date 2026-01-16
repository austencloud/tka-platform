<script lang="ts">
  /**
   * Component Selection Panel
   *
   * Mode toggle for switching between whole, section, and beat pair labeling.
   * Uses shared design tokens from app.css.
   */
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    labelingMode: "whole" | "section" | "steppair";
    onLabelingModeChange: (mode: "whole" | "section" | "steppair") => void;
  }

  let { labelingMode, onLabelingModeChange }: Props = $props();
</script>

<div class="mode-toggle-panel">
  <div class="mode-toggle-container">
    <button
      class="mode-toggle-btn"
      class:active={labelingMode === "whole"}
      onclick={() => onLabelingModeChange("whole")}
    >
      <FontAwesomeIcon icon="layer-group" size="1em" />
      Whole Sequence
    </button>
    <button
      class="mode-toggle-btn"
      class:active={labelingMode === "section"}
      onclick={() => onLabelingModeChange("section")}
    >
      <FontAwesomeIcon icon="grip" size="1em" />
      Section Mode
    </button>
    <button
      class="mode-toggle-btn"
      class:active={labelingMode === "steppair"}
      onclick={() => onLabelingModeChange("steppair")}
    >
      <FontAwesomeIcon icon="link" size="1em" />
      Beat Pair
    </button>
  </div>
</div>

<style>
  .mode-toggle-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .mode-toggle-container {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--surface-dark);
    border-radius: 10px;
  }

  .mode-toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--muted);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .mode-toggle-btn:hover {
    color: var(--muted-foreground);
    background: var(--surface-color);
  }

  .mode-toggle-btn.active {
    background: var(--gradient-primary);
    color: var(--foreground);
    font-weight: 600;
  }
</style>
