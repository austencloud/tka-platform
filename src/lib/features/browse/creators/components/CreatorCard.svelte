<script lang="ts">
  /**
   * CreatorCard - Individual creator profile card
   *
   * Displays a user's avatar, name, stats, and follow button.
   * Card accent color is extracted from avatar for personalized theming.
   */

  import type { EnhancedUserProfile, CreatorSortCriteria } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import {
    extractDominantColor,
    getCachedOrFallbackColor,
  } from "$lib/shared/foundation/utils/color-extractor";
  import { formatTimeAgo } from "$lib/shared/i18n/i18n-formatters";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import { isGoogleAvatarUrl } from "$lib/shared/foundation/utils/google-avatar";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { getEffectiveProp } from "$lib/shared/community/domain/get-effective-prop";

  interface Props {
    user: EnhancedUserProfile;
    sortBy?: CreatorSortCriteria;
    accentColor?: string;
    currentUserId?: string;
    isFollowLoading?: boolean;
    onUserClick: () => void;
    onFollowToggle: () => void;
    onColorExtracted?: (color: string) => void;
  }

  const {
    user,
    sortBy = "lastActive",
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

  // Highlight users active in the last 24 hours
  const isRecentlyActive = $derived(
    user.lastActiveAt && (Date.now() - user.lastActiveAt.getTime()) < 86400000
  );

  // Prop identity badge: explicit favorite wins, else the settings-derived prop
  const effectiveProp = $derived(getEffectiveProp(user));

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
        crossorigin={isGoogleAvatarUrl(user.avatar) ? undefined : "anonymous"}
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
    {#if user.pronouns}
      <p class="pronouns">{user.pronouns}</p>
    {/if}
    <p class="username">@{user.username}</p>

    {#if effectiveProp}
      {@const propInfo = getPropTypeDisplayInfo(effectiveProp)}
      <div class="prop-tag" title="Spins with {propInfo.label}">
        <img src={propInfo.image} alt="" class="prop-tag-icon" aria-hidden="true" />
        <span class="prop-tag-label">{propInfo.label}</span>
      </div>
    {/if}

    <!-- Stats (zero counts hidden - zeros across the grid read as emptiness) -->
    <div class="user-stats">
      {#if user.sequenceCount > 0}
        <div class="stat">
          <i class="fas fa-list" aria-hidden="true"></i>
          <span>{user.sequenceCount}</span>
        </div>
      {/if}
      {#if user.collectionCount > 0}
        <div class="stat">
          <i class="fas fa-folder" aria-hidden="true"></i>
          <span>{user.collectionCount}</span>
        </div>
      {/if}
    </div>

    <!-- Activity / Join date (context-dependent on sort) -->
    {#if sortBy === "joinedDate"}
      <div class="activity-line">
        <i class="fas fa-calendar" aria-hidden="true"></i>
        <span>{formatTimeAgo(user.joinedDate)}</span>
      </div>
    {:else}
      <div class="activity-line" class:recent-activity={isRecentlyActive}>
        <i class="fas fa-clock" aria-hidden="true"></i>
        <span>{user.lastActiveAt ? formatTimeAgo(user.lastActiveAt) : 'New'}</span>
      </div>
    {/if}
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
        aria-label={user.isFollowing ? "Unfollow {user.displayName}" : "Follow {user.displayName}"}
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
    height: 100%;
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
      0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.15));
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
    background: var(--theme-panel-bg, #1a1a2e);
  }

  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-accent) 20%, var(--theme-panel-bg, #1a1a2e)) 0%,
      var(--theme-panel-bg, #1a1a2e) 100%
    );
  }

  .avatar-placeholder i {
    font-size: var(--font-size-xl);
    color: var(--card-accent-light);
    transition: color var(--duration-emphasis) var(--ease-out, ease);
  }

  /* When no follow button, center avatar + info as a group */
  .user-card:not(:has(.user-actions)) {
    justify-content: center;
  }

  /* When follow button exists, user-info fills the gap to push button down */
  .user-card:has(.user-actions) .user-info {
    flex: 1;
  }

  /* User info */
  .user-info {
    text-align: center;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
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

  .pronouns {
    margin: 1px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-style: italic;
    opacity: 0.7;
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

  /* Activity line */
  .activity-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding-top: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .activity-line i {
    font-size: var(--font-size-compact);
    color: var(--card-accent);
    opacity: 0.75;
  }

  .activity-line.recent-activity {
    color: var(--card-accent);
  }

  .activity-line.recent-activity i {
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
    color: var(--text-on-accent, white);
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

  /* Prop identity tag — labeled pill so the glyph isn't the sole signal.
     The prop SVGs are a dark brand-indigo silhouette that collapses to a
     faint line at icon size on dark cards (staff is the worst, and it's the
     most common prop). The white-recolored glyph + text label make every
     prop read uniformly regardless of the card's extracted accent. */
  .prop-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: center;
    max-width: 100%;
    margin: 4px auto 0;
    padding: 3px 9px 3px 7px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid color-mix(in srgb, var(--card-accent) 35%, transparent);
    border-radius: 999px;
  }

  .prop-tag-icon {
    width: 15px;
    height: 15px;
    object-fit: contain;
    flex-shrink: 0;
    /* Force the single-fill prop silhouette to white so it reads on the
       dark pill no matter its native fill color. */
    filter: brightness(0) invert(1);
    opacity: 0.9;
  }

  .prop-tag-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
