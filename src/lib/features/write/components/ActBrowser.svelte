<!--
  ActBrowser.svelte - Vertical list of saved acts

  Clean sidebar-style browser with act cards.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { ActThumbnailInfo } from "../domain/types/write";
  import ActCard from "./ActCard.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    acts?: ActThumbnailInfo[];
    selectedActId?: string | null;
    isLoading?: boolean;
    onActSelected?: (filePath: string) => void;
    onRefresh?: () => void;
  }

  let {
    acts = [],
    selectedActId = null,
    isLoading = false,
    onActSelected,
    onRefresh,
  }: Props = $props();

  const hapticService = getHapticFeedback();

  function handleRefresh() {
    hapticService?.trigger("selection");
    onRefresh?.();
  }

  function handleActSelected(filePath: string) {
    onActSelected?.(filePath);
  }
</script>

<div class="act-browser">
  <header class="browser-header">
    <h3 class="browser-title">
      <i class="fas fa-folder-open" aria-hidden="true"></i>
      <span>Acts</span>
      <span class="count">{acts.length}</span>
    </h3>
    <button
      class="icon-btn"
      onclick={handleRefresh}
      disabled={isLoading}
      aria-label={isLoading ? "Loading" : "Refresh"}
      title="Refresh"
    >
      <i class="fas fa-sync-alt" class:spinning={isLoading} aria-hidden="true"
      ></i>
    </button>
  </header>

  <div class="browser-content">
    {#if isLoading}
      <div class="state-container">
        <ProgressRing percent={-1} size={24} strokeWidth={2} />
        <p>Loading acts...</p>
      </div>
    {:else if acts.length === 0}
      <div class="state-container">
        <div class="empty-icon">
          <i class="fas fa-theater-masks" aria-hidden="true"></i>
        </div>
        <p class="empty-title">No acts yet</p>
        <p class="empty-hint">Create a new act to get started</p>
      </div>
    {:else}
      <div class="acts-list">
        {#each acts as act (act.id)}
          <ActCard
            actInfo={act}
            isSelected={selectedActId === act.id}
            onSelect={handleActSelected}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .act-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .browser-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .browser-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .browser-title i {
    color: var(--theme-accent, #f43f5e);
    font-size: 0.85rem;
  }

  .count {
    padding: 2px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--border-radius-sm, 6px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .icon-btn i.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .browser-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xs);
  }

  .acts-list {
    display: flex;
    flex-direction: column;
  }

  /* States */
  .state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xl);
    text-align: center;
    min-height: 200px;
  }

  .state-container p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 1.25rem;
  }

  .empty-title {
    font-weight: 500;
    color: var(--theme-text, #ffffff) !important;
  }

  .empty-hint {
    font-size: var(--font-size-compact, 12px) !important;
  }

  /* Scrollbar */
  .browser-content::-webkit-scrollbar {
    width: 6px;
  }

  .browser-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .browser-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .browser-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn,
    .icon-btn i.spinning {
      animation: none;
      transition: none;
    }
  }
</style>
