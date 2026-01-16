<!--
  MediaSequenceCard.svelte - Individual sequence card in media browser grid
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequence: SequenceData;
    coverUrl?: string;
    isLoading?: boolean;
    disabled?: boolean;
    onclick: () => void;
    ondragstart: (e: DragEvent) => void;
  }

  let {
    sequence,
    coverUrl,
    isLoading = false,
    disabled = false,
    onclick,
    ondragstart,
  }: Props = $props();

  const hasVideo = $derived(!!sequence?.performanceVideoUrl);
  const displayName = $derived(sequence.word || sequence.name || "Unnamed");
  const beatCount = $derived(sequence.beats?.length);
</script>

<button
  class="sequence-item"
  class:loading={isLoading}
  {onclick}
  title="{displayName} - Click to preview, drag to timeline"
  {disabled}
  draggable="true"
  {ondragstart}
>
  <div class="item-thumb">
    {#if coverUrl}
      <img src={coverUrl} alt={displayName} loading="lazy" />
    {:else}
      <div class="placeholder-thumb">
        <i class="fas fa-film" aria-hidden="true"></i>
      </div>
    {/if}
    {#if hasVideo}
      <div class="video-badge">
        <i class="fas fa-video" aria-hidden="true"></i>
      </div>
    {/if}
    {#if isLoading}
      <div class="loading-overlay">
        <div class="spinner small"></div>
      </div>
    {/if}
  </div>
  <span class="item-name">{displayName}</span>
  {#if beatCount}
    <span class="item-meta">{beatCount} beats</span>
  {/if}
</button>

<style>
  .sequence-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .sequence-item:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.03);
  }

  .sequence-item:hover:not(:disabled) .item-thumb {
    border-color: var(--theme-accent);
    box-shadow:
      0 6px 20px var(--theme-shadow),
      0 0 16px color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .sequence-item:disabled {
    cursor: wait;
  }

  .sequence-item.loading {
    opacity: 0.6;
  }

  .item-thumb {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid var(--theme-stroke);
    transition: all 0.2s ease;
    background: var(--theme-card-bg);
  }

  .item-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-thumb {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-elevated-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-2xl);
  }

  .video-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.95) 0%,
      rgba(220, 38, 38, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    color: white;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .item-name {
    font-size: var(--font-size-compact);
    color: var(--theme-text);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 2px;
  }

  .item-meta {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner.small {
    width: 18px;
    height: 18px;
    border-width: 2px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
