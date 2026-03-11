<!--
  Gallery Stats

  Summary statistics display.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";

  const state = galleryGeneratorState;
</script>

<div class="summary-stats">
  <span class="stat pending">{t('gallery_gen_stat_pending', { count: String(state.pendingSequences.length) })}</span>
  <span class="stat completed">{t('gallery_gen_stat_rendered', { count: String(state.renderedImages.length) })}</span>
  {#if state.previewCount > 0}
    <span class="stat preview">{t('gallery_gen_stat_to_write', { count: String(state.previewCount) })}</span>
  {/if}
  {#if state.failedSequences.length > 0}
    <span class="stat failed">{t('gallery_gen_stat_failed', { count: String(state.failedSequences.length) })}</span>
  {/if}
</div>

<style>
  .summary-stats {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .stat {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .stat.pending {
    background: #422006;
    color: #fbbf24;
  }

  .stat.completed {
    background: #052e16;
    color: #4ade80;
  }

  .stat.preview {
    background: #172554;
    color: #60a5fa;
  }

  .stat.failed {
    background: #450a0a;
    color: #f87171;
  }
</style>
