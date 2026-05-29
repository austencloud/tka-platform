<!--
  SequenceActionsButton.svelte

  Opens a sheet with various sequence actions (Animate, Mirror, Rotate, etc.)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";

  let { onclick } = $props<{
    onclick?: () => void;
  }>();

  // Resolve haptic feedback service
  const hapticService = getHapticFeedback();

  function handleClick() {
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="sequence-actions-button glass-button"
  onclick={handleClick}
  aria-label="Sequence actions"
  title="Sequence actions"
  data-testid="sequence-actions-button"
>
  <i class="fas fa-tools" aria-hidden="true"></i>
</button>

<style>
  .sequence-actions-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 30%,
        transparent
      );
    background: linear-gradient(
      135deg,
      var(--semantic-success, var(--semantic-success)) 0%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #16a34a
        )
        100%
    );
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    box-shadow: 0 4px 12px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 40%,
        transparent
      );
  }

  .sequence-actions-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 85%,
          #16a34a
        )
        0%,
      color-mix(
          in srgb,
          var(--semantic-success, var(--semantic-success)) 70%,
          #16a34a
        )
        100%
    );
    transform: scale(1.05);
    box-shadow: 0 6px 16px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 60%,
        transparent
      );
  }

  .sequence-actions-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .sequence-actions-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .sequence-actions-button i {
    font-size: var(--font-size-lg);
  }

  /* Mobile responsive - 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .sequence-actions-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .sequence-actions-button {
      width: var(--min-touch-target); /* Maintain 48px minimum */
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .sequence-actions-button {
      width: var(--min-touch-target); /* NEVER below 48px for accessibility */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  /* Landscape mobile: Maintain 48px minimum */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .sequence-actions-button {
      width: var(
        --min-touch-target
      ); /* Maintain 48px minimum for accessibility */
      height: var(--min-touch-target);
    }

    .sequence-actions-button i {
      font-size: var(--font-size-base);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .sequence-actions-button {
      background: var(--theme-card-hover-bg);
      border: 2px solid var(--theme-stroke-strong);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sequence-actions-button {
      transition: none;
    }

    .sequence-actions-button:hover {
      transform: none;
    }

    .sequence-actions-button:active {
      transform: none;
    }
  }
</style>
