<!--
  ActCard.svelte - Clean list-style act card

  Simple card showing act name, description, and metadata.
  No fake thumbnails - just clean typography and icons.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { ActThumbnailInfo } from "../domain/types/write";
  import { onMount } from "svelte";

  interface Props {
    actInfo: ActThumbnailInfo;
    isSelected?: boolean;
    onSelect?: (filePath: string) => void;
  }

  let { actInfo, isSelected = false, onSelect }: Props = $props();

  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  function handleClick() {
    hapticService?.trigger("selection");
    if (actInfo.filePath) {
      onSelect?.(actInfo.filePath);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }

  function formatDate(date: Date | undefined): string {
    if (!date) return "No date";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }
</script>

<button
  class="act-card"
  class:selected={isSelected}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  aria-label="Select act {actInfo.name}"
  aria-pressed={isSelected}
  type="button"
>
  <div class="card-icon">
    <i class="fas fa-theater-masks" aria-hidden="true"></i>
  </div>

  <div class="card-content">
    <div class="card-header">
      <h4 class="card-title">{actInfo.name}</h4>
      {#if actInfo.hasMusic}
        <span class="music-badge" title="Has music">
          <i class="fas fa-music" aria-hidden="true"></i>
        </span>
      {/if}
    </div>

    {#if actInfo.description}
      <p class="card-description">{actInfo.description}</p>
    {/if}

    <div class="card-meta">
      <span class="meta-item">
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        {actInfo.sequenceCount}
        {actInfo.sequenceCount === 1 ? "sequence" : "sequences"}
      </span>
      <span class="meta-separator">·</span>
      <span class="meta-item">
        {formatDate(actInfo.lastModified)}
      </span>
    </div>
  </div>
</button>

<style>
  .act-card {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
  }

  .act-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .act-card.selected {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .act-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .card-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-accent, #f43f5e);
    font-size: 1rem;
  }

  .selected .card-icon {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .card-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .card-title {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .music-badge {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 20%,
      transparent
    );
    border-radius: 50%;
    color: var(--semantic-success, #22c55e);
    font-size: 0.6rem;
  }

  .card-description {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-item i {
    font-size: 0.65rem;
    opacity: 0.7;
  }

  .meta-separator {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .act-card {
      transition: none;
    }
  }
</style>
