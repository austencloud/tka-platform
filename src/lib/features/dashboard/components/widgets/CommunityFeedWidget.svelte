<script lang="ts">
  /**
   * CommunityFeedWidget - Recent sequences from the community
   * Shows recently published sequences from other users
   */

  import { onMount } from "svelte";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  // State
  let isLoading = $state(true);
  let recentSequences = $state<SequenceData[]>([]);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const loader = tryResolve<IDiscoverLoader>(TYPES.IDiscoverLoader);
      if (loader) {
        const allSequences = await loader.loadSequenceMetadata();
        // Filter to sequences from other users and sort by most recent
        const currentUserId = authState.user?.uid;
        recentSequences = allSequences
          .filter((seq) => seq.ownerId !== currentUserId)
          .sort((a, b) => {
            const aDate =
              a.dateAdded instanceof Date
                ? a.dateAdded
                : new Date(a.dateAdded || 0);
            const bDate =
              b.dateAdded instanceof Date
                ? b.dateAdded
                : new Date(b.dateAdded || 0);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, 6); // Show up to 6 recent sequences
      }
    } catch (e) {
      console.warn("[CommunityFeed] Failed to load sequences:", e);
      error = "Unable to load community feed";
    } finally {
      isLoading = false;
    }
  });

  function getThumbnailUrl(seq: SequenceData): string | null {
    if (seq.thumbnails && seq.thumbnails.length > 0) {
      return seq.thumbnails[0] ?? null;
    }
    return null;
  }

  async function viewSequence(seq: SequenceData) {
    await handleModuleChange("discover", "gallery");
  }

  async function viewAll() {
    await handleModuleChange("discover", "gallery");
  }
</script>

<div class="community-widget">
  <div class="widget-header">
    <div class="header-icon">
      <i class="fas fa-globe" aria-hidden="true"></i>
    </div>
    <h3>New from Community</h3>
  </div>

  <div class="widget-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton-grid">
          {#each Array(4) as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      </div>
    {:else if error}
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>{error}</p>
      </div>
    {:else if recentSequences.length === 0}
      <div class="empty-state">
        <i class="fas fa-users" aria-hidden="true"></i>
        <p>No community sequences yet</p>
        <span class="empty-hint">Be the first to share!</span>
      </div>
    {:else}
      <div class="sequence-grid">
        {#each recentSequences as seq}
          {@const thumbnail = getThumbnailUrl(seq)}
          <button class="sequence-card" onclick={() => viewSequence(seq)}>
            <div class="card-thumbnail">
              {#if thumbnail}
                <img
                  src={thumbnail}
                  alt={seq.word || "Sequence"}
                  loading="lazy"
                />
              {:else}
                <div class="thumbnail-placeholder">
                  <i class="fas fa-layer-group" aria-hidden="true"></i>
                </div>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <button class="view-all-btn" onclick={viewAll}>
    <span>Explore Gallery</span>
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .community-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: 24px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 24px;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .widget-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      var(--theme-card-bg)
    );
    border-radius: 14px;
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-lg);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .widget-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }

  /* Loading skeleton */
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    width: 100%;
  }

  .skeleton-card {
    aspect-ratio: 1;
    background: linear-gradient(
      90deg,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        25%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        )
        50%,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 8%,
          transparent
        )
        75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite ease-in-out;
    border-radius: 12px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 20px;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 40%,
      transparent
    );
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-text, var(--theme-text));
  }

  .empty-hint {
    font-size: 0.8125rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Sequence grid */
  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 120px));
    gap: 12px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    justify-content: center;
  }

  .sequence-card {
    position: relative;
    aspect-ratio: 1;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 10%,
      transparent
    );
    border: 1px solid transparent;
  }

  .sequence-card:hover {
    transform: scale(1.03);
    box-shadow: 0 4px 16px var(--theme-shadow);
    border-color: var(--theme-accent, var(--theme-accent));
  }

  .card-thumbnail {
    width: 100%;
    height: 100%;
  }

  .card-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 15%,
      transparent
    );
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-2xl);
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      color-mix(in srgb, var(--theme-accent, var(--theme-accent)) 80%, black)
        100%
    );
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    margin-top: auto;
  }

  .view-all-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .view-all-btn i {
    font-size: var(--font-size-sm);
  }

  @media (max-width: 768px) {
    .community-widget {
      padding: 20px;
      border-radius: 20px;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
    }

    .widget-header h3 {
      font-size: 1rem;
    }

    .sequence-grid {
      grid-template-columns: repeat(2, minmax(80px, 120px));
    }

    .view-all-btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-card {
      animation: none;
      background: rgba(99, 102, 241, 0.1);
    }

    .sequence-card,
    .view-all-btn {
      transition: none;
    }

    .sequence-card:hover,
    .view-all-btn:hover {
      transform: none;
    }
  }
</style>
