<!-- StorageSection.svelte - Cache clearing controls + offline download -->
<script lang="ts">

import { getOfflineCacheOrchestrator } from "$lib/shared/offline/get-offline-cache-orchestrator";
  import { onMount } from "svelte";
  import GlassCard from "./GlassCard.svelte";

  import type { OfflineCacheStats } from "$lib/shared/offline/domain/offline-cache-types";

  interface Props {
    onClearCache: () => Promise<void>;
    isClearing: boolean;
  }

  let { onClearCache, isClearing }: Props = $props();

  let offlineStats = $state<OfflineCacheStats | null>(null);
  let isDownloading = $state(false);
  let downloadError = $state<string | null>(null);

  const orchestrator = getOfflineCacheOrchestrator();

  onMount(() => {
    loadOfflineStats();
  });

  async function loadOfflineStats() {
    try {
      offlineStats = await orchestrator.getCacheStats();
    } catch {
      offlineStats = null;
    }
  }

  async function handleDownloadForOffline() {
    isDownloading = true;
    downloadError = null;
    try {
      await orchestrator.downloadForOffline();
      offlineStats = await orchestrator.getCacheStats();
    } catch (err) {
      downloadError = err instanceof Error ? err.message : "Download failed";
    } finally {
      isDownloading = false;
    }
  }

  async function handleClearOfflineCache() {
    await orchestrator.clearOfflineCache();
    offlineStats = await orchestrator.getCacheStats();
  }

  async function handleClearCache() {
    await handleClearOfflineCache();
    await onClearCache();
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
</script>

<GlassCard
  icon="fas fa-database"
  title="Storage"
  subtitle="Manage local cached data"
>
  {#snippet children()}
    <div class="storage-content">
      <!-- Offline status indicator -->
      <div class="offline-status">
        {#if offlineStats?.isOfflineReady}
          <span class="status-badge ready">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
            Offline ready
          </span>
        {:else}
          <span class="status-badge not-cached">
            <i class="fas fa-cloud-download-alt" aria-hidden="true"></i>
            Not cached for offline
          </span>
        {/if}
      </div>

      <!-- Cache stats -->
      {#if offlineStats}
        <div class="cache-stats">
          <div class="stat-row">
            <span class="stat-label">Gallery sequences</span>
            <span class="stat-value">{offlineStats.gallerySequenceCount.toLocaleString()}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Thumbnails cached</span>
            <span class="stat-value">
              {offlineStats.thumbnailsCached.toLocaleString()}
              {#if offlineStats.thumbnailsSizeBytes > 0}
                <span class="stat-size">({formatBytes(offlineStats.thumbnailsSizeBytes)})</span>
              {/if}
            </span>
          </div>
        </div>
      {/if}

      <!-- Download for offline button -->
      <button
        class="action-btn download-btn"
        onclick={handleDownloadForOffline}
        disabled={isDownloading || offlineStats?.isOfflineReady === true}
      >
        <i class="fas {isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}" aria-hidden="true"></i>
        <span>
          {#if isDownloading}
            Downloading...
          {:else if offlineStats?.isOfflineReady}
            Already downloaded
          {:else}
            Download for offline
          {/if}
        </span>
      </button>

      {#if downloadError}
        <p class="error-text">{downloadError}</p>
      {/if}

      <p class="hint-text">
        Downloads all gallery sequences and thumbnails so the browse gallery works without internet.
      </p>

      <!-- Clear Cache button -->
      <button class="action-btn" onclick={handleClearCache} disabled={isClearing}>
        <i class="fas fa-broom" aria-hidden="true"></i>
        <span>{isClearing ? "Clearing..." : "Clear Cache"}</span>
      </button>
      <p class="hint-text">
        Clears IndexedDB, localStorage, and cookies. Your cloud data is safe.
      </p>
    </div>
  {/snippet}
</GlassCard>

<style>
  .storage-content {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  /* ========================================
     OFFLINE STATUS INDICATOR
     ======================================== */
  .offline-status {
    display: flex;
    align-items: center;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 20px;
  }

  .status-badge.ready {
    color: var(--semantic-success);
    background: color-mix(in srgb, var(--semantic-success) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 30%, transparent);
  }

  .status-badge.not-cached {
    color: var(--theme-text-dim);
    background: color-mix(in srgb, var(--theme-text-dim) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-text-dim) 20%, transparent);
  }

  /* ========================================
     CACHE STATS
     ======================================== */
  .cache-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: clamp(8px, 2cqi, 10px) clamp(10px, 2.5cqi, 14px);
    background: color-mix(in srgb, var(--theme-text) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.1)) 60%, transparent);
    border-radius: clamp(6px, 1.5cqi, 8px);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .stat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  .stat-value {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text);
    font-weight: 500;
  }

  .stat-size {
    font-weight: 400;
    color: var(--theme-text-dim);
  }

  /* ========================================
     BUTTONS
     ======================================== */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2cqi, 10px);
    width: 100%;
    min-height: var(--min-touch-target);
    padding: clamp(12px, 2.5cqi, 14px) clamp(16px, 3cqi, 24px);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: clamp(8px, 2cqi, 10px);
    color: var(--theme-accent);
    font-size: clamp(14px, 2.5cqi, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .action-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Download button uses a more prominent accent style */
  .download-btn {
    background: color-mix(in srgb, var(--semantic-success, #4caf50) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #4caf50) 40%, transparent);
    color: var(--semantic-success, #4caf50);
  }

  .download-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success, #4caf50) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #4caf50) 60%, transparent);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--semantic-success, #4caf50) 20%, transparent);
  }

  .download-btn:focus-visible {
    outline-color: var(--semantic-success, #4caf50);
  }

  /* ========================================
     TEXT
     ======================================== */
  .hint-text {
    font-size: clamp(11px, 2cqi, 13px);
    color: var(--theme-text-dim);
    margin: 0;
    line-height: 1.5;
  }

  .error-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error);
    margin: 0;
    line-height: 1.5;
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }

    .action-btn:hover:not(:disabled) {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .action-btn {
      border-width: 2px;
    }

    .status-badge {
      border-width: 2px;
    }
  }
</style>
