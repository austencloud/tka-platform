<!--
  Gallery Actions

  Action buttons for rendering and writing.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
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
    <button class="action-btn cancel" onclick={onCancel}> {t('gallery_gen_cancel')} </button>
  {:else}
    <button
      class="action-btn primary"
      onclick={onRenderAll}
      disabled={state.isLoading || state.pendingSequences.length === 0}
    >
      {#if state.pendingSequences.length === state.sequences.length}
        {t('gallery_gen_render_all', { count: String(state.pendingSequences.length) })}
      {:else if state.pendingSequences.length > 0}
        {t('gallery_gen_resume', { count: String(state.pendingSequences.length) })}
      {:else}
        {t('gallery_gen_all_rendered')}
      {/if}
    </button>
  {/if}

  {#if state.hasResults && !state.isRendering}
    <button class="action-btn secondary" onclick={onClear}> {t('gallery_gen_clear')} </button>
  {/if}

  {#if state.previewCount > 0 && !state.isRendering}
    <button class="action-btn success" onclick={onWriteAll}>
      {t('gallery_gen_write_to_gallery', { count: String(state.previewCount) })}
    </button>
  {/if}

  {#if state.renderedImages.length > 0 && !state.isRendering && state.selectedPropType}
    <button class="action-btn cloud" onclick={onUploadToCloud}>
      {t('gallery_gen_upload_to_cloud', { count: String(state.renderedImages.length) })}
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
    background: var(--theme-accent, #f43f5e);
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--theme-accent-strong, #e11d48);
  }

  .action-btn.cancel {
    background: var(--semantic-error, #dc2626);
    color: white;
  }

  .action-btn.success {
    background: var(--semantic-success, #22c55e);
    color: white;
  }

  .action-btn.success:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 80%, black);
  }

  .action-btn.secondary {
    background: var(--theme-card-bg, #27272a);
    color: var(--theme-text-dim, #a1a1aa);
  }

  .action-btn.secondary:hover:not(:disabled) {
    background: var(--theme-stroke, #3f3f46);
    color: var(--theme-text, #e4e4e7);
  }

  .action-btn.cloud {
    background: var(--semantic-info, #3b82f6);
    color: white;
  }

  .action-btn.cloud:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 82%, black);
  }
</style>
