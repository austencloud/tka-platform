<!--
  Pending Sequences List

  Left column showing sequences waiting to be rendered.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    onRenderSingle: (sequence: SequenceData) => void;
  }

  let { onRenderSingle }: Props = $props();

  const state = galleryGeneratorState;
</script>

<div class="column pending-column">
  <h2>
    {t('gallery_gen_pending_heading', { count: String(state.pendingSequences.length) })}
    {#if state.renderingSequences.length > 0}
      <span class="rendering-count"
        >· {t('gallery_gen_rendering_count', { count: String(state.renderingSequences.length) })}</span
      >
    {/if}
  </h2>

  {#if state.isLoading}
    <p class="empty-message">{t('gallery_gen_loading')}</p>
  {:else if state.pendingSequences.length === 0}
    <p class="empty-message">{t('gallery_gen_all_rendered')}</p>
  {:else}
    <div class="sequence-list">
      {#each state.pendingSequences.slice(0, 100) as sequence (sequence.id)}
        {@const seqName = sequence.word || sequence.name}
        {@const isRenderingThis = state.isSequenceRendering(seqName)}
        <div class="sequence-item" class:rendering={isRenderingThis}>
          <span class="name">{seqName}</span>
          <span class="meta"
            >L{sequence.level || 1} · {sequence.sequenceLength}b</span
          >
          {#if isRenderingThis}
            <ProgressRing percent={-1} size={24} strokeWidth={2} />
          {:else}
            <button
              class="render-btn"
              onclick={() => onRenderSingle(sequence)}
              disabled={state.isRendering}
              title={t('gallery_gen_render_single')}
            >
              ▶
            </button>
          {/if}
        </div>
      {/each}
      {#if state.pendingSequences.length > 100}
        <p class="more-text">
          {t('gallery_gen_and_more', { count: String(state.pendingSequences.length - 100) })}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .column {
    background: #18181b;
    border-radius: 10px;
    padding: 1rem;
  }

  .column h2 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .rendering-count {
    color: #f43f5e;
    font-weight: 500;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .pending-column {
    max-height: 75vh;
    overflow-y: auto;
  }

  .sequence-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sequence-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    background: #27272a;
    border-radius: 6px;
    font-size: 0.8rem;
    border-left: 2px solid #f59e0b;
  }

  .sequence-item .name {
    flex: 1;
    font-weight: 500;
    color: #e4e4e7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sequence-item .meta {
    font-size: 0.7rem;
    color: #52525b;
  }

  .render-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 0.65rem;
    background: #3f3f46;
    border: none;
    border-radius: 4px;
    color: #a1a1aa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .render-btn:hover:not(:disabled) {
    background: #f43f5e;
    color: white;
  }

  .render-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Rendering state - highlight the item being processed */
  .sequence-item.rendering {
    border-left-color: #f43f5e;
    background: #3f3f46;
  }

  .sequence-item.rendering .name {
    color: #f43f5e;
  }

  .more-text {
    color: #52525b;
    text-align: center;
    padding: 1rem;
    font-size: 0.8rem;
  }

  .empty-message {
    color: #52525b;
    padding: 3rem 2rem;
    text-align: center;
    font-size: 0.875rem;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .rendering-count {
      animation: none;
    }
  }
</style>
