<!--
  ShareHubButton.svelte

  Share Hub button that opens the unified sharing drawer with multiple export formats.
  4th button in Create module button panel (alongside Play, Image, Record).
-->
<script lang="ts">
  import { container } from "$lib/shared/di";

  let { onclick, isActive = false } = $props<{
    onclick?: () => void;
    isActive?: boolean;
  }>();

  // Resolve haptic feedback service
  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="share-hub-button glass-button"
  class:active={isActive}
  onclick={handleClick}
  aria-label="Open Share Hub"
  aria-pressed={isActive}
  title="Export"
>
  <i class="fas fa-photo-film" aria-hidden="true"></i>
</button>

<style>
  .share-hub-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: linear-gradient(
      135deg,
      var(--semantic-success) 0%,
      color-mix(in srgb, var(--semantic-success) 85%, #059669) 100%
    ); /* Green gradient (matches composite format) */
    border: 1px solid
      color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-success) 40%, transparent);
  }

  .share-hub-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-success) 85%, #059669) 0%,
      color-mix(in srgb, var(--semantic-success) 70%, #059669) 100%
    );
    transform: scale(1.05);
    box-shadow: 0 6px 16px
      color-mix(in srgb, var(--semantic-success) 60%, transparent);
  }

  .share-hub-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .share-hub-button:focus-visible {
    outline: 2px solid var(--theme-accent, var(--semantic-success));
    outline-offset: 2px;
  }

  .share-hub-button.active {
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--semantic-success) 70%, transparent);
  }

  .share-hub-button i {
    font-size: var(--font-size-lg);
  }

  /* Mobile responsive adjustments - ALWAYS 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .share-hub-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .share-hub-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    .share-hub-button i {
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .share-hub-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    .share-hub-button i {
      font-size: var(--font-size-sm);
    }
  }

  /* Landscape mobile: Maintain 48px minimum */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .share-hub-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    .share-hub-button i {
      font-size: var(--font-size-base);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .share-hub-button {
      background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
      border: 2px solid
        color-mix(in srgb, var(--semantic-success) 70%, transparent);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .share-hub-button {
      transition: none;
    }

    .share-hub-button:hover {
      transform: none;
    }

    .share-hub-button:active {
      transform: none;
    }
  }
</style>
