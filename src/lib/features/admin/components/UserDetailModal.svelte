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
  import { container } from "$lib/shared/di";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { IUserActivityTracker, SessionSummary } from "../services/contracts/IUserActivityTracker";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { ActivityEvent } from "$lib/shared/analytics/domain/models/ActivityEvent";
  import AvatarImage from "$lib/features/browse/creators/components/profile/AvatarImage.svelte";
  import ProfileAdminSection from "$lib/features/browse/creators/components/profile/ProfileAdminSection.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  interface Props {
    open: boolean;
    userId: string | null;
    onclose: () => void;
    onUserDeleted?: () => void;
  }

  let { open = $bindable(false), userId, onclose, onUserDeleted }: Props = $props();

  // Services
  let userService: IUserRepository | null = null;
  let activityService: IUserActivityTracker | null = null;

  // Profile state
  let userProfile = $state<EnhancedUserProfile | null>(null);
  let isLoadingProfile = $state(true);
  let profileError = $state<string | null>(null);

  // Activity state
  let sessions = $state<SessionSummary[]>([]);
  let selectedSession = $state<SessionSummary | null>(null);
  let sessionEvents = $state<ActivityEvent[]>([]);
  let isLoadingActivity = $state(true);
  let isLoadingEvents = $state(false);

  // UI state
  let activeTab = $state<"profile" | "activity" | "admin">("profile");
  let layoutMode = $state<"compact" | "medium" | "large">("compact");
  let modalBodyRef = $state<HTMLDivElement | null>(null);

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
    isLoadingActivity = true;
    profileError = null;
    userProfile = null;
    sessions = [];
    selectedSession = null;
    sessionEvents = [];

    try {
      userService = container.items.userRepository;
      activityService = container.items.userActivityTracker;

      if (!userService || !activityService) {
        throw new Error("Services not available");
      }

      // Load profile and sessions in parallel
      const [profile, userSessions] = await Promise.all([
        userService.getUserProfile(uid, currentUserId),
        activityService.getUserSessions(uid, 20),
      ]);

      userProfile = profile;
      sessions = userSessions;
    } catch (err) {
      console.error("[UserDetailModal] Error loading user data:", err);
      profileError = err instanceof Error ? err.message : "Failed to load user";
    } finally {
      isLoadingProfile = false;
      isLoadingActivity = false;
    }
  }

  async function selectSession(session: SessionSummary) {
    if (selectedSession?.sessionId === session.sessionId) {
      selectedSession = null;
      sessionEvents = [];
      return;
    }

    selectedSession = session;
    isLoadingEvents = true;

    try {
      if (activityService && userId) {
        sessionEvents = await activityService.getSessionActivity(userId, session.sessionId);
      }
    } catch (e) {
      console.error("Failed to load session events:", e);
      sessionEvents = [];
    } finally {
      isLoadingEvents = false;
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

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getEventIcon(category: string): string {
    switch (category) {
      case "navigation":
        return "fa-compass";
      case "creation":
        return "fa-plus";
      case "session":
        return "fa-clock";
      case "interaction":
        return "fa-hand-pointer";
      default:
        return "fa-circle";
    }
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
  size="xl"
  closeOnBackdrop={true}
  closeOnEscape={true}
  --modal-width="min(95vw, 1600px)"
  --modal-max-height="min(90vh, 1200px)"
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
        <div class="spinner" aria-hidden="true"></div>
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
                <div class="level-badge">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <span>{userProfile.currentLevel}</span>
                </div>
              </div>
              <div class="user-info">
                <h3 class="display-name">{userProfile.displayName}</h3>
                <p class="username">@{userProfile.username}</p>
                {#if userProfile.email}
                  <p class="email">{userProfile.email}</p>
                {/if}
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
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>
            </div>

            <!-- Stats Row -->
            <div class="stats-row">
              <div class="stat">
                <span class="stat-value">{userProfile.totalXP?.toLocaleString() || 0}</span>
                <span class="stat-label">XP</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                <span class="stat-label">Sequences</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.followerCount || 0}</span>
                <span class="stat-label">Followers</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.currentStreak || 0}</span>
                <span class="stat-label">Streak</span>
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
          <!-- Activity Section -->
          <section class="activity-section">
            <h4 class="section-title">
              <i class="fas fa-history" aria-hidden="true"></i>
              Recent Activity
            </h4>
            {#if isLoadingActivity}
              <div class="loading-inline">
                <div class="spinner-small" aria-hidden="true"></div>
              </div>
            {:else if sessions.length === 0}
              <div class="empty-state">
                <i class="fas fa-clock" aria-hidden="true"></i>
                <span>No sessions recorded</span>
              </div>
            {:else}
              <div class="sessions-list themed-scrollbar">
                {#each sessions as session}
                  <button
                    class="session-card"
                    class:selected={selectedSession?.sessionId === session.sessionId}
                    onclick={() => selectSession(session)}
                  >
                    <div class="session-header">
                      <span class="session-date">{formatDate(session.startedAt)}</span>
                      <span class="session-duration">{formatDuration(session.duration)}</span>
                    </div>
                    <div class="session-meta">
                      <span class="event-count">
                        <i class="fas fa-list" aria-hidden="true"></i>
                        {session.eventCount} events
                      </span>
                      {#if session.modules.length > 0}
                        <span class="modules">
                          {session.modules.slice(0, 3).join(", ")}
                          {#if session.modules.length > 3}
                            +{session.modules.length - 3}
                          {/if}
                        </span>
                      {/if}
                    </div>
                  </button>

                  {#if selectedSession?.sessionId === session.sessionId}
                    <div class="session-events">
                      {#if isLoadingEvents}
                        <div class="loading-inline">
                          <div class="spinner-small" aria-hidden="true"></div>
                        </div>
                      {:else if sessionEvents.length === 0}
                        <p class="no-events">No events recorded</p>
                      {:else}
                        <div class="events-timeline">
                          {#each sessionEvents as event}
                            <div class="event-item">
                              <i class="fas {getEventIcon(event.category)}" aria-hidden="true"></i>
                              <div class="event-info">
                                <span class="event-type">{event.eventType}</span>
                                <span class="event-time">{formatTime(event.timestamp)}</span>
                              </div>
                              {#if event.metadata?.module}
                                <span class="event-module">{event.metadata.module}</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </section>
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
                <div class="level-badge small">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <span>{userProfile.currentLevel}</span>
                </div>
              </div>
              <div class="user-info">
                <h3 class="display-name">{userProfile.displayName}</h3>
                <p class="username">@{userProfile.username}</p>
                {#if userProfile.email}
                  <p class="email">{userProfile.email}</p>
                {/if}
              </div>
              <div class="status-badges">
                {#if userProfile.isDisabled}
                  <span class="badge disabled">Disabled</span>
                {/if}
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>
            </div>
            <div class="stats-row compact">
              <div class="stat">
                <span class="stat-value">{userProfile.totalXP?.toLocaleString() || 0}</span>
                <span class="stat-label">XP</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                <span class="stat-label">Sequences</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.followerCount || 0}</span>
                <span class="stat-label">Followers</span>
              </div>
              <div class="stat">
                <span class="stat-value">{userProfile.currentStreak || 0}</span>
                <span class="stat-label">Streak</span>
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

        <!-- Activity section below -->
        <div class="medium-activity-row">
          <section class="activity-section compact">
            <h4 class="section-title">
              <i class="fas fa-history" aria-hidden="true"></i>
              Recent Activity
            </h4>
            {#if isLoadingActivity}
              <div class="loading-inline">
                <div class="spinner-small" aria-hidden="true"></div>
              </div>
            {:else if sessions.length === 0}
              <div class="empty-state compact">
                <i class="fas fa-clock" aria-hidden="true"></i>
                <span>No sessions recorded</span>
              </div>
            {:else}
              <div class="sessions-grid">
                {#each sessions.slice(0, 4) as session}
                  <button
                    class="session-card compact"
                    class:selected={selectedSession?.sessionId === session.sessionId}
                    onclick={() => selectSession(session)}
                  >
                    <div class="session-header">
                      <span class="session-date">{formatDate(session.startedAt)}</span>
                      <span class="session-duration">{formatDuration(session.duration)}</span>
                    </div>
                    <div class="session-meta">
                      <span class="event-count">
                        <i class="fas fa-list" aria-hidden="true"></i>
                        {session.eventCount} events
                      </span>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        </div>
      </div>
    {:else}
      <!-- Tabbed layout (compact) for small screens -->
      <div class="tabbed-layout">
        <nav class="tab-nav" role="tablist">
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
        </nav>

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
                  <div class="level-badge small">
                    <i class="fas fa-star" aria-hidden="true"></i>
                    <span>{userProfile.currentLevel}</span>
                  </div>
                </div>
                <div class="user-info">
                  <h3 class="display-name">{userProfile.displayName}</h3>
                  <p class="username">@{userProfile.username}</p>
                  {#if userProfile.email}
                    <p class="email">{userProfile.email}</p>
                  {/if}
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
                <span class="badge role" style="--role-color: {getRoleColor(userProfile.role)}">
                  {userProfile.role || "user"}
                </span>
              </div>

              <div class="stats-row">
                <div class="stat">
                  <span class="stat-value">{userProfile.totalXP?.toLocaleString() || 0}</span>
                  <span class="stat-label">XP</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{userProfile.sequenceCount || 0}</span>
                  <span class="stat-label">Sequences</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{userProfile.followerCount || 0}</span>
                  <span class="stat-label">Followers</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{userProfile.currentStreak || 0}</span>
                  <span class="stat-label">Streak</span>
                </div>
              </div>

              {#if userProfile.bio}
                <p class="bio">{userProfile.bio}</p>
              {/if}
            </section>

          {:else if activeTab === "activity"}
            <section class="activity-section">
              {#if isLoadingActivity}
                <div class="loading-inline">
                  <div class="spinner-small" aria-hidden="true"></div>
                </div>
              {:else if sessions.length === 0}
                <div class="empty-state">
                  <i class="fas fa-clock" aria-hidden="true"></i>
                  <span>No sessions recorded</span>
                </div>
              {:else}
                <div class="sessions-list">
                  {#each sessions as session}
                    <button
                      class="session-card"
                      class:selected={selectedSession?.sessionId === session.sessionId}
                      onclick={() => selectSession(session)}
                    >
                      <div class="session-header">
                        <span class="session-date">{formatDate(session.startedAt)}</span>
                        <span class="session-duration">{formatDuration(session.duration)}</span>
                      </div>
                      <div class="session-meta">
                        <span class="event-count">
                          <i class="fas fa-list" aria-hidden="true"></i>
                          {session.eventCount} events
                        </span>
                        {#if session.modules.length > 0}
                          <span class="modules">
                            {session.modules.slice(0, 3).join(", ")}
                            {#if session.modules.length > 3}
                              +{session.modules.length - 3}
                            {/if}
                          </span>
                        {/if}
                      </div>
                    </button>

                    {#if selectedSession?.sessionId === session.sessionId}
                      <div class="session-events">
                        {#if isLoadingEvents}
                          <div class="loading-inline">
                            <div class="spinner-small" aria-hidden="true"></div>
                          </div>
                        {:else if sessionEvents.length === 0}
                          <p class="no-events">No events recorded</p>
                        {:else}
                          <div class="events-timeline">
                            {#each sessionEvents as event}
                              <div class="event-item">
                                <i class="fas {getEventIcon(event.category)}" aria-hidden="true"></i>
                                <div class="event-info">
                                  <span class="event-type">{event.eventType}</span>
                                  <span class="event-time">{formatTime(event.timestamp)}</span>
                                </div>
                                {#if event.metadata?.module}
                                  <span class="event-module">{event.metadata.module}</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </section>

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

<script context="module">
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
    width: 48px;
    height: 48px;
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

  /* Body Content */
  .modal-body-content {
    padding: 20px;
    min-height: 300px;
    /* Prevent content from overflowing modal - scroll if needed */
    max-height: calc(90vh - 80px); /* Account for modal header */
    overflow-y: auto;
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
  .error-state,
  .empty-state {
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

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-inline {
    display: flex;
    justify-content: center;
    padding: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .spinner-small {
      animation: none;
      border-top-color: var(--theme-accent);
      border-right-color: var(--theme-accent);
    }
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
    /* Extra styling for large screens */
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
    font-size: 10px;
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

  .email {
    margin: 4px 0 0;
    font-size: var(--font-size-sm);
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

  /* Activity Section */
  .activity-section {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title i {
    font-size: 1.1rem;
  }

  .sessions-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .session-card {
    display: block;
    width: 100%;
    padding: 16px 20px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .session-card:hover {
    background: var(--theme-card-hover-bg);
  }

  .session-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .session-card.selected {
    background: var(--theme-accent-bg);
    border-color: var(--theme-accent);
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .session-date {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--theme-text);
  }

  .session-duration {
    font-size: var(--font-size-sm);
    color: var(--theme-accent);
    font-weight: 600;
    padding: 4px 10px;
    background: var(--theme-accent-bg);
    border-radius: 8px;
  }

  .session-meta {
    display: flex;
    gap: 16px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .event-count {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .modules {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-events {
    margin-top: 12px;
    padding: 16px;
    background: var(--theme-panel-bg);
    border-radius: 10px;
  }

  .no-events {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .events-timeline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 300px;
    overflow-y: auto;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    padding: 8px 0;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .event-item:last-child {
    border-bottom: none;
  }

  .event-item i {
    width: 18px;
    color: var(--theme-accent);
    opacity: 0.8;
    font-size: var(--font-size-base);
  }

  .event-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .event-type {
    color: var(--theme-text);
    font-weight: 500;
  }

  .event-time {
    color: var(--theme-text-dim);
  }

  .event-module {
    padding: 4px 10px;
    background: var(--theme-accent-bg);
    border-radius: 6px;
    font-size: var(--font-size-sm);
    color: var(--theme-accent);
    font-weight: 500;
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

  .activity-section.compact {
    padding: 0;
  }

  .activity-section.compact .section-title {
    margin-bottom: 12px;
    font-size: var(--font-size-sm);
  }

  .sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .session-card.compact {
    padding: 12px;
  }

  .session-card.compact .session-header {
    margin-bottom: 4px;
  }

  .session-card.compact .session-date {
    font-size: var(--font-size-sm);
  }

  .session-card.compact .session-duration {
    padding: 2px 8px;
    font-size: var(--font-size-compact);
  }

  .session-card.compact .session-meta {
    font-size: var(--font-size-compact);
  }

  .empty-state.compact {
    height: 80px;
    flex-direction: row;
    gap: 8px;
  }

  .empty-state.compact i {
    font-size: 1.25rem;
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

    /* Hide text, show icon only on very small screens */
    @media (max-width: 480px) {
      .tab-btn span {
        display: none;
      }
    }
  }
</style>
