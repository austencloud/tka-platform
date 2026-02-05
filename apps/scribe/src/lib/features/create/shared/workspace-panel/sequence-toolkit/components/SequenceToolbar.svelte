<!--
SequenceToolbar.svelte - Integrated Sequence Toolbar

Combines ExportTools and DeleteTools into a unified toolbar.
Pure presentation component that coordinates tool operations.
Transform tools moved to edit tab.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import DeleteTools from "./DeleteTools.svelte";
  import ExportTools from "./ExportTools.svelte";

  let {
    disabled = false,
    hasSelection = false,
    hasSequence = false,
    onDeleteBeat,
    onClearSequence,
    onAddToDictionary,
    onFullscreen,
    onCopyJson,
    renderExtra,
  } = $props<{
    disabled?: boolean;
    hasSelection?: boolean;
    hasSequence?: boolean;
    onDeleteBeat?: () => void;
    onClearSequence?: () => void;
    onAddToDictionary?: () => void;
    onFullscreen?: () => void;
    onCopyJson?: () => void;
    renderExtra?: Snippet;
  }>();
</script>

<div class="sequence-toolbar" aria-label="Sequence Controls">
  <!-- Export Tools -->
  <ExportTools
    {disabled}
    {hasSequence}
    {onCopyJson}
    {onAddToDictionary}
    {onFullscreen}
  />

  <!-- Visual Separator -->
  <div class="separator"></div>

  <!-- Delete Tools -->
  <DeleteTools
    {disabled}
    {hasSelection}
    {hasSequence}
    {onDeleteBeat}
    {onClearSequence}
  />

  {#if renderExtra}
    {@render renderExtra()}
  {/if}
</div>

<style>
  .sequence-toolbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center; /* Center tools vertically */
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    min-width: 80px;
    height: 100%; /* Take full height to enable centering */

    /* Glassmorphism panel styling with reduced opacity to avoid visual conflict */
    background: var(
      --theme-card-bg,
      rgba(255, 255, 255, 0.04)
    ); /* Reduced from 0.08 */
    border: 1px solid var(--theme-stroke); /* More subtle border */
    border-radius: 12px;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.08),
      0 2px 8px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 var(--theme-stroke, var(--theme-card-bg)); /* Reduced shadow intensity */

    /* Position relative for pseudo-element */
    position: relative;
  }

  .sequence-toolbar::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 12px;
    padding: 1px;
    background: linear-gradient(
      135deg,
      var(--theme-stroke),
      var(--theme-card-bg)
    );
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: xor;
    pointer-events: none;
  }

  .separator {
    width: 24px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--theme-stroke-strong),
      transparent
    );
    margin: var(--spacing-xs) 0;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .sequence-toolbar {
      flex-direction: row; /* Horizontal layout on mobile */
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
      min-width: auto;
      height: auto;
      min-height: 60px; /* Ensure adequate touch target height */
    }

    .separator {
      width: 1px;
      height: 24px;
      background: linear-gradient(
        180deg,
        transparent,
        var(--theme-stroke-strong),
        transparent
      );
      margin: 0 var(--spacing-xs);
    }
  }

  /* Ultra-narrow mobile optimization */
  @media (max-width: 480px) {
    .sequence-toolbar {
      gap: var(--spacing-xs);
      padding: var(--spacing-xs);
      min-height: var(--min-touch-target);
    }

    .separator {
      height: 20px;
      margin: 0 2px;
    }
  }

  /* Z Fold 6 cover screen optimization */
  @media (max-width: 320px) {
    .sequence-toolbar {
      gap: 2px;
      padding: 4px;
      min-height: var(--min-touch-target); /* Minimum touch target size */
    }

    .separator {
      display: none; /* Hide separators on very narrow screens */
    }
  }
</style>
