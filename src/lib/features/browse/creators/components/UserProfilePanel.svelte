<script lang="ts">

import { getLibraryRepository } from "$lib/features/library/getLibraryRepository";
  /**
   * UserProfilePanel (Browse Module)
   * Comprehensive user profile view with sequences, stats, and achievements
   * Responsive design for mobile and desktop
   */

  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount } from "svelte";
  import { doc, setDoc } from "firebase/firestore";
  import { getUserRepository } from "$lib/shared/community/getUserRepository";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { creatorsViewState } from "../state/creators-view-state.svelte";
  import { browseNavigationState } from "../../shared/state/browse-navigation-state.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ProfileHeaderBar from "./profile/ProfileHeaderBar.svelte";
  import ProfileHeroSection from "./profile/ProfileHeroSection.svelte";
  import ProfileStatsGrid from "./profile/ProfileStatsGrid.svelte";
  import ProfileTabs from "./profile/ProfileTabs.svelte";
  import ProfileAdminSection from "./profile/ProfileAdminSection.svelte";
  import ProfileConnectionSection from "./profile/ProfileConnectionSection.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";

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
  let activeTab = $state<"gallery" | "followers" | "following">("gallery");

  // Services
  let userService: IUserRepository;
  let libraryService: ILibraryRepository;
  let hapticService: IHapticFeedback;

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

  // Write the correct sequence count to Firestore when the denormalized
  // counter has drifted from the actual number of sequences.
  async function reconcileCount(uid: string, actualCount: number) {
    try {
      const firestore = await getFirestoreInstance();
      await setDoc(
        doc(firestore, `users/${uid}`),
        { sequenceCount: actualCount },
        { merge: true }
      );
    } catch (err) {
      console.warn("[UserProfilePanel] Failed to reconcile sequenceCount:", err);
    }
  }

  onMount(async () => {
    try {
      // Resolve services
      userService = getUserRepository();
      libraryService = getLibraryRepository();
      hapticService = getHapticFeedback();

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

      // Always use the actual loaded sequence count as the source of truth.
      // The denormalized sequenceCount field on the user doc can drift when
      // increment writes fail silently. Overwrite it every time we have real data.
      const actualCount = userSequences.length;
      if (userProfile.sequenceCount !== actualCount) {
        userProfile = { ...userProfile, sequenceCount: actualCount };
        // Write the correct count back to Firestore (non-blocking).
        // Works for own profile (isOwner rule) and admin viewing others.
        void reconcileCount(userId, actualCount);
      }

      isLoading = false;
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
      error = "Failed to update follow status";
      userProfile = await userService.getUserProfile(userId, currentUserId);
    } finally {
      followInProgress = false;
    }
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    openSequenceViewer(sequence, {
      returnPath: `/browse/creators/${userId}`,
      returnLabel: userProfile?.displayName ?? "Creator",
      viewingContext: "creator-expression",
    });
  }

  async function loadFollowingUsers() {
    if (followingLoaded || followingLoading) return;

    followingLoading = true;
    try {
      followingUsers = await userService.getFollowing(userId, 50);
      followingLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading following users:", err);
      error = "Failed to load following list";
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
      error = "Failed to load followers list";
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
    flex-shrink: 0;
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
