<!--
  SpotlightButton.svelte

  Triggers spotlight mode to enlarge the selected step for detailed viewing.
  Replaces the long-press gesture on StepCell for better browseability.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";

  let { onclick, disabled = false } = $props<{
    onclick?: () => void;
    disabled?: boolean;
  }>();

  // Resolve haptic feedback service
  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="spotlight-button glass-button"
  class:disabled
  onclick={handleClick}
  aria-label="Spotlight selected step"
  title="Spotlight"
  data-testid="spotlight-button"
  {disabled}
>
  <i class="fas fa-expand" aria-hidden="true"></i>
</button>

<style>
  .spotlight-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, #a855f7) 30%,
        transparent
      );
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.8) 0%,
      rgba(139, 92, 246, 0.8) 100%
    );
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
  }

  .spotlight-button:hover:not(.disabled) {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.9) 0%,
      rgba(124, 58, 237, 0.9) 100%
    );
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(168, 85, 247, 0.6);
  }

  .spotlight-button:active:not(.disabled) {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .spotlight-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .spotlight-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .spotlight-button i {
    font-size: var(--font-size-lg);
  }

  /* Mobile responsive - 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .spotlight-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .spotlight-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .spotlight-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  /* Landscape mobile: Maintain 48px minimum */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .spotlight-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    .spotlight-button i {
      font-size: var(--font-size-base);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .spotlight-button {
      background: var(--theme-card-hover-bg);
      border: 2px solid var(--theme-stroke-strong);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-button {
      transition: none;
    }

    .spotlight-button:hover {
      transform: none;
    }

    .spotlight-button:active {
      transform: none;
    }
  }
</style>
