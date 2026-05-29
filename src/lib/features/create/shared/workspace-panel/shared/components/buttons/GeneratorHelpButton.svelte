<!--
  GeneratorHelpButton.svelte

  Help button for generator settings - triggers help mode.
  Only shown on mobile (desktop has help button in the panel).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

  // Props
  const {
    onclick,
  }: {
    onclick?: () => void;
  } = $props();

  // Services
  const hapticService = getHapticFeedback();

  function handleClick() {
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="panel-button help-button"
  onclick={handleClick}
  aria-label="Help with generator settings"
  title="Help with generator settings"
>
  <i class="fas fa-circle-question" aria-hidden="true"></i>
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
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
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
    transition: all var(--duration-instant) ease;
  }

  .panel-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .help-button {
    background: color-mix(
      in srgb,
      var(--semantic-info, #3b82f6) 70%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, #3b82f6) 40%,
      transparent
    );
    box-shadow: 0 4px 12px
      color-mix(
        in srgb,
        var(--semantic-info, #3b82f6) 30%,
        transparent
      );
  }

  .help-button:hover {
    background: color-mix(
      in srgb,
      var(--semantic-info, #3b82f6) 85%,
      transparent
    );
    box-shadow: 0 6px 16px
      color-mix(
        in srgb,
        var(--semantic-info, #3b82f6) 50%,
        transparent
      );
  }

  /* Mobile responsive - 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .panel-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .panel-button {
      width: var(--min-touch-target); /* Maintain 48px minimum */
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .panel-button {
      width: var(--min-touch-target); /* NEVER below 48px for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  /* Landscape mobile: Maintain 48px minimum for accessibility */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .panel-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }
</style>
