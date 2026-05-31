<script lang="ts">
  import { fade } from "svelte/transition";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "$lib/shared/browse/components/AvatarImage.svelte";
  import { reportModalState } from "$lib/features/moderation/state/report-modal-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

  let {
    userProfile,
    currentUserId,
    isOwnProfile,
    followInProgress,
    onFollowToggle,
    onFollowersClick,
    onFollowingClick,
  }: {
    userProfile: EnhancedUserProfile;
    currentUserId?: string | null;
    isOwnProfile: boolean;
    followInProgress: boolean;
    onFollowToggle: () => void;
    onFollowersClick?: () => void;
    onFollowingClick?: () => void;
  } = $props();

  const accentColor = $derived(userProfile.profileColor || "var(--theme-accent)");

  function handleReportUser() {
    reportModalState.open({
      id: userProfile.id,
      displayName: userProfile.displayName,
    });
  }
</script>

<div
  class="hero-section"
  transition:fade={{ duration: 300 }}
  style:--profile-color={accentColor}
>
  <div class="hero-ambient"></div>

  <div class="hero-content">
    <div class="avatar-container">
      <div class="avatar-glow"></div>
      <AvatarImage
        src={userProfile.avatar}
        alt={userProfile.displayName}
        name={userProfile.displayName}
        size={120}
        className="avatar"
      />
    </div>

    <div class="info-block">
      <div class="name-row">
        <h1 class="display-name">{userProfile.displayName}</h1>
        <span class="username">@{userProfile.username}</span>
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
                  <span class="favorite-star" aria-label="Favorite">&#9733;</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

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

      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{userProfile.sequenceCount}</span>
          <span class="stat-label">Sequences</span>
        </div>
        <div class="stat">
          <span class="stat-value">{userProfile.collectionCount}</span>
          <span class="stat-label">Collections</span>
        </div>
        <button class="stat stat-clickable" onclick={() => onFollowersClick?.()}>
          <span class="stat-value">{userProfile.followerCount}</span>
          <span class="stat-label">Followers</span>
        </button>
        <button class="stat stat-clickable" onclick={() => onFollowingClick?.()}>
          <span class="stat-value">{userProfile.followingCount}</span>
          <span class="stat-label">Following</span>
        </button>
      </div>
    </div>

    {#if currentUserId && !isOwnProfile}
      <div class="actions-block">
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

    position: relative;
    overflow: hidden;
    padding: clamp(20px, 4cqi, 32px);
    border-radius: 16px;
    margin-bottom: 24px;
    max-width: 900px;
    margin-inline: auto;
  }

  .hero-ambient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        circle 200px at 100px 50%,
        color-mix(in srgb, var(--profile-color) 12%, transparent),
        transparent 70%
      );
    pointer-events: none;
    z-index: 0;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .avatar-container {
    position: relative;
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--profile-color) 30%, transparent);
    filter: blur(8px);
    z-index: -1;
  }

  .info-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .name-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .display-name {
    margin: 0;
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .username {
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
  }

  .bio {
    margin: 4px 0 0 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--theme-text-dim);
    max-width: min(400px, 100%);
  }

  .instagram-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--instagram-brand) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--instagram-brand) 25%, transparent);
    border-radius: 20px;
    color: var(--instagram-brand);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-decoration: none;
    transition: all var(--duration-normal) ease;
    width: fit-content;
  }

  .instagram-link:hover {
    background: color-mix(in srgb, var(--instagram-brand) 20%, transparent);
    border-color: color-mix(in srgb, var(--instagram-brand) 40%, transparent);
    transform: translateY(-1px);
  }

  .instagram-link i {
    font-size: 16px;
  }

  .stats-row {
    display: flex;
    gap: 24px;
    margin-top: 8px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    color: inherit;
  }

  .stat-clickable {
    cursor: pointer;
  }

  .stat-clickable:hover .stat-label {
    color: var(--theme-text);
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .stat-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    transition: color var(--duration-normal) ease;
  }

  .stat-clickable .stat-label {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }

  .actions-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
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
    white-space: nowrap;
  }

  .follow-button:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent) 40%, transparent);
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
    background: transparent;
    border: 1px solid transparent;
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

  .props-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
    margin-left: 4px;
  }

  .profile-prop-icon {
    position: relative;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .profile-prop-icon.favorite {
    opacity: 1;
  }

  .profile-prop-icon img {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  .favorite-star {
    position: absolute;
    bottom: -4px;
    right: -4px;
    font-size: 0.65rem;
    color: gold;
  }

  /* ═══ Mobile: collapse to centered vertical stack ═══ */
  @container hero-section (max-width: 640px) {
    .hero-content {
      flex-direction: column;
      text-align: center;
    }

    .avatar-container {
      width: 80px;
      height: 80px;
    }

    .name-row {
      justify-content: center;
    }

    .display-name {
      font-size: var(--font-size-2xl);
    }

    .bio {
      text-align: center;
      margin-inline: auto;
    }

    .instagram-link {
      margin-inline: auto;
    }

    .stats-row {
      justify-content: center;
    }

    .actions-block {
      flex-direction: row;
      gap: 12px;
    }

    .follow-button {
      padding: 10px 24px;
    }

    .props-row {
      justify-content: center;
      margin-left: 0;
    }
  }

  /* ═══ Very narrow ═══ */
  @container hero-section (max-width: 400px) {
    .hero-section {
      padding: 14px;
    }

    .stats-row {
      gap: 16px;
      flex-wrap: wrap;
    }

    .display-name {
      font-size: var(--font-size-xl);
    }

    .username {
      font-size: var(--font-size-sm);
    }
  }

  .instagram-link:focus-visible {
    outline: 3px solid var(--instagram-brand);
    outline-offset: 2px;
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
</style>
