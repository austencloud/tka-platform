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
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(152px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
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
    font-size: var(--font-size-2xl);
    color: var(--theme-accent);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .stat-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .stat-card {
      padding: 12px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .stat-card {
      flex-direction: column;
      text-align: center;
      padding: 10px;
    }

    .stat-icon {
      font-size: var(--font-size-xl);
    }

    .stat-value {
      font-size: var(--font-size-lg);
    }

    .stat-label {
      font-size: var(--font-size-compact);
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
