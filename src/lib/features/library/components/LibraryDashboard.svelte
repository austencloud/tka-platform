<!--
  LibraryDashboard.svelte - Dashboard View for Library Module

  A landing page showing quick access to:
  - Recent Sequences (with "See All" link)
  - Collections (with "See All" link)
  - Acts (with "See All" link)

  Uses a grid layout with cards for each section.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    libraryState,
    type LibraryViewSection,
  } from "../state/library-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import SequenceCard from "../../discover/gallery/display/components/SequenceCard/SequenceCard.svelte";
  import type { LibrarySequence } from "../domain/models/LibrarySequence";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { goto } from "$app/navigation";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import CollaborativeVideoCard from "$lib/shared/video-collaboration/components/CollaborativeVideoCard.svelte";
  import ActivityTimeline from "./ActivityTimeline.svelte";
  import SequenceAnalyticsBadge from "./SequenceAnalyticsBadge.svelte";

  interface Props {
    onNavigate?: (section: LibraryViewSection) => void;
  }

  let { onNavigate }: Props = $props();

  // Derived state
  const isLoading = $derived(libraryState.isLoading);
  const error = $derived(libraryState.error);
  const isAuthenticated = $derived(!!authState.effectiveUserId);

  // Recent sequences (last 8, sorted by update time)
  const recentSequences = $derived(() => {
    const sequences = [...libraryState.sequences];
    return sequences
      .sort((a, b) => {
        const aTime = a.updatedAt?.getTime() ?? 0;
        const bTime = b.updatedAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  });

  // Favorites (last 4)
  const favoriteSequences = $derived(() => {
    return libraryState.sequences.filter((s) => s.isFavorite).slice(0, 4);
  });

  // Stats
  const totalSequences = $derived(libraryState.sequences.length);
  const publicCount = $derived(
    libraryState.sequences.filter((s) => s.visibility === "public").length
  );
  const totalFavorites = $derived(
    libraryState.sequences.filter((s) => s.isFavorite).length
  );

  // Aggregate analytics
  const totalViews = $derived(
    libraryState.sequences.reduce((sum, s) => sum + (s.viewCount || 0), 0)
  );
  const totalForks = $derived(
    libraryState.sequences.reduce((sum, s) => sum + (s.forkCount || 0), 0)
  );

  // Created this week
  const createdThisWeek = $derived(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return libraryState.sequences.filter(
      (s) => s.createdAt && s.createdAt.getTime() >= weekAgo.getTime()
    );
  });

  // Video state
  let videoService = $state<ICollaborativeVideoManager | null>(null);
  let videos = $state<CollaborativeVideo[]>([]);
  let videosLoading = $state(false);

  const recentVideos = $derived(() => {
    return videos.slice(0, 4);
  });

  const totalVideos = $derived(videos.length);

  async function loadVideos() {
    if (!videoService || !authState.effectiveUserId) return;

    videosLoading = true;
    try {
      const library = await videoService.getUserVideoLibrary();
      videos = [...library.created, ...library.collaborations].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (e) {
      console.error("Failed to load videos:", e);
    } finally {
      videosLoading = false;
    }
  }

  // Navigation handlers
  function handleSeeAllSequences() {
    onNavigate?.("sequences");
  }

  function handleSeeAllFavorites() {
    onNavigate?.("favorites");
  }

  function handleSeeAllVideos() {
    onNavigate?.("videos");
  }

  function handleVideoClick(video: CollaborativeVideo) {
    // TODO: Open video player or detail view
  }

  function handleSequenceClick(sequence: SequenceData) {
    // Navigate to sequence viewer
    goto(`/sequence?id=${sequence.id}`);
  }

  function getCoverUrl(sequence: LibrarySequence): string | undefined {
    return sequence.thumbnails?.[0];
  }

  // Track previous auth state to detect changes
  let prevIsAuthenticated: boolean | undefined;

  // Initialize on mount
  onMount(() => {
    prevIsAuthenticated = isAuthenticated;
    videoService = tryResolve<ICollaborativeVideoManager>(
      TYPES.ICollaborativeVideoManager
    );
    if (isAuthenticated) {
      libraryState.initialize();
      loadVideos();
    }
  });

  onDestroy(() => {
    libraryState.dispose();
  });

  // Re-initialize only when auth state CHANGES (not on every render)
  $effect(() => {
    const currentAuth = isAuthenticated;
    // Skip if this is the initial run (handled by onMount)
    if (prevIsAuthenticated === undefined) {
      return;
    }
    // Only act if auth state actually changed
    if (currentAuth !== prevIsAuthenticated) {
      prevIsAuthenticated = currentAuth;
      if (currentAuth) {
        libraryState.initialize();
        loadVideos();
      } else {
        libraryState.reset();
        videos = [];
      }
    }
  });
</script>

<div class="library-dashboard">
  {#if !isAuthenticated}
    <div class="auth-required">
      <i class="fas fa-lock" aria-hidden="true"></i>
      <h2>Sign In Required</h2>
      <p>Please sign in to access your personal library.</p>
    </div>
  {:else if isLoading}
    <div
      class="loading-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="spinner" aria-hidden="true"></div>
      <p>Loading your library...</p>
    </div>
  {:else if error}
    <div class="error-state" role="alert" aria-live="assertive">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <h2>Error Loading Library</h2>
      <p>{error}</p>
      <button class="retry-btn" onclick={() => libraryState.initialize()}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        Retry
      </button>
    </div>
  {:else}
    <!-- Dashboard Content -->
    <div class="dashboard-content">
      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-value">{totalSequences}</span>
          <span class="stat-label">Sequences</span>
        </div>
        <div class="stat-item highlight">
          <span class="stat-value">{publicCount}</span>
          <span class="stat-label">Published</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{totalFavorites}</span>
          <span class="stat-label">Favorites</span>
        </div>
        {#if totalViews > 0}
          <div class="stat-item views">
            <span class="stat-value">{totalViews}</span>
            <span class="stat-label">Views</span>
          </div>
        {/if}
        {#if totalForks > 0}
          <div class="stat-item forks">
            <span class="stat-value">{totalForks}</span>
            <span class="stat-label">Forks</span>
          </div>
        {/if}
      </div>

      <!-- Created This Week Section -->
      {#if createdThisWeek().length > 0}
        <section class="dashboard-section highlight-section">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-sparkles" aria-hidden="true"></i>
              <h2>Created This Week</h2>
              <span class="count-badge">{createdThisWeek().length}</span>
            </div>
          </div>

          <div class="sequences-grid compact">
            {#each createdThisWeek().slice(0, 4) as sequence (sequence.id)}
              <div class="sequence-card-wrapper">
                <SequenceCard
                  {sequence}
                  coverUrl={getCoverUrl(sequence)}
                  onPrimaryAction={handleSequenceClick}
                />
                {#if sequence.viewCount > 0 || sequence.forkCount > 0 || sequence.starCount > 0}
                  <div class="card-analytics">
                    <SequenceAnalyticsBadge
                      viewCount={sequence.viewCount}
                      forkCount={sequence.forkCount}
                      starCount={sequence.starCount}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Recent Sequences Section -->
      <section class="dashboard-section">
        <div class="section-header">
          <div class="section-title">
            <i class="fas fa-clock" aria-hidden="true"></i>
            <h2>Recently Updated</h2>
          </div>
          {#if totalSequences > 0}
            <button class="see-all-btn" onclick={handleSeeAllSequences}>
              See All <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          {/if}
        </div>

        {#if recentSequences().length > 0}
          <div class="sequences-grid">
            {#each recentSequences() as sequence (sequence.id)}
              <div class="sequence-card-wrapper">
                <SequenceCard
                  {sequence}
                  coverUrl={getCoverUrl(sequence)}
                  onPrimaryAction={handleSequenceClick}
                />
                {#if sequence.viewCount > 0 || sequence.forkCount > 0 || sequence.starCount > 0}
                  <div class="card-analytics">
                    <SequenceAnalyticsBadge
                      viewCount={sequence.viewCount}
                      forkCount={sequence.forkCount}
                      starCount={sequence.starCount}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-section">
            <i class="fas fa-plus-circle" aria-hidden="true"></i>
            <p>No sequences yet. Create your first sequence!</p>
          </div>
        {/if}
      </section>

      <!-- Favorites Section -->
      {#if totalFavorites > 0}
        <section class="dashboard-section">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-heart" aria-hidden="true"></i>
              <h2>Favorites</h2>
            </div>
            <button class="see-all-btn" onclick={handleSeeAllFavorites}>
              See All <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="sequences-grid compact">
            {#each favoriteSequences() as sequence (sequence.id)}
              <SequenceCard
                {sequence}
                coverUrl={getCoverUrl(sequence)}
                onPrimaryAction={handleSequenceClick}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- My Videos Section -->
      {#if totalVideos > 0 || videosLoading}
        <section class="dashboard-section">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-video" aria-hidden="true"></i>
              <h2>My Videos</h2>
            </div>
            {#if totalVideos > 0}
              <button class="see-all-btn" onclick={handleSeeAllVideos}>
                See All <i class="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            {/if}
          </div>

          {#if videosLoading}
            <div
              class="videos-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div class="spinner small" aria-hidden="true"></div>
              <span>Loading videos...</span>
            </div>
          {:else if recentVideos().length > 0}
            <div class="videos-grid">
              {#each recentVideos() as video (video.id)}
                <CollaborativeVideoCard
                  {video}
                  onclick={() => handleVideoClick(video)}
                />
              {/each}
            </div>
          {:else}
            <div class="empty-section">
              <i class="fas fa-video" aria-hidden="true"></i>
              <p>No videos yet. Record your first performance!</p>
            </div>
          {/if}
        </section>
      {/if}

      <!-- Activity Timeline Section -->
      {#if totalSequences > 0}
        <section class="dashboard-section">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-history" aria-hidden="true"></i>
              <h2>Recent Activity</h2>
            </div>
          </div>

          <div class="activity-container">
            <ActivityTimeline sequences={libraryState.sequences} maxItems={8} />
          </div>
        </section>
      {/if}

      <!-- Collections & Acts will be added in future updates -->
    </div>
  {/if}
</div>

<style>
  .library-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
    color: var(--foreground, #ffffff);
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim);
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--spacing-md, 16px);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Auth Required State */
  .auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-dim);
    padding: var(--spacing-xl, 32px);
  }

  .auth-required i {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg, 24px);
    opacity: 0.5;
  }

  .auth-required h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md, 16px);
    color: var(--theme-text);
  }

  /* Error State */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--theme-text-dim);
    padding: var(--spacing-xl, 32px);
  }

  .error-state i {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg, 24px);
    color: rgba(239, 68, 68, 0.7);
  }

  .error-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md, 16px);
    color: var(--theme-text);
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px);
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: var(--spacing-md, 16px);
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Dashboard Content */
  .dashboard-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-lg, 24px);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl, 32px);
  }

  /* Stats Bar */
  .stats-bar {
    display: flex;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-lg, 24px);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-2026-md, 14px);
    justify-content: space-around;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    min-width: 80px;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--theme-accent);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-item.highlight .stat-value {
    color: var(--semantic-success);
  }

  .stat-item.views .stat-value {
    color: var(--semantic-info);
  }

  .stat-item.forks .stat-value {
    color: var(--semantic-success);
  }

  /* Dashboard Section */
  .dashboard-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
  }

  .dashboard-section.highlight-section {
    padding: var(--spacing-md);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 8%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-radius: var(--radius-2026-md, 14px);
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 999px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent);
  }

  /* Sequence Card Wrapper for Analytics Overlay */
  .sequence-card-wrapper {
    position: relative;
  }

  .card-analytics {
    position: absolute;
    bottom: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 5;
    pointer-events: none;
  }

  /* Activity Container */
  .activity-container {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md, 14px);
    padding: var(--spacing-md);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md, 16px);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
  }

  .section-title i {
    font-size: 1.25rem;
    color: var(--theme-accent);
  }

  .section-title h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .see-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: transparent;
    border: none;
    color: var(--theme-accent);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .see-all-btn:hover {
    color: var(--theme-accent-strong);
    transform: translateX(2px);
  }

  .see-all-btn i {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }

  .see-all-btn:hover i {
    transform: translateX(2px);
  }

  /* Sequences Grid */
  .sequences-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--spacing-md, 16px);
  }

  .sequences-grid.compact {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  /* Videos Grid */
  .videos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-md, 16px);
  }

  .videos-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-lg, 24px);
    color: var(--theme-text-dim);
    font-size: 0.875rem;
  }

  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  /* Empty Section */
  .empty-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl, 32px);
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--theme-stroke);
    border-radius: var(--radius-2026-md, 14px);
    text-align: center;
    gap: var(--spacing-sm, 8px);
  }

  .empty-section i {
    font-size: 2rem;
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
  }

  .empty-section p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .dashboard-content {
      padding: var(--spacing-md, 16px);
    }

    .stats-bar {
      padding: var(--spacing-md, 16px);
    }

    .stat-value {
      font-size: 1.5rem;
    }

    .sequences-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
  }
</style>
