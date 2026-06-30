<!--
  ViewSequenceButton.svelte

  Play/View button that opens the sequence viewer for animation and export.
  Choreographed entrance: hatches from nothing, overshoots, settles, then breathes.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { WORKSPACE_BUTTON_ICON } from "../../workspace-button-layout";

  let { onclick, isActive = false } = $props<{
    onclick?: () => void;
    isActive?: boolean;
  }>();

  // Resolve haptic feedback service
  const hapticService = getHapticFeedback();

  function handleClick() {
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="view-sequence-button glass-button"
  class:active={isActive}
  onclick={handleClick}
  aria-label="View sequence"
  aria-pressed={isActive}
  title="View"
>
  <i class="fa-solid {WORKSPACE_BUTTON_ICON.view.icon}" aria-hidden="true"></i>
</button>

<style>
  .view-sequence-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: linear-gradient(
      135deg,
      var(--semantic-success) 0%,
      color-mix(in srgb, var(--semantic-success) 85%, #059669) 100%
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-success) 40%, transparent);

    /*
      Choreographed entrance:
      1. arrive (400ms) - fade in, gentle scale up
      2. breathe (2.4s) - scale + glow pulse, loops forever
    */
    animation:
      arrive 400ms ease-out both,
      breathe 2.4s ease-in-out 0.5s infinite;
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Gentle breathing - scale + glow expand together */
  @keyframes breathe {
    0%, 100% {
      transform: scale(1);
      box-shadow:
        0 4px 12px color-mix(in srgb, var(--semantic-success) 40%, transparent);
    }
    50% {
      transform: scale(1.06);
      box-shadow:
        0 4px 16px color-mix(in srgb, var(--semantic-success) 50%, transparent),
        0 0 24px color-mix(in srgb, var(--semantic-success) 35%, transparent);
    }
  }

  .view-sequence-button:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-success) 85%, #059669) 0%,
      color-mix(in srgb, var(--semantic-success) 70%, #059669) 100%
    );
    transform: scale(1.1);
    box-shadow:
      0 6px 20px color-mix(in srgb, var(--semantic-success) 60%, transparent),
      0 0 28px color-mix(in srgb, var(--semantic-success) 40%, transparent);
    animation: none;
  }

  .view-sequence-button:active {
    transform: scale(0.92);
    transition: transform 80ms ease;
  }

  .view-sequence-button:focus-visible {
    outline: 2px solid var(--theme-accent, var(--semantic-success));
    outline-offset: 2px;
  }

  .view-sequence-button.active {
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--semantic-success) 70%, transparent);
  }

  .view-sequence-button i {
    font-size: var(--font-size-lg);
  }

  /* Mobile responsive adjustments - ALWAYS 48px minimum per iOS/Android guidelines */
  @media (max-width: 768px) {
    .view-sequence-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 480px) {
    .view-sequence-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    .view-sequence-button i {
      font-size: var(--font-size-base);
    }
  }

  @media (max-width: 320px) {
    .view-sequence-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }

    .view-sequence-button i {
      font-size: var(--font-size-sm);
    }
  }

  /* Landscape mobile: Maintain 48px minimum */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .view-sequence-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }

    .view-sequence-button i {
      font-size: var(--font-size-base);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .view-sequence-button {
      background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
      border: 2px solid
        color-mix(in srgb, var(--semantic-success) 70%, transparent);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .view-sequence-button {
      transition: none;
      animation: none;
    }

    .view-sequence-button:hover {
      transform: none;
    }

    .view-sequence-button:active {
      transform: none;
    }
  }
</style>
