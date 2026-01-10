<!--
  ImageExportButton.svelte

  Opens the image export panel from the ButtonPanel. Highlights when the panel is visible.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";

  const {
    onclick,
    isActive = false,
    disabled = false,
  }: {
    onclick?: () => void;
    isActive?: boolean;
    disabled?: boolean;
  } = $props();

  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="panel-button image-export-button"
  class:active={isActive}
  onclick={handleClick}
  aria-pressed={isActive}
  aria-label={isActive ? "Close image export" : "Export as image"}
  title="Export Image"
  {disabled}
>
  <i class="fas fa-image" aria-hidden="true"></i>
</button>

<style>
  .panel-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-normal, 0.3s cubic-bezier(0.4, 0, 0.2, 1));
    font-size: var(--font-size-lg);
    color: var(--theme-text);

    background: linear-gradient(
      135deg,
      #22d3ee 0%,
      color-mix(in srgb, #22d3ee 85%, #06b6d4) 100%
    );
    border: 1px solid color-mix(in srgb, #22d3ee 30%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, #22d3ee 40%, transparent);
  }

  .panel-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #22d3ee 85%, #06b6d4) 0%,
      color-mix(in srgb, #22d3ee 70%, #06b6d4) 100%
    );
    box-shadow: 0 6px 16px color-mix(in srgb, #22d3ee 60%, transparent);
  }

  .panel-button:active:not(:disabled) {
    transform: scale(0.95);
    transition: all 0.1s ease;
  }

  .panel-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .panel-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .image-export-button.active {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    box-shadow: 0 6px 20px color-mix(in srgb, #22d3ee 70%, transparent);
  }

  /* Mobile responsive - ALWAYS 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .panel-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .panel-button {
      width: var(--min-touch-target); /* Keep 48px minimum */
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .panel-button {
      width: var(--min-touch-target); /* NEVER below 48px for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm); /* Smaller icon, same touch target */
    }
  }

  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .panel-button {
      width: var(
        --min-touch-target
      ); /* Maintain 48px minimum for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }
</style>
