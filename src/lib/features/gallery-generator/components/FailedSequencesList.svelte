<!--
  Failed Sequences List

  Collapsible list of sequences that failed to render.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";

  const state = galleryGeneratorState;
</script>

{#if state.failedSequences.length > 0 && !state.isRendering}
  <details class="failed-section">
    <summary>{t('gallery_gen_failed_heading', { count: String(state.failedSequences.length) })}</summary>
    <div class="failed-list">
      {#each state.failedSequences as failed}
        <div class="failed-item">
          <span class="failed-name">{failed.name}</span>
          <span class="failed-error">{failed.error}</span>
        </div>
      {/each}
    </div>
  </details>
{/if}

<style>
  .failed-section {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .failed-section summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--semantic-error, #f87171);
    font-size: 0.875rem;
  }

  .failed-list {
    margin-top: 0.75rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .failed-item {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--theme-card-bg, #27272a);
  }

  .failed-name {
    color: var(--theme-text-dim, #a1a1aa);
  }

  .failed-error {
    color: var(--semantic-error, #f87171);
    font-size: 0.75rem;
  }
</style>
