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
  import { openCreatorProfile, backToCreatorsList } from "../state/creators-routing.svelte";
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

  // Right rail appears when viewing someone else while logged in (connection)
  // or as an admin. The desktop build grants isAdmin with user: null
  // (auth-state desktop fallback), so isAdmin must be its own gate — it is NOT
  // implied by currentUserId. Own profile / logged-out non-admin → gallery
  // goes full width, no rail.
  const showAside = $derived((!!currentUserId || isAdmin) && !isOwnProfile);

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
    // Return to the creators list. The browser Back button walks the full pushed
    // history (including profile -> profile) via the panel's popstate handler;
    // this in-page button always lands safely on the list.
    backToCreatorsList();
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
      returnPath: `/social/creators/${userId}`,
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
    void openCreatorProfile(user.id, user.displayName);
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
      <div class="profile-layout" class:has-aside={showAside}>
        <div class="hero-area">
          <ProfileHeroSection
            {userProfile}
            {currentUserId}
            {isOwnProfile}
            {followInProgress}
            onFollowToggle={handleFollowToggle}
            onFollowersClick={() => openFollowersModal("followers")}
            onFollowingClick={() => openFollowersModal("following")}
          />
        </div>

        <div class="profile-main">
          <ProfileShowcase
            pinnedItems={userProfile.pinnedItems ?? []}
            {isOwnProfile}
          />

          <ProfileTabs
            {userSequences}
            onSequenceClick={handleSequenceClick}
          />
        </div>

        {#if showAside}
          <aside class="profile-aside">
            {#if currentUserId && !isOwnProfile}
              <ProfileConnectionSection
                targetUserId={userId}
                targetUserName={userProfile.displayName}
                isFollowing={userProfile.isFollowing}
              />
            {/if}

            {#if isAdmin && !isOwnProfile}
              <ProfileAdminSection
                {userProfile}
                onUserUpdated={handleAdminUpdate}
                {onUserDeleted}
              />
            {/if}
          </aside>
        {/if}
      </div>
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

  /* 4K-first layout: full-width hero banner, gallery main that fills the
     width, and a sticky right rail for viewer-only sections. Collapses to a
     single stacked column on narrow panels. */
  .profile-layout {
    width: 100%;
    max-width: 1920px;
    margin-inline: auto;
    display: grid;
    gap: 24px;
    grid-template-columns: 1fr;
    grid-template-areas:
      "hero"
      "main";
    align-items: start;
  }

  .profile-layout.has-aside {
    grid-template-columns: minmax(0, 1fr) clamp(320px, 22cqi, 400px);
    grid-template-areas:
      "hero hero"
      "main aside";
  }

  .hero-area {
    grid-area: hero;
  }

  .profile-main {
    grid-area: main;
    min-width: 0;
    /* Sit above the sticky rail so the gallery's sort popover can overlap the
       rail region instead of being covered by it (both are backdrop-filter
       panels = separate stacking contexts). */
    z-index: 2;
  }

  .profile-aside {
    grid-area: aside;
    position: sticky;
    top: 0;
    align-self: start;
    display: flex;
    flex-direction: column;
    z-index: 1;
  }

  /* Three frosted glass panels (banner / main / rail) so all content reads
     against calm surfaces; the ocean breathes in the grid gaps + page
     margins. Reuses the app modal-surface token (--theme-panel-bg). */
  .hero-area,
  .profile-main,
  .profile-aside {
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 20, 30, 0.98)) 90%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(16px, 2cqi, 24px);
    padding: clamp(16px, 2cqi, 28px);
    box-shadow: var(--theme-shadow, 0 8px 32px rgba(0, 0, 0, 0.3));
  }

  /* Hero fills its banner panel edge-to-edge (drop its own max-width/margins). */
  .hero-area :global(.hero-section) {
    max-width: none;
    margin: 0;
    padding: 0;
    border-radius: 0;
  }

  .profile-aside > :global(:first-child) {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  @container profile-panel (max-width: 1100px) {
    .profile-layout.has-aside {
      grid-template-columns: 1fr;
      grid-template-areas:
        "hero"
        "main"
        "aside";
    }

    .profile-aside {
      position: static;
    }
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
