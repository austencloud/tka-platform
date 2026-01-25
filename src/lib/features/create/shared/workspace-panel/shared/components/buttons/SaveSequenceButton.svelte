<!--
  SaveSequencePanelButton.svelte

  Save sequence button for ButtonPanel (panel-style, not floating).
  Saves the current sequence to the Browse.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";

  // Props
  const {
    onclick,
  }: {
    onclick?: () => void;
  } = $props();

  // Services
  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    hapticService?.trigger("success");
    onclick?.();
  }
</script>

<button
  class="panel-button save-button"
  onclick={handleClick}
  aria-label="Save sequence"
  title="Save sequence"
>
  <i class="fa-solid fa-save" aria-hidden="true"></i>
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
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
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

  .save-button {
    background: linear-gradient(
      135deg,
      var(--semantic-success, var(--semantic-success)) 0%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 80%,
          #15803d
        )
        100%
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 30%,
      transparent
    );
    box-shadow: 0 4px 12px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 40%,
        transparent
      );
  }

  .save-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 80%,
          #15803d
        )
        0%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 60%,
          #15803d
        )
        100%
    );
    box-shadow: 0 6px 16px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 60%,
        transparent
      );
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

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .panel-button {
      transition: none;
    }

    .panel-button:hover {
      transform: none;
    }

    .panel-button:active {
      transform: none;
    }
  }
</style>
