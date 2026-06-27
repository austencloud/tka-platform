<script lang="ts">
  import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { doc, setDoc } from "firebase/firestore";
  import { getUserProfile, followUser, unfollowUser, getFollowers, getFollowing } from "$lib/shared/community/services/user-repository";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { creatorsViewState } from "../state/creators-view-state.svelte";
  import { browseNavigationState } from "$lib/shared/browse/state/browse-navigation-state.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ProfileHeaderBar from "./profile/ProfileHeaderBar.svelte";
  import ProfileHeroSection from "./profile/ProfileHeroSection.svelte";
  import ProfileShowcase from "./profile/ProfileShowcase.svelte";
  import ProfileTabs from "./profile/ProfileTabs.svelte";
  import ProfileAdminSection from "./profile/ProfileAdminSection.svelte";
  import ProfileConnectionSection from "./profile/ProfileConnectionSection.svelte";
  import FollowersModal from "./profile/FollowersModal.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";

  interface Props {
    userId: string;
    onUserDeleted?: () => void;
  }

  let { userId, onUserDeleted }: Props = $props();

  let userProfile = $state<EnhancedUserProfile | null>(null);
  let userSequences = $state<LibrarySequence[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let followInProgress = $state(false);

  // Followers/Following modal state
  let followersModalOpen = $state(false);
  let followersModalType = $state<"followers" | "following">("followers");
  let followerUsers = $state<UserProfile[]>([]);
  let followingUsers = $state<UserProfile[]>([]);
  let followersLoading = $state(false);
  let followingLoading = $state(false);
  let followersLoaded = $state(false);
  let followingLoaded = $state(false);

  // Services
  let libraryService: LibraryRepository;
  let hapticService: HapticFeedback;

  const currentUserId = $derived(authState.user?.uid);
  const isOwnProfile = $derived(currentUserId === userId);
  const isAdmin = $derived(authState.isAdmin);

  const modalUsers = $derived(followersModalType === "followers" ? followerUsers : followingUsers);
  const modalLoading = $derived(followersModalType === "followers" ? followersLoading : followingLoading);

  function handleAdminUpdate(updates: Partial<EnhancedUserProfile>) {
    if (userProfile) {
      userProfile = { ...userProfile, ...updates };
    }
  }

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
      libraryService = getLibraryRepository();
      hapticService = getHapticFeedback();

      userProfile = await getUserProfile(userId, currentUserId);

      if (!userProfile) {
        error = "User not found";
        isLoading = false;
        return;
      }

      userSequences = await libraryService.getUserSequences(userId, {
        visibility: isOwnProfile ? undefined : "public",
      });

      const actualCount = userSequences.length;
      if (userProfile.sequenceCount !== actualCount) {
        userProfile = { ...userProfile, sequenceCount: actualCount };
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
    const location = browseNavigationState.goBack();

    if (!location || location.view === "list") {
      creatorsViewState.goBack();
    } else if (
      location.view === "profile" &&
      location.contextId &&
      location.contextId !== userId
    ) {
      creatorsViewState.viewUserProfile(location.contextId);
    } else {
      creatorsViewState.goBack();
    }
  }

  async function handleFollowToggle() {
    if (!currentUserId || !userProfile) return;
    if (isOwnProfile || followInProgress) return;

    followInProgress = true;
    hapticService?.trigger("selection");

    try {
      if (userProfile.isFollowing) {
        await unfollowUser(currentUserId, userId);
        userProfile = {
          ...userProfile,
          isFollowing: false,
          followerCount: Math.max(0, userProfile.followerCount - 1),
        };
      } else {
        await followUser(currentUserId, userId);
        userProfile = {
          ...userProfile,
          isFollowing: true,
          followerCount: userProfile.followerCount + 1,
        };
      }
    } catch (err) {
      console.error("[UserProfilePanel] Error toggling follow:", err);
      error = "Failed to update follow status";
      userProfile = await getUserProfile(userId, currentUserId);
    } finally {
      followInProgress = false;
    }
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    openSequenceViewer(sequence, {
      returnPath: `/browse/creators/${userId}`,
      returnLabel: userProfile?.displayName ?? "Creator",
    });
  }

  async function loadFollowerUsers() {
    if (followersLoaded || followersLoading) return;
    followersLoading = true;
    try {
      followerUsers = await getFollowers(userId, 50);
      followersLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading followers:", err);
      toast.error("Failed to load followers. Please try again.");
    } finally {
      followersLoading = false;
    }
  }

  async function loadFollowingUsers() {
    if (followingLoaded || followingLoading) return;
    followingLoading = true;
    try {
      followingUsers = await getFollowing(userId, 50);
      followingLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading following:", err);
      toast.error("Failed to load following list. Please try again.");
    } finally {
      followingLoading = false;
    }
  }

  function openFollowersModal(type: "followers" | "following") {
    followersModalType = type;
    followersModalOpen = true;
    if (type === "followers") loadFollowerUsers();
    else loadFollowingUsers();
  }

  function handleUserCardClick(user: UserProfile) {
    hapticService?.trigger("selection");
    browseNavigationState.viewCreatorProfile(user.id, user.displayName);
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

    <div class="profile-content">
      <ProfileHeroSection
        {userProfile}
        {currentUserId}
        {isOwnProfile}
        {followInProgress}
        onFollowToggle={handleFollowToggle}
        onFollowersClick={() => openFollowersModal("followers")}
        onFollowingClick={() => openFollowersModal("following")}
      />

      <ProfileShowcase
        pinnedItems={userProfile.pinnedItems ?? []}
        {isOwnProfile}
      />

      <ProfileTabs
        {userSequences}
        onSequenceClick={handleSequenceClick}
      />

      {#if currentUserId && !isOwnProfile}
        <ProfileConnectionSection
          targetUserId={userId}
          targetUserName={userProfile.displayName}
        />
      {/if}

      {#if isAdmin && !isOwnProfile}
        <ProfileAdminSection
          {userProfile}
          onUserUpdated={handleAdminUpdate}
          {onUserDeleted}
        />
      {/if}
    </div>

    <FollowersModal
      bind:open={followersModalOpen}
      listType={followersModalType}
      users={modalUsers}
      isLoading={modalLoading}
      onUserClick={handleUserCardClick}
    />
  {/if}
</div>

<style>
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

    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(16px, 4cqi, 32px);
  }

  .profile-content > :global(*) {
    width: 100%;
    flex-shrink: 0;
  }

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

  @container profile-panel (min-width: 1400px) {
    .profile-content {
      padding: clamp(32px, 5cqi, 48px);
    }
  }
</style>
