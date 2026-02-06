<!--
ExportTools.svelte - Sequence Export Tools

Handles sequence export operations like copy JSON and Save.
Pure presentation component that delegates to sequence export services.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { Snippet } from "svelte";

  let {
    disabled = false,
    hasSequence = false,
    onCopyJson,
    onAddToDictionary,
    onFullscreen,
    renderExtra,
  } = $props<{
    disabled?: boolean;
    hasSequence?: boolean;
    onCopyJson?: () => void;
    onAddToDictionary?: () => void;
    onFullscreen?: () => void;
    renderExtra?: Snippet;
  }>();

  const hapticService = container.items.hapticFeedback;

  function handle(fn?: () => void) {
    if (disabled) return;
    fn?.();
  }

  function handleWithSequence(fn?: () => void) {
    if (disabled || !hasSequence) return;
    hapticService?.trigger("success");
    fn?.();
  }
</script>

<div class="export-tools">
  <button
    type="button"
    class="tool-btn"
    title="Copy JSON"
    disabled={!hasSequence || disabled}
    onclick={() => handleWithSequence(onCopyJson)}
  >
    📋
  </button>

  <button
    type="button"
    class="tool-btn"
    title="Save"
    disabled={!hasSequence || disabled}
    onclick={() => handleWithSequence(onAddToDictionary)}
  >
    📚
  </button>

  <button
    type="button"
    class="tool-btn"
    title="Fullscreen View"
    onclick={() => handle(onFullscreen)}
  >
    👁️
  </button>

  {#if renderExtra}
    {@render renderExtra()}
  {/if}
</div>

<style>
  .export-tools {
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
    .export-tools {
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
    .export-tools {
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
    .export-tools {
      gap: 2px;
    }

    .tool-btn {
      width: 48px; /* WCAG AAA touch target */
      height: 48px;
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
