<!--
  UserProfileMarker.svelte

  Popup displayed when clicking a user's map marker
  Shows profile info with link to full profile
-->
<script lang="ts">
  import type { UserLocationWithProfile } from "../domain/models/user-location";

  let {
    user,
    onViewProfile = () => {},
    onClose = () => {},
  }: {
    user: UserLocationWithProfile;
    onViewProfile: (userId: string) => void;
    onClose: () => void;
  } = $props();

  function handleViewProfile() {
    onViewProfile(user.userId);
  }
</script>

<div class="marker-popup">
  <button class="close-btn" onclick={onClose} aria-label="Close">
    <i class="fas fa-times" aria-hidden="true"></i>
  </button>

  <div class="profile-header">
    {#if user.avatar}
      <img src={user.avatar} alt={user.displayName} class="avatar" />
    {:else}
      <div class="avatar-placeholder">
        <i class="fas fa-user" aria-hidden="true"></i>
      </div>
    {/if}
    <div class="profile-info">
      <h3>{user.displayName}</h3>
      <p class="username">@{user.username}</p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat">
      <i class="fas fa-star" aria-hidden="true"></i>
      <span class="stat-label">Level</span>
      <span class="stat-value">{user.currentLevel}</span>
    </div>
    <div class="stat">
      <i class="fas fa-bolt" aria-hidden="true"></i>
      <span class="stat-label">XP</span>
      <span class="stat-value">{user.totalXP.toLocaleString()}</span>
    </div>
    <div class="stat">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <span class="stat-label">Sequences</span>
      <span class="stat-value">{user.sequenceCount}</span>
    </div>
  </div>

  {#if user.city || user.country}
    <div class="location-info">
      <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
      <span>
        {#if user.city && user.country}
          {user.city}, {user.country}
        {:else if user.country}
          {user.country}
        {:else}
          {user.city}
        {/if}
      </span>
    </div>
  {/if}

  <button class="view-profile-btn" onclick={handleViewProfile}>
    View Full Profile
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .marker-popup {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 20px;
    min-width: 280px;
    max-width: 320px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: 2px;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .avatar,
  .avatar-placeholder {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .avatar {
    object-fit: cover;
    border: 2px solid var(--theme-accent, #4a9eff);
  }

  .avatar-placeholder {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 24px;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-info h3 {
    font-size: var(--font-size-sm, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .username {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat i {
    font-size: 18px;
    color: var(--theme-accent, #4a9eff);
    margin-bottom: 2px;
  }

  .stat-label {
    font-size: var(--font-size-xs, 11px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .location-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .location-info i {
    color: var(--theme-accent, #4a9eff);
    font-size: 14px;
  }

  .view-profile-btn {
    width: 100%;
    padding: 12px 16px;
    background: var(--theme-accent, #4a9eff);
    color: #000000;
    border: none;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .view-profile-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .view-profile-btn i {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .view-profile-btn {
      transition: none;
    }
  }
</style>
