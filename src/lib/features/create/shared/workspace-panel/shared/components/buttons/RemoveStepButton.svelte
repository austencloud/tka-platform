<!--
  RemoveStepButton.svelte

  Remove beat button for ButtonPanel.
  Removes the selected beat and all following steps.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";

  // Props
  const {
    stepNumber,
    onclick,
  }: {
    stepNumber: number;
    onclick?: () => void;
  } = $props();

  // Services
  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    hapticService?.trigger("warning");
    onclick?.();
  }
</script>

<button
  class="panel-button remove-beat-button"
  onclick={handleClick}
  aria-label="Remove Beat {stepNumber} and all following steps"
  title="Remove Beat {stepNumber} and all following steps"
>
  <i class="fa-solid fa-trash" aria-hidden="true"></i>
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

    /* Base button styling */
    background: var(--theme-stroke);
    border: 1px solid var(--theme-stroke-strong);
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .panel-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .panel-button:active {
    transform: scale(0.95);
    transition: all 0.1s ease;
  }

  .panel-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .remove-beat-button {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      color-mix(in srgb, var(--semantic-warning) 80%, #ff0000) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-warning) 30%, transparent);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-warning) 40%, transparent);
  }

  .remove-beat-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning) 80%, #ff0000) 0%,
      color-mix(in srgb, var(--semantic-warning) 60%, #ff0000) 100%
    );
    box-shadow: 0 6px 16px
      color-mix(in srgb, var(--semantic-warning) 60%, transparent);
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .panel-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .panel-button {
      width: var(
        --min-touch-target
      ); /* Maintain 48px minimum for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  @media (max-width: 320px) {
    .panel-button {
      width: var(--min-touch-target); /* NEVER below 48px for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-compact);
    }
  }

  /* 🎯 LANDSLOOPE MOBILE: Maintain 48px minimum for accessibility */
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
