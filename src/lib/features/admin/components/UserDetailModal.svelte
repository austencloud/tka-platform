<!--
  UserDetailModal.svelte

  Full user detail view as a modal for admin users.
  Combines profile info, admin controls, and activity tracking.

  Layout:
  - Large screens (>1024px): Two-column layout (Profile/Admin | Activity)
  - Medium/small screens: Tabbed layout (Profile | Activity | Admin)
  - Mobile: Full-screen takeover
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { getUserProfile } from "$lib/shared/community/services/user-repository";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "$lib/shared/browse/components/AvatarImage.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import ProfileAdminSection from "$lib/features/browse/creators/components/profile/ProfileAdminSection.svelte";
  import UserActivityAnalytics from "./UserActivityAnalytics.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  interface Props {
    open: boolean;
    userId: string | null;
    onclose: () => void;
    onUserDeleted?: () => void;
  }

  let { open = $bindable(false), userId, onclose, onUserDeleted }: Props = $props();

  // Profile state
  let userProfile = $state<EnhancedUserProfile | null>(null);
  let isLoadingProfile = $state(true);
  let profileError = $state<string | null>(null);

  // UI state
  let activeTab = $state<"profile" | "activity" | "admin">("profile");
  let layoutMode = $state<"compact" | "medium" | "large">("compact");

  const currentUserId = $derived(authState.user?.uid);
  const isAdmin = $derived(authState.isAdmin);

  // Load data when modal opens with a user
  $effect(() => {
    if (open && userId) {
      loadUserData(userId);
    }
  });

  async function loadUserData(uid: string) {
    isLoadingProfile = true;
    profileError = null;
    userProfile = null;

    try {
      userProfile = await getUserProfile(uid, currentUserId);
    } catch (err) {
      console.error("[UserDetailModal] Error loading user data:", err);
      profileError = err instanceof Error ? err.message : "Failed to load user";
    } finally {
      isLoadingProfile = false;
    }
  }

  function handleAdminUpdate(updates: Partial<EnhancedUserProfile>) {
    if (userProfile) {
      userProfile = { ...userProfile, ...updates };
    }
  }

  function handleUserDeleted() {
    onUserDeleted?.();
    onclose();
  }

  /**
   * Determine layout mode based on available viewport space.
   * - Large: Both width (≥1400px) and height (≥900px) have room for two-column
   * - Medium: Enough width AND height for stacked layout without excessive scrolling
   * - Compact: Small screens - use tabs to save vertical space
   */
  function determineLayoutMode(): "compact" | "medium" | "large" {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Large: enough space for side-by-side layout without scrolling
    if (width >= 1400 && height >= 900) {
      return "large";
    }

    // Medium: need both reasonable width AND height for stacked layout
    // The stacked layout (profile+admin above, activity below) needs ~950px height
    // to avoid excessive scrolling
    if (width >= 900 && height >= 950) {
      return "medium";
    }

    // Compact: use tabs to save vertical space when height is constrained
    return "compact";
  }

  onMount(() => {
    const checkScreenSize = () => {
      layoutMode = determineLayoutMode();
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  });
</script>

<BaseModal
  bind:open
  onclose={() => onclose()}
  size={layoutMode === "compact" ? "lg" : "xl"}
  closeOnBackdrop={true}
  closeOnEscape={true}
>
  {#snippet header()}
    <header class="modal-header">
      <h2>
        {#if userProfile}
          {userProfile.displayName}
        {:else}
          {t("admin_user_details")}
        {/if}
      </h2>
      <button
        class="close-btn"
        onclick={() => onclose()}
        aria-label={t("common_close")}
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>
  {/snippet}

  <div class="modal-body-content" class:layout-large={layoutMode === "large"} class:layout-medium={layoutMode === "medium"} class:layout-compact={layoutMode === "compact"}>
    {#if isLoadingProfile}
      <div class="loading-state">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <span>{t("common_loading")}</span>
      </div>
    {:else if profileError || !userProfile}
      <div class="error-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{profileError || t("admin_user_not_found")}</span>
      </div>
    {:else if layoutMode === "large"}
      <!-- Two-column layout for large screens -->
      <div class="two-column-layout">
        <div class="column-primary">
          <!-- Profile Section -->
          <section class="profile-section">
            <div class="user-header">
              <div class="avatar-wrapper large">
                <AvatarImage
                  src={userProfile.avatar}
                  alt={userProfile.displayName}
                  name={userProfile.displayName}
                  size={120}
                />
              </div>
              <div class="user-info">
                <h3 class="display-name">{userProfile.displayName}</h3>
                <p class="username">@{userProfile.username}</p>
                {#if userProfile.adminLabel}
                  <p class="admin-label">
                    <i class="fas fa-user-tag" aria-hidden="true"></i>
                    {userProfile.adminLabel}
                  </p>
                {/if}
              </div>
              <div class="status-badges">
                {#if userProfile.isDisabled}
                  <span class="badge disabled">Disabled</span>
                {/if}
                {#if userProfile.isHidden}
                  <span class="badge hidden">Hidden</span>
                {/if}
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>
            </div>

            <!-- Stats Row -->
            <div class="stats-row">
              <div class="stat">
                <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                <span class="stat-label">Sequences</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.followerCount || 0}</span>
                <span class="stat-label">Followers</span>
              </div>
            </div>
          </section>

          <!-- Admin Controls -->
          {#if isAdmin}
            <ProfileAdminSection
              {userProfile}
              onUserUpdated={handleAdminUpdate}
              onUserDeleted={handleUserDeleted}
            />
          {/if}
        </div>

        <div class="column-secondary">
          <!-- Activity Analytics Section -->
          {#if userId}
            <UserActivityAnalytics userId={userId} />
          {/if}
        </div>
      </div>
    {:else if layoutMode === "medium"}
      <!-- Medium layout: horizontal profile + admin with activity below -->
      <div class="medium-layout">
        <div class="medium-top-row">
          <!-- Compact profile card -->
          <div class="medium-profile-card">
            <div class="user-header compact">
              <div class="avatar-wrapper">
                <AvatarImage
                  src={userProfile.avatar}
                  alt={userProfile.displayName}
                  name={userProfile.displayName}
                  size={64}
                />
              </div>
              <div class="user-info">
                <h3 class="display-name">{userProfile.displayName}</h3>
                <p class="username">@{userProfile.username}</p>
              </div>
              <div class="status-badges">
                {#if userProfile.isDisabled}
                  <span class="badge disabled">Disabled</span>
                {/if}
                {#if userProfile.isHidden}
                  <span class="badge hidden">Hidden</span>
                {/if}
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>
            </div>
            <div class="stats-row compact">
              <div class="stat">
                <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                <span class="stat-label">Sequences</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.followerCount || 0}</span>
                <span class="stat-label">Followers</span>
              </div>
            </div>
          </div>

          <!-- Admin controls inline -->
          {#if isAdmin}
            <div class="medium-admin-card">
              <ProfileAdminSection
                {userProfile}
                onUserUpdated={handleAdminUpdate}
                onUserDeleted={handleUserDeleted}
              />
            </div>
          {/if}
        </div>

        <!-- Activity Analytics section below -->
        <div class="medium-activity-row">
          {#if userId}
            <UserActivityAnalytics userId={userId} compact={true} />
          {/if}
        </div>
      </div>
    {:else}
      <!-- Tabbed layout (compact) for small screens -->
      <div class="tabbed-layout">
        <div class="tab-nav" role="tablist">
          <button
            role="tab"
            class="tab-btn"
            class:active={activeTab === "profile"}
            aria-selected={activeTab === "profile"}
            onclick={() => (activeTab = "profile")}
          >
            <i class="fas fa-user" aria-hidden="true"></i>
            Profile
          </button>
          <button
            role="tab"
            class="tab-btn"
            class:active={activeTab === "activity"}
            aria-selected={activeTab === "activity"}
            onclick={() => (activeTab = "activity")}
          >
            <i class="fas fa-history" aria-hidden="true"></i>
            Activity
          </button>
          {#if isAdmin}
            <button
              role="tab"
              class="tab-btn admin"
              class:active={activeTab === "admin"}
              aria-selected={activeTab === "admin"}
              onclick={() => (activeTab = "admin")}
            >
              <i class="fas fa-shield-halved" aria-hidden="true"></i>
              Admin
            </button>
          {/if}
        </div>

        <div class="tab-content themed-scrollbar">
          {#if activeTab === "profile"}
            <section class="profile-section">
              <div class="user-header compact">
                <div class="avatar-wrapper">
                  <AvatarImage
                    src={userProfile.avatar}
                    alt={userProfile.displayName}
                    name={userProfile.displayName}
                    size={72}
                  />
                </div>
                <div class="user-info">
                  <h3 class="display-name">{userProfile.displayName}</h3>
                  <p class="username">@{userProfile.username}</p>
                  {#if userProfile.adminLabel}
                    <p class="admin-label">
                      <i class="fas fa-user-tag" aria-hidden="true"></i>
                      {userProfile.adminLabel}
                    </p>
                  {/if}
                </div>
              </div>

              <div class="status-badges">
                {#if userProfile.isDisabled}
                  <span class="badge disabled">Disabled</span>
                {/if}
                {#if userProfile.isHidden}
                  <span class="badge hidden">Hidden</span>
                {/if}
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>

              <div class="stats-row">
                <div class="stat">
                  <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                  <span class="stat-label">Sequences</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{userProfile.followerCount || 0}</span>
                  <span class="stat-label">Followers</span>
                </div>
              </div>

              {#if userProfile.bio}
                <p class="bio">{userProfile.bio}</p>
              {/if}
            </section>

          {:else if activeTab === "activity"}
            {#if userId}
              <UserActivityAnalytics userId={userId} compact={true} />
            {/if}

          {:else if activeTab === "admin" && isAdmin}
            <ProfileAdminSection
              {userProfile}
              onUserUpdated={handleAdminUpdate}
              onUserDeleted={handleUserDeleted}
            />
          {/if}
        </div>
      </div>
    {/if}
  </div>
</BaseModal>

<script module>
  function getRoleColor(role: string | undefined): string {
    switch (role) {
      case "admin":
        return "#ef4444";
      case "tester":
        return "#8b5cf6";
      case "creator":
        return "#3b82f6";
      default:
        return "#64748b";
    }
  }
</script>

<style>
  /* Modal Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Body Content - BaseModal's .modal-body handles overflow scrolling */
  .modal-body-content {
    padding: 20px;
    min-height: 300px;
  }

  .modal-body-content.layout-large {
    padding: 32px 40px;
  }

  .modal-body-content.layout-medium {
    padding: 24px;
  }

  .modal-body-content.layout-compact {
    padding: 16px;
  }

  /* Loading / Error States */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 200px;
    color: var(--theme-text-dim);
  }

  .error-state {
    color: var(--semantic-error);
  }


  /* Two Column Layout (Large Screens) */
  .two-column-layout {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 48px;
    height: 100%;
  }

  .column-primary,
  .column-secondary {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .column-secondary {
    border-left: 1px solid var(--theme-stroke);
    padding-left: 48px;
  }

  /* Tabbed Layout (Medium/Small Screens) */
  .tabbed-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .tab-nav {
    display: flex;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
    margin-bottom: 16px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .tab-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .tab-btn.active {
    background: var(--theme-accent-bg);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .tab-btn.admin {
    margin-left: auto;
  }

  .tab-btn.admin.active {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: var(--semantic-error);
    color: var(--semantic-error);
  }

  .tab-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* Profile Section */
  .profile-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .user-header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }

  .user-header.compact {
    flex-wrap: wrap;
  }

  .avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .avatar-wrapper.large {
    /* Reserved for large screen avatar styling */
    flex-shrink: 0;
  }

  .level-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: linear-gradient(135deg, var(--semantic-warning) 0%, #d97706 100%);
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-radius: 14px;
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: white;
  }

  .level-badge.small {
    padding: 3px 6px;
    font-size: var(--font-size-compact, 12px);
  }

  .level-badge i {
    font-size: 12px;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .display-name {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--theme-text);
    word-break: break-word;
  }

  .username {
    margin: 6px 0 0;
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
  }

  .admin-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0 0;
    font-size: var(--font-size-base);
    color: var(--theme-accent);
    font-weight: 500;
  }

  .status-badges {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .badge {
    padding: 6px 14px;
    border-radius: 14px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge.disabled {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  .badge.hidden {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    color: var(--semantic-warning);
  }

  .badge.role {
    background: color-mix(in srgb, var(--role-color, #64748b) 20%, transparent);
    color: var(--role-color, #64748b);
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 24px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--theme-text);
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bio {
    margin: 0;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
    line-height: 1.6;
  }

  /* Medium Layout - horizontal profile/admin with activity below */
  .medium-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .medium-top-row {
    display: flex;
    gap: 20px;
    align-items: stretch;
  }

  .medium-profile-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .medium-admin-card {
    flex: 1;
    min-width: 0;
  }

  .medium-activity-row {
    flex-shrink: 0;
  }

  /* Compact stats for medium layout */
  .stats-row.compact {
    padding: 12px;
    gap: 8px;
  }

  .stats-row.compact .stat-value {
    font-size: var(--font-size-lg);
  }

  .stats-row.compact .stat-label {
    font-size: var(--font-size-compact);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .modal-body-content {
      padding: 16px;
    }

    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .tab-btn {
      padding: 8px 12px;
      font-size: var(--font-size-compact);
    }

    .tab-btn i {
      font-size: 14px;
    }
  }
</style>
