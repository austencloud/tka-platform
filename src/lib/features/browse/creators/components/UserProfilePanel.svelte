<script lang="ts">
  /**
   * UserProfilePanel (Browse Module)
   * Comprehensive user profile view with sequences, stats, and achievements
   * Responsive design for mobile and desktop
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/contracts/IBrowseThumbnailProvider";
  import { openSpotlightViewer } from "$lib/shared/application/state/ui/ui-state.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { ILeaderboardManager } from "$lib/shared/community/services/contracts/ILeaderboardManager";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { creatorsViewState } from "../state/creators-view-state.svelte";
  import { browseNavigationState } from "../../shared/state/browse-navigation-state.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ProfileHeaderBar from "./profile/ProfileHeaderBar.svelte";
  import ProfileHeroSection from "./profile/ProfileHeroSection.svelte";
  import ProfileStatsGrid from "./profile/ProfileStatsGrid.svelte";
  import ProfileRankings from "./profile/ProfileRankings.svelte";
  import ProfileTabs from "./profile/ProfileTabs.svelte";
  import ProfileAdminSection from "./profile/ProfileAdminSection.svelte";
  import ProfileConnectionSection from "./profile/ProfileConnectionSection.svelte";

  interface Props {
    userId: string;
    onUserDeleted?: () => void;
  }

  let { userId, onUserDeleted }: Props = $props();

  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  let userProfile = $state<EnhancedUserProfile | null>(null);
  let userSequences = $state<LibrarySequence[]>([]);
  let followingUsers = $state<UserProfile[]>([]);
  let followingLoading = $state(false);
  let followingLoaded = $state(false);
  let followerUsers = $state<UserProfile[]>([]);
  let followersLoading = $state(false);
  let followersLoaded = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let followInProgress = $state(false);
  let activeTab = $state<
    "gallery" | "followers" | "following" | "achievements"
  >("gallery");

  // Services
  let userService: IUserRepository;
  let libraryService: ILibraryRepository;
  let hapticService: IHapticFeedback;
  let leaderboardService: ILeaderboardManager;
  let thumbnailService: IBrowseThumbnailProvider;

  // Personal rankings state (only for own profile)
  interface UserRanks {
    xp: number | null;
    level: number | null;
    sequences: number | null;
    achievements: number | null;
    streak: number | null;
  }
  let userRanks = $state<UserRanks>({
    xp: null,
    level: null,
    sequences: null,
    achievements: null,
    streak: null,
  });
  let isLoadingRanks = $state(false);
  let hasRanks = $derived(
    userRanks.xp !== null ||
      userRanks.level !== null ||
      userRanks.sequences !== null ||
      userRanks.achievements !== null ||
      userRanks.streak !== null
  );

  // Get current user ID
  const currentUserId = $derived(authState.user?.uid);

  // Check if viewing own profile
  const isOwnProfile = $derived(currentUserId === userId);

  // Check if current user is admin (for admin controls)
  const isAdmin = $derived(authState.isAdmin);

  // Handler for admin updates
  function handleAdminUpdate(updates: Partial<EnhancedUserProfile>) {
    if (userProfile) {
      userProfile = { ...userProfile, ...updates };
    }
  }

  onMount(async () => {
    try {
      // Resolve services
      userService = container.items.userRepository;
      libraryService = container.items.libraryRepository;
      hapticService = container.items.hapticFeedback;
      leaderboardService = container.items.leaderboardManager;
      thumbnailService = container.items.browseThumbnailProvider;

      // Load user profile with current user context for follow status
      userProfile = await userService.getUserProfile(userId, currentUserId);

      if (!userProfile) {
        error = "User not found";
        isLoading = false;
        return;
      }

      // Load user's sequences from Firestore
      // If viewing someone else's profile, only show public sequences (Firestore rules)
      userSequences = await libraryService.getUserSequences(userId, {
        visibility: isOwnProfile ? undefined : "public",
      });

      isLoading = false;

      // Load user ranks in background
      loadUserRanks();
    } catch (err) {
      console.error(`[UserProfilePanel] Error loading profile:`, err);
      error = err instanceof Error ? err.message : "Failed to load profile";
      isLoading = false;
    }
  });

  function handleBack() {
    hapticService?.trigger("selection");
    // Use unified navigation state to go back to previous location
    const location = browseNavigationState.goBack();

    if (!location || location.view === "list") {
      // No history or going back to list view
      creatorsViewState.goBack();
    } else if (
      location.view === "profile" &&
      location.contextId &&
      location.contextId !== userId
    ) {
      // Going back to a different profile
      creatorsViewState.viewUserProfile(location.contextId);
    } else {
      // Fallback: go back to list
      creatorsViewState.goBack();
    }
  }

  async function handleFollowToggle() {
    if (!currentUserId || !userProfile) {
      console.warn("[UserProfilePanel] Must be logged in to follow users");
      return;
    }

    if (isOwnProfile) {
      console.warn("[UserProfilePanel] Cannot follow yourself");
      return;
    }

    if (followInProgress) {
      return;
    }

    followInProgress = true;
    hapticService?.trigger("selection");

    try {
      if (userProfile.isFollowing) {
        await userService.unfollowUser(currentUserId, userId);
        // Optimistic update
        userProfile = {
          ...userProfile,
          isFollowing: false,
          followerCount: Math.max(0, userProfile.followerCount - 1),
        };
      } else {
        await userService.followUser(currentUserId, userId);
        // Optimistic update
        userProfile = {
          ...userProfile,
          isFollowing: true,
          followerCount: userProfile.followerCount + 1,
        };
      }
    } catch (err) {
      console.error("[UserProfilePanel] Error toggling follow:", err);
      // Reload profile to get correct state
      userProfile = await userService.getUserProfile(userId, currentUserId);
    } finally {
      followInProgress = false;
    }
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    // Open spotlight viewer with the sequence
    if (thumbnailService) {
      openSpotlightViewer(sequence, thumbnailService);
    }
  }

  async function loadFollowingUsers() {
    if (followingLoaded || followingLoading) return;

    followingLoading = true;
    try {
      followingUsers = await userService.getFollowing(userId, 50);
      followingLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading following users:", err);
    } finally {
      followingLoading = false;
    }
  }

  async function loadFollowerUsers() {
    if (followersLoaded || followersLoading) return;

    followersLoading = true;
    try {
      followerUsers = await userService.getFollowers(userId, 50);
      followersLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading followers:", err);
    } finally {
      followersLoading = false;
    }
  }

  function handleUserCardClick(user: UserProfile) {
    hapticService?.trigger("selection");
    // Navigate to user profile using unified navigation state
    browseNavigationState.viewCreatorProfile(user.id, user.displayName);
  }

  // Load following/followers when tabs are selected
  $effect(() => {
    if (activeTab === "following" && !followingLoaded && userService) {
      loadFollowingUsers();
    }
    if (activeTab === "followers" && !followersLoaded && userService) {
      loadFollowerUsers();
    }
  });

  async function loadUserRanks() {
    if (!leaderboardService) return;

    isLoadingRanks = true;
    try {
      // Fetch ranks in parallel for the profile being viewed
      const [xpRank, levelRank, sequencesRank, achievementsRank, streakRank] =
        await Promise.all([
          leaderboardService.getUserRank(userId, "xp"),
          leaderboardService.getUserRank(userId, "level"),
          leaderboardService.getUserRank(userId, "gallery"),
          leaderboardService.getUserRank(userId, "achievements"),
          leaderboardService.getUserRank(userId, "streak"),
        ]);

      userRanks = {
        xp: xpRank,
        level: levelRank,
        sequences: sequencesRank,
        achievements: achievementsRank,
        streak: streakRank,
      };
    } catch (err) {
      console.error("[UserProfilePanel] Failed to load user ranks:", err);
    } finally {
      isLoadingRanks = false;
    }
  }
</script>

<div class="profile-panel">
  {#if isLoading}
    <PanelState type="loading" message="Loading profile..." />
  {:else if error || !userProfile}
    <div class="error-with-action">
      <PanelState
        type="error"
        title="Profile Not Found"
        message={error || "User not found"}
      />
      <PanelButton variant="secondary" onclick={handleBack}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Go Back
      </PanelButton>
    </div>
  {:else}
    <ProfileHeaderBar onBack={handleBack} />

    <!-- Scrollable content -->
    <div class="profile-content">
      <ProfileHeroSection
        {userProfile}
        {currentUserId}
        {isOwnProfile}
        {followInProgress}
        onFollowToggle={handleFollowToggle}
      />

      <ProfileStatsGrid {userProfile} />

      <ProfileRankings {userRanks} {hasRanks} {isLoadingRanks} />

      <ProfileTabs
        {activeTab}
        {userProfile}
        {userSequences}
        {followerUsers}
        {followingUsers}
        {followersLoading}
        {followingLoading}
        onTabChange={(tab) => (activeTab = tab)}
        onSequenceClick={handleSequenceClick}
        onUserClick={handleUserCardClick}
      />

      <!-- Your Connection Section (only when logged in, viewing someone else) -->
      {#if currentUserId && !isOwnProfile}
        <ProfileConnectionSection
          targetUserId={userId}
          targetUserName={userProfile.displayName}
        />
      {/if}

      <!-- Admin Controls (only visible to admins, not on own profile) -->
      {#if isAdmin && !isOwnProfile}
        <ProfileAdminSection
          {userProfile}
          onUserUpdated={handleAdminUpdate}
          {onUserDeleted}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     USER PROFILE PANEL - Centered content layout matching Settings pattern
     ═══════════════════════════════════════════════════════════════════════════ */
  .profile-panel {
    container-type: inline-size;
    container-name: profile-panel;

    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }

  .error-with-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 100%;
    padding: 40px 20px;
  }

  .profile-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;

    /* Centered content container - matches Settings ProfileTab */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(16px, 4cqi, 32px);
  }

  /* Inner content wrapper for max-width constraint */
  .profile-content > :global(*) {
    width: 100%;
    max-width: 900px;
  }

  /* ════════════════════════════════════════════════════════════════════════
     RESPONSIVE BREAKPOINTS
     ════════════════════════════════════════════════════════════════════════ */
  @container profile-panel (max-width: 768px) {
    .profile-content {
      padding: clamp(12px, 3cqi, 20px);
    }
  }

  @container profile-panel (max-width: 480px) {
    .profile-content {
      padding: 12px;
    }
  }

  /* Large screens - generous breathing room */
  @container profile-panel (min-width: 1400px) {
    .profile-content {
      padding: clamp(32px, 5cqi, 48px);
    }
  }
</style>
