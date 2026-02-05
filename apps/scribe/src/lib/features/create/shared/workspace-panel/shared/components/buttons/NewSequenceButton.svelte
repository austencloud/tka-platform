<script lang="ts">
  /**
   * New Sequence Button
   *
   * Button to start a new sequence session.
   * Shows confirmation dialog if current session has unsaved changes.
   *
   * Domain: Create module - Session management
   */

  import { container } from "$lib/shared/di";

  interface Props {
    onclick?: () => void;
    disabled?: boolean;
  }

  const { onclick, disabled = false }: Props = $props();

  const hapticService = container.items.hapticFeedback;

  function handleClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onclick?.();
  }
</script>

<button
  class="panel-button new-sequence-button"
  class:disabled
  onclick={handleClick}
  aria-label="New sequence"
  title="New sequence"
  {disabled}
>
  <i class="fa-solid fa-file-plus" aria-hidden="true"></i>
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

  .panel-button:hover:not(.disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .panel-button:active:not(.disabled) {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .panel-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .new-sequence-button {
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 80%, #764ba2) 100%
    );
    border: 1px solid var(--theme-stroke-strong);
  }

  .new-sequence-button:hover:not(.disabled) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 90%, white) 0%,
      color-mix(in srgb, var(--theme-accent) 70%, #764ba2) 100%
    );
  }

  .panel-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    .panel-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }
</style>
