<!--
DeleteTools.svelte - Sequence Deletion Tools

Handles sequence deletion operations like delete beat and clear sequence.
Pure presentation component that delegates to deletion services.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { Snippet } from "svelte";

  let {
    disabled = false,
    hasSelection = false,
    hasSequence = false,
    onDeleteBeat,
    onClearSequence,
    renderExtra,
  } = $props<{
    disabled?: boolean;
    hasSelection?: boolean;
    hasSequence?: boolean;
    onDeleteBeat?: () => void;
    onClearSequence?: () => void;
    renderExtra?: Snippet;
  }>();

  const hapticService = container.items.hapticFeedback;

  function handleWithSelection(fn?: () => void) {
    if (disabled || !hasSelection) return;
    hapticService?.trigger("warning");
    fn?.();
  }

  function handleWithSequence(fn?: () => void) {
    if (disabled || !hasSequence) return;
    hapticService?.trigger("warning");
    fn?.();
  }
</script>

<div class="delete-tools">
  <button
    type="button"
    class="tool-btn"
    title="Delete Beat"
    disabled={!hasSelection || disabled}
    onclick={() => handleWithSelection(onDeleteBeat)}
  >
    🗑️
  </button>

  <button
    type="button"
    class="tool-btn"
    title="Clear"
    disabled={!hasSequence || disabled}
    onclick={() => handleWithSequence(onClearSequence)}
  >
    🧹
  </button>

  {#if renderExtra}
    {@render renderExtra()}
  {/if}
</div>

<style>
  .delete-tools {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .tool-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-stroke);
    cursor: pointer;
    font-size: var(--font-size-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-normal);
    color: var(--theme-text, var(--theme-text));
    font-weight: 500;

    /* Subtle inner shadow for depth */
    box-shadow:
      inset 0 1px 0 var(--theme-stroke, var(--theme-stroke)),
      0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .tool-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 var(--theme-card-hover-bg),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .tool-btn:active:not(:disabled) {
    background: var(--theme-stroke-strong);
    transform: translateY(0);
    box-shadow:
      inset 0 1px 0 var(--theme-stroke-strong),
      0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .tool-btn:disabled {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: not-allowed;
    transform: none;
    box-shadow: inset 0 1px 0 var(--theme-stroke);
  }

  /* Focus styles for accessibility */
  .tool-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .delete-tools {
      flex-direction: row; /* Horizontal layout on mobile */
      gap: var(--spacing-sm);
    }

    .tool-btn {
      width: var(--min-touch-target); /* Larger touch targets on mobile */
      height: var(--min-touch-target);
      font-size: var(--font-size-lg);
    }
  }

  /* Ultra-narrow mobile optimization */
  @media (max-width: 480px) {
    .delete-tools {
      gap: var(--spacing-xs);
    }

    .tool-btn {
      width: var(--min-touch-target); /* Minimum touch target size */
      height: var(--min-touch-target);
      font-size: var(--font-size-base);
    }
  }

  /* Z Fold 6 cover screen optimization - compact visual with 48px touch target */
  @media (max-width: 320px) {
    .delete-tools {
      gap: 2px;
    }

    .tool-btn {
      width: var(--min-touch-target); /* WCAG AAA touch target */
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
      border-radius: 8px;
      position: relative;
    }

    .tool-btn::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .tool-btn {
      transition: none;
    }

    .tool-btn:hover:not(:disabled),
    .tool-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
