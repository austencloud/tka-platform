<script lang="ts">
  /**
   * CreatorCard - Individual creator profile card
   *
   * Displays a user's avatar, name, stats, and follow button.
   * Card accent color is extracted from avatar for personalized theming.
   */

  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import {
    extractDominantColor,
    getCachedOrFallbackColor,
  } from "$lib/shared/foundation/utils/color-extractor";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    user: EnhancedUserProfile;
    accentColor?: string;
    currentUserId?: string;
    isFollowLoading?: boolean;
    onUserClick: () => void;
    onFollowToggle: () => void;
    onColorExtracted?: (color: string) => void;
  }

  const {
    user,
    accentColor,
    currentUserId,
    isFollowLoading = false,
    onUserClick,
    onFollowToggle,
    onColorExtracted,
  }: Props = $props();

  // Local color state - uses passed accentColor or extracts from avatar
  let extractedColor = $state<string | null>(null);

  // Computed card color
  const cardColor = $derived(
    accentColor || extractedColor || getCachedOrFallbackColor(user.avatar, user.displayName)
  );

  // Show follow button only if logged in and not own profile
  const showFollowButton = $derived(currentUserId && currentUserId !== user.id);

  /**
   * Handle successful avatar image load - extract color
   */
  async function handleAvatarLoad(imgElement: HTMLImageElement) {
    // Skip if we already have a passed color
    if (accentColor) return;

    try {
      const color = await extractDominantColor(user.avatar, user.displayName);
      extractedColor = color;
      onColorExtracted?.(color);
    } catch {
      // Extraction failed, use fallback
    }
  }

  /**
   * Handle avatar load error - ensure fallback color
   */
  function handleAvatarError(imgElement: HTMLImageElement) {
    // Hide broken image, show placeholder
    imgElement.style.display = "none";
    const fallback = imgElement.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = "flex";

    // Set fallback color based on name
    if (!extractedColor) {
      extractedColor = getCachedOrFallbackColor(undefined, user.displayName);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onUserClick();
    }
  }

  function handleFollowClick(e: MouseEvent) {
    e.stopPropagation();
    onFollowToggle();
  }
</script>

<div
  class="user-card"
  style="--card-accent: {cardColor}"
  onclick={onUserClick}
  role="button"
  tabindex="0"
  aria-label="View profile of {user.displayName}"
  onkeydown={handleKeyDown}
>
  <!-- Avatar -->
  <div class="user-avatar">
    {#if user.avatar}
      <img
        src={user.avatar}
        alt={user.displayName}
        crossorigin="anonymous"
        referrerpolicy="no-referrer"
        onload={(e) => handleAvatarLoad(e.currentTarget as HTMLImageElement)}
        onerror={(e) => handleAvatarError(e.currentTarget as HTMLImageElement)}
      />
      <!-- Fallback placeholder (shown if image fails to load) -->
      <div class="avatar-placeholder" style="display: none;" aria-hidden="true">
        <i class="fas fa-user" aria-hidden="true"></i>
      </div>
    {:else}
      <div class="avatar-placeholder" aria-hidden="true">
        <i class="fas fa-user" aria-hidden="true"></i>
      </div>
    {/if}
  </div>

  <!-- User info -->
  <div class="user-info">
    <h3 class="display-name">{user.displayName}</h3>
    <p class="username">@{user.username}</p>

    <!-- Stats -->
    <div class="user-stats">
      <div class="stat">
        <i class="fas fa-list" aria-hidden="true"></i>
        <span>{user.sequenceCount}</span>
      </div>
      <div class="stat">
        <i class="fas fa-folder" aria-hidden="true"></i>
        <span>{user.collectionCount}</span>
      </div>
      <div class="stat">
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>{user.followerCount}</span>
      </div>
    </div>
  </div>

  <!-- Actions - only show follow button if logged in and not own profile -->
  {#if showFollowButton}
    <div class="user-actions">
      <button
        class="follow-button"
        class:following={user.isFollowing}
        class:loading={isFollowLoading}
        disabled={isFollowLoading}
        aria-busy={isFollowLoading}
        onclick={handleFollowClick}
      >
        {#if isFollowLoading}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          {user.isFollowing ? t("browse_following") : t("browse_follow")}
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  /* ============================================================================
     USER CARD - Dynamic Avatar-Based Color Theming
     --card-accent is set dynamically per card via inline style
     ============================================================================ */
  .user-card {
    /* Fallback if no color extracted yet */
    --card-accent: var(--theme-accent-strong);
    /* Derive lighter variant using color-mix */
    --card-accent-light: color-mix(in srgb, var(--card-accent) 80%, #fff);
    --card-accent-glow: color-mix(in srgb, var(--card-accent) 25%, transparent);

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    /* Fixed height ensures all cards match, with or without follow button */
    height: 220px;
    /* Soft gradient fill using extracted color */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 10%, rgba(255, 255, 255, 0.03)) 0%,
      color-mix(in srgb, var(--card-accent) 5%, rgba(255, 255, 255, 0.02)) 100%
    );
    border: 1px solid color-mix(in srgb, var(--card-accent) 18%, transparent);
    border-radius: 14px;
    transition:
      background 0.3s var(--ease-out, ease),
      border-color 0.3s var(--ease-out, ease),
      box-shadow 0.2s var(--ease-out, ease),
      transform 0.2s var(--ease-out, ease);
    cursor: pointer;
  }

  .user-card:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 16%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--card-accent) 10%, rgba(255, 255, 255, 0.03)) 100%
    );
    border-color: color-mix(in srgb, var(--card-accent) 40%, transparent);
    transform: translateY(var(--hover-lift-md, -2px));
    /* Dynamic color glow on hover */
    box-shadow:
      0 8px 24px var(--card-accent-glow),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .user-card:focus {
    outline: 2px solid var(--card-accent);
    outline-offset: 2px;
  }

  /* Avatar with dynamic color ring */
  .user-avatar {
    position: relative;
    width: 56px;
    height: 56px;
    margin: 0 auto;
    flex-shrink: 0;
    /* Gradient ring using extracted color */
    padding: 2px;
    background: linear-gradient(
      135deg,
      var(--card-accent) 0%,
      var(--card-accent-light) 100%
    );
    border-radius: 50%;
    transition: background var(--duration-emphasis) var(--ease-out, ease);
  }

  .user-avatar img,
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    /* Inner background to create ring effect */
    background: #1a1a2e;
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 20%, #1a1a2e) 0%,
      #1a1a2e 100%
    );
  }

  .avatar-placeholder i {
    font-size: var(--font-size-xl);
    color: var(--card-accent-light);
    transition: color var(--duration-emphasis) var(--ease-out, ease);
  }

  /* User info */
  .user-info {
    text-align: center;
    min-width: 0;
    flex: 1; /* Grow to fill space when no follow button */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .display-name {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .username {
    margin: 2px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* User stats */
  .user-stats {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: auto; /* Push to bottom of user-info flex container */
    padding-top: 6px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .stat i {
    font-size: var(--font-size-compact);
    /* Dynamic color tinted icons */
    color: var(--card-accent);
    opacity: 0.75;
    transition:
      opacity 0.2s ease,
      color 0.3s ease;
  }

  .user-card:hover .stat i {
    opacity: 1;
  }

  /* Actions */
  .user-actions {
    display: flex;
    margin-top: 4px;
  }

  .follow-button {
    width: 100%;
    padding: 6px 12px;
    border: 1px solid var(--card-accent);
    border-radius: 6px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-emphasis) var(--ease-out, ease);
    background: var(--card-accent);
    color: white;
  }

  .follow-button:hover {
    filter: brightness(1.15);
    box-shadow: 0 2px 8px var(--card-accent-glow);
  }

  .follow-button.following {
    background: transparent;
    border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
    color: var(--theme-text-dim);
  }

  .follow-button.following:hover {
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--card-accent) 50%, transparent);
    color: var(--card-accent-light);
  }

  .follow-button.loading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .follow-button:disabled {
    pointer-events: none;
  }

  /* ============================================================================
     RESPONSIVE
     ============================================================================ */
  @media (max-width: 640px) {
    .user-card {
      padding: 12px;
      gap: 8px;
      border-radius: 12px;
    }

    .user-avatar {
      width: 48px;
      height: 48px;
      padding: 2px;
    }

    .avatar-placeholder i {
      font-size: var(--font-size-lg);
    }

    .display-name {
      font-size: var(--font-size-compact);
    }

    .username {
      font-size: var(--font-size-compact);
    }

    .user-stats {
      margin-top: 4px;
      gap: 10px;
    }

    .stat {
      font-size: var(--font-size-compact);
      gap: 3px;
    }

    .stat i {
      font-size: var(--font-size-compact);
    }

    .follow-button {
      padding: 6px 12px;
      font-size: var(--font-size-compact);
    }
  }

  @media (max-width: 360px) {
    .user-avatar {
      width: 44px;
      height: 44px;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .user-card {
      transition: none;
    }

    .user-card:hover {
      transform: none;
    }
  }
</style>
