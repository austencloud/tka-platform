<!--
  RecordVideoButton.svelte

  Opens the video recording drawer from the ButtonPanel. Highlights when the drawer is visible.
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
  class="panel-button record-button"
  class:active={isActive}
  onclick={handleClick}
  aria-pressed={isActive}
  aria-label={isActive ? "Close video recorder" : "Record video"}
  title="Record Video"
  {disabled}
>
  <i class="fas fa-video" aria-hidden="true"></i>
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
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 90%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 90%,
        transparent
      )
    );
    border: 1px solid var(--theme-stroke-strong);
    box-shadow:
      0 2px 8px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 35%,
          transparent
        ),
      0 6px 18px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 25%,
          transparent
        );
  }

  .panel-button:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow:
      0 4px 12px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 45%,
          transparent
        ),
      0 8px 22px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 35%,
          transparent
        );
  }

  .panel-button:active:not(:disabled) {
    transform: scale(0.95);
    transition: all 0.1s ease;
  }

  .panel-button:focus-visible {
    outline: 2px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 70%,
        white
      );
    outline-offset: 2px;
  }

  .panel-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .record-button.active {
    background: linear-gradient(
      135deg,
      var(--semantic-error, var(--semantic-error)),
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 85%,
        #b91c1c
      )
    );
    box-shadow:
      0 4px 14px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 55%,
          transparent
        ),
      0 10px 26px
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 40%,
          transparent
        );
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
