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

  <div class="stat-card">
    <i class="fas fa-trophy stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.achievementCount}</span>
      <span class="stat-label">Achievements</span>
    </div>
  </div>

  <div class="stat-card">
    <i class="fas fa-bolt stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.totalXP.toLocaleString()}</span>
      <span class="stat-label">Total XP</span>
    </div>
  </div>

  <div class="stat-card">
    <i class="fas fa-fire stat-icon" aria-hidden="true"></i>
    <div class="stat-content">
      <span class="stat-value">{userProfile.currentStreak}</span>
      <span class="stat-label">Day Streak</span>
    </div>
  </div>
</div>

<style>
  .stats-grid {
    container-type: inline-size;
    container-name: stats-grid;

    display: grid;
    /* Default: 12-col grid for precise centering of 7 items */
    grid-template-columns: repeat(12, 1fr);
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
     CONTAINER QUERY BREAKPOINTS - Balanced row layouts for 7 items
     Using 12-column grid for precise centering of bottom row
     ════════════════════════════════════════════════════════════════════════ */

  /* Wide (600px+): 12-col grid → 4 items top (3 cols each), 3 items bottom centered */
  @container stats-grid (min-width: 600px) {
    .stats-grid {
      grid-template-columns: repeat(12, 1fr);
    }

    /* Row 1: 4 items spanning 3 cols each */
    .stat-card:nth-child(1) { grid-column: 1 / 4; }
    .stat-card:nth-child(2) { grid-column: 4 / 7; }
    .stat-card:nth-child(3) { grid-column: 7 / 10; }
    .stat-card:nth-child(4) { grid-column: 10 / 13; }

    /* Row 2: 3 items centered (offset by 1.5 cols = start at col 2) */
    .stat-card:nth-child(5) { grid-column: 2 / 5; }
    .stat-card:nth-child(6) { grid-column: 5 / 9; }
    .stat-card:nth-child(7) { grid-column: 9 / 12; }
  }

  /* Medium (450-599px): tighter 4+3 layout */
  @container stats-grid (max-width: 599px) and (min-width: 450px) {
    .stats-grid {
      grid-template-columns: repeat(12, 1fr);
      gap: 8px;
    }

    .stat-card {
      padding: 10px 8px;
      flex-direction: column;
      text-align: center;
      gap: 4px;
    }

    .stat-icon {
      font-size: var(--font-size-base);
    }

    .stat-value {
      font-size: var(--font-size-sm);
    }

    /* Row 1: 4 items */
    .stat-card:nth-child(1) { grid-column: 1 / 4; }
    .stat-card:nth-child(2) { grid-column: 4 / 7; }
    .stat-card:nth-child(3) { grid-column: 7 / 10; }
    .stat-card:nth-child(4) { grid-column: 10 / 13; }

    /* Row 2: 3 items centered */
    .stat-card:nth-child(5) { grid-column: 2 / 5; }
    .stat-card:nth-child(6) { grid-column: 5 / 9; }
    .stat-card:nth-child(7) { grid-column: 9 / 12; }
  }

  /* Narrow (320-449px): 2 columns → 2+2+2+1, center the orphan */
  @container stats-grid (max-width: 449px) and (min-width: 320px) {
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

    /* Center the 7th item */
    .stat-card:nth-child(7) {
      grid-column: 1 / -1;
      max-width: 50%;
      justify-self: center;
    }
  }

  /* Very narrow (<320px): 2 cols tight */
  @container stats-grid (max-width: 319px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    .stat-card {
      flex-direction: column;
      text-align: center;
      padding: 10px 6px;
      gap: 4px;
    }

    .stat-icon {
      font-size: var(--font-size-base);
    }

    .stat-value {
      font-size: var(--font-size-sm);
    }

    .stat-card:nth-child(7) {
      grid-column: 1 / -1;
      max-width: 50%;
      justify-self: center;
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
