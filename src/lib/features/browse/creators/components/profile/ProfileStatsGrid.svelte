<script lang="ts">
  import { fly } from "svelte/transition";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  let { userProfile }: { userProfile: EnhancedUserProfile } = $props();
</script>

<div class="stats-grid" transition:fly={{ y: 20, duration: 300, delay: 100 }}>
  <div class="stat-card">
    <i class="fas fa-list stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.sequenceCount}</span>
      <span class="stat-label">Sequences</span>
    </div>
  </div>

  <div class="stat-card">
    <i class="fas fa-folder stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.collectionCount}</span>
      <span class="stat-label">Collections</span>
    </div>
  </div>

  <div class="stat-card">
    <i class="fas fa-users stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.followerCount}</span>
      <span class="stat-label">Followers</span>
    </div>
  </div>

  <div class="stat-card">
    <i class="fas fa-user-plus stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.followingCount}</span>
      <span class="stat-label">Following</span>
    </div>
  </div>
</div>

<style>
  .stats-grid {
    container-type: inline-size;
    container-name: stats-grid;

    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    transition: all var(--duration-normal) ease;
  }

  .stat-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .stat-icon {
    font-size: var(--font-size-xl);
    color: var(--theme-accent);
    flex-shrink: 0;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .stat-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  /* ════════════════════════════════════════════════════════════════════════
     CONTAINER QUERY BREAKPOINTS - 4 items layout
     ════════════════════════════════════════════════════════════════════════ */

  /* Narrow: 2x2 grid */
  @container stats-grid (max-width: 449px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .stat-card {
      flex-direction: column;
      text-align: center;
      padding: 12px 8px;
      gap: 6px;
    }

    .stat-icon {
      font-size: var(--font-size-lg);
    }

    .stat-value {
      font-size: var(--font-size-base);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stat-card {
      transition: none;
    }

    .stat-card:hover {
      background: var(--theme-card-bg);
      border-color: var(--theme-stroke);
    }
  }
</style>
