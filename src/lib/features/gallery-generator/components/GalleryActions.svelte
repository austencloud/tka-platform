<!--
  Gallery Actions

  Action buttons for rendering and writing.
-->
<script lang="ts">
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";

  interface Props {
    onRenderAll: () => void;
    onWriteAll: () => void;
    onUploadToCloud: () => void;
    onClear: () => void;
    onCancel: () => void;
  }

  let { onRenderAll, onWriteAll, onUploadToCloud, onClear, onCancel }: Props =
    $props();

  const state = galleryGeneratorState;
</script>

<div class="actions">
  {#if state.isRendering}
    <button class="action-btn cancel" onclick={onCancel}> Cancel </button>
  {:else}
    <button
      class="action-btn primary"
      onclick={onRenderAll}
      disabled={state.isLoading || state.pendingSequences.length === 0}
    >
      {#if state.pendingSequences.length === state.sequences.length}
        Render All ({state.pendingSequences.length})
      {:else if state.pendingSequences.length > 0}
        Resume ({state.pendingSequences.length} pending)
      {:else}
        All Rendered!
      {/if}
    </button>
  {/if}

  {#if state.hasResults && !state.isRendering}
    <button class="action-btn secondary" onclick={onClear}> Clear </button>
  {/if}

  {#if state.previewCount > 0 && !state.isRendering}
    <button class="action-btn success" onclick={onWriteAll}>
      Write {state.previewCount} to Gallery
    </button>
  {/if}

  {#if state.renderedImages.length > 0 && !state.isRendering && state.selectedPropType}
    <button class="action-btn cloud" onclick={onUploadToCloud}>
      ☁️ Upload {state.renderedImages.length} to Cloud
    </button>
  {/if}
</div>

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-instant) ease;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: #f43f5e;
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: #e11d48;
  }

  .action-btn.cancel {
    background: #dc2626;
    color: white;
  }

  .action-btn.success {
    background: #22c55e;
    color: white;
  }

  .action-btn.success:hover:not(:disabled) {
    background: #16a34a;
  }

  .action-btn.secondary {
    background: #27272a;
    color: #a1a1aa;
  }

  .action-btn.secondary:hover:not(:disabled) {
    background: #3f3f46;
    color: #e4e4e7;
  }

  .action-btn.cloud {
    background: #3b82f6;
    color: white;
  }

  .action-btn.cloud:hover:not(:disabled) {
    background: #2563eb;
  }
</style>
