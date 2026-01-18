<script lang="ts">
  import { fade } from "svelte/transition";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "./AvatarImage.svelte";

  let {
    userProfile,
    currentUserId,
    isOwnProfile,
    followInProgress,
    onFollowToggle,
  }: {
    userProfile: EnhancedUserProfile;
    currentUserId?: string | null;
    isOwnProfile: boolean;
    followInProgress: boolean;
    onFollowToggle: () => void;
  } = $props();
</script>

<div class="hero-section" transition:fade={{ duration: 300 }}>
  <div class="avatar-container">
    <AvatarImage
      src={userProfile.avatar}
      alt={userProfile.displayName}
      size={120}
      className="avatar"
    />

    <div class="level-badge">
      <i class="fas fa-star" aria-hidden="true"></i>
      <span>{userProfile.currentLevel}</span>
    </div>
  </div>

  <div class="user-info">
    <h1 class="display-name">{userProfile.displayName}</h1>
    <p class="username">@{userProfile.username}</p>

    {#if userProfile.bio}
      <p class="bio">{userProfile.bio}</p>
    {/if}

    {#if currentUserId && !isOwnProfile}
      <button
        class="follow-button"
        class:following={userProfile.isFollowing}
        class:loading={followInProgress}
        disabled={followInProgress}
        onclick={onFollowToggle}
      >
        {#if followInProgress}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          {userProfile.isFollowing ? "Following" : "Follow"}
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    margin-bottom: 24px;
  }

  .avatar-container {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .level-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      #d97706 100%
    );
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-radius: 20px;
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: white;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .level-badge i {
    font-size: var(--font-size-compact);
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .display-name {
    margin: 0;
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text, white);
    text-align: center;
  }

  .username {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
  }

  .bio {
    margin: 8px 0 0 0;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--theme-text-dim);
    text-align: center;
    max-width: 400px;
  }

  .follow-button {
    margin-top: 16px;
    padding: 12px 32px;
    background: var(--theme-accent);
    border: 1px solid var(--theme-accent);
    border-radius: 8px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .follow-button:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .follow-button.following {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    color: var(--theme-text);
  }

  .follow-button.following:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    filter: none;
  }

  .follow-button.loading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .follow-button:disabled {
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .hero-section {
      padding: 16px;
    }

    .avatar-container {
      width: 100px;
      height: 100px;
    }

    .display-name {
      font-size: var(--font-size-2xl);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .follow-button {
      transition: none;
    }

    .follow-button:hover {
      transform: none;
    }
  }
</style>
