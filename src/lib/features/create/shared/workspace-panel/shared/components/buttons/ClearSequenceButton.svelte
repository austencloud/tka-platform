<!--
  ClearSequencePanelButton.svelte

  Clear sequence button for ButtonPanel (panel-style, not floating).
  Clears the entire sequence when clicked.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { WORKSPACE_BUTTON_ICON } from "../../workspace-button-layout";

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
  class="panel-button clear-button"
  data-testid="clear-sequence-button"
  data-ghost="safe"
  data-ghost-kind="clear"
  data-ghost-label="Clear sequence"
  onclick={handleClick}
  aria-label="Clear sequence"
  title="Clear sequence"
>
  <i class="fa-solid {WORKSPACE_BUTTON_ICON.clear.icon}" aria-hidden="true"></i>
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

  .clear-button {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 80%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
    box-shadow: 0 4px 12px
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 40%,
        transparent
      );
  }

  .clear-button:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 90%,
      transparent
    );
    box-shadow: 0 6px 16px
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 60%,
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
