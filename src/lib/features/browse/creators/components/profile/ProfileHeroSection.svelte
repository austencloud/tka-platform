<script lang="ts">
  import { fade } from "svelte/transition";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "./AvatarImage.svelte";
  import { reportModalState } from "$lib/features/moderation/state/report-modal-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

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

  function handleReportUser() {
    reportModalState.open({
      id: userProfile.id,
      displayName: userProfile.displayName,
    });
  }
</script>

<div class="hero-section" transition:fade={{ duration: 300 }}>
  <div class="avatar-container">
    <AvatarImage
      src={userProfile.avatar}
      alt={userProfile.displayName}
      size={120}
      className="avatar"
    />
  </div>

  <div class="user-info">
    <h1 class="display-name">{userProfile.displayName}</h1>
    <p class="username">@{userProfile.username}</p>

    {#if userProfile.bio}
      <p class="bio">{userProfile.bio}</p>
    {/if}

    {#if userProfile.instagramUsername}
      <a
        href="https://instagram.com/{userProfile.instagramUsername}"
        target="_blank"
        rel="noopener noreferrer"
        class="instagram-link"
        aria-label="View {userProfile.displayName}'s Instagram profile"
      >
        <i class="fab fa-instagram" aria-hidden="true"></i>
        <span>@{userProfile.instagramUsername}</span>
      </a>
    {/if}

    {#if userProfile.propsISpinWith && userProfile.propsISpinWith.length > 0}
      <div class="props-row">
        {#each userProfile.propsISpinWith as prop}
          <div
            class="profile-prop-icon"
            class:favorite={prop === userProfile.favoriteProp}
            title={getPropTypeDisplayInfo(prop).label}
          >
            <img
              src={getPropTypeDisplayInfo(prop).image}
              alt={getPropTypeDisplayInfo(prop).label}
            />
            {#if prop === userProfile.favoriteProp}
              <span class="favorite-star" aria-label="Favorite">★</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if currentUserId && !isOwnProfile}
      <div class="action-buttons">
        <button
          class="follow-button"
          class:following={userProfile.isFollowing}
          class:loading={followInProgress}
          disabled={followInProgress}
          onclick={onFollowToggle}
          aria-label={userProfile.isFollowing ? "Unfollow {userProfile.displayName}" : "Follow {userProfile.displayName}"}
        >
          {#if followInProgress}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            {userProfile.isFollowing ? "Following" : "Follow"}
          {/if}
        </button>

        <button
          class="report-button"
          onclick={handleReportUser}
          aria-label="Report {userProfile.displayName}"
          title="Report user"
        >
          <i class="fas fa-flag" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .hero-section {
    --instagram-brand: #E4405F;

    container-type: inline-size;
    container-name: hero-section;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: clamp(20px, 4cqi, 32px);
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
    line-height: 1.6;
    color: var(--theme-text-dim);
    text-align: center;
    max-width: min(400px, 90%);
  }

  .instagram-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--instagram-brand) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--instagram-brand) 25%, transparent);
    border-radius: 20px;
    color: var(--instagram-brand);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-decoration: none;
    transition: all var(--duration-normal) ease;
  }

  .instagram-link:hover {
    background: color-mix(in srgb, var(--instagram-brand) 20%, transparent);
    border-color: color-mix(in srgb, var(--instagram-brand) 40%, transparent);
    transform: translateY(-1px);
  }

  .instagram-link i {
    font-size: 16px;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  .follow-button {
    padding: 12px 32px;
    background: var(--theme-accent);
    border: 1px solid var(--theme-accent);
    border-radius: 8px;
    color: var(--text-on-accent, white);
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

  .report-button {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .report-button:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  .report-button:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
  }

  /* Tablet */
  @container hero-section (max-width: 600px) {
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

  /* Mobile */
  @container hero-section (max-width: 400px) {
    .hero-section {
      padding: 14px;
      gap: 16px;
    }

    .avatar-container {
      width: 88px;
      height: 88px;
    }

    .display-name {
      font-size: var(--font-size-xl);
    }

    .username {
      font-size: var(--font-size-sm);
    }

    .action-buttons {
      margin-top: 12px;
      justify-content: center;
    }

    .follow-button {
      padding: 10px 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .follow-button,
    .instagram-link,
    .report-button {
      transition: none;
    }

    .follow-button:hover,
    .instagram-link:hover {
      transform: none;
    }
  }

  .instagram-link:focus-visible {
    outline: 3px solid var(--instagram-brand);
    outline-offset: 2px;
  }

  .props-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    padding: 8px 0;
  }

  .profile-prop-icon {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .profile-prop-icon.favorite {
    opacity: 1;
  }

  .profile-prop-icon img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .favorite-star {
    position: absolute;
    bottom: -4px;
    right: -4px;
    font-size: 0.75rem;
    color: gold;
  }
</style>
