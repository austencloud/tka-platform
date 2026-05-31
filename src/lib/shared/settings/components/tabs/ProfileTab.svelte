<!-- ProfileTab.svelte - User Profile & Account Settings (Refactored) -->
<script lang="ts">
  import { getUserDocumentManager } from "$lib/shared/auth/get-user-document-manager";
  import { generateAndUploadAvatar } from "$lib/shared/auth/services/profile-picture-manager";
  import { getAccountManager } from "$lib/shared/auth/get-account-manager";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { signInWithFacebook } from "$lib/shared/auth/services/authenticator";
  import { authState } from "../../../auth/state/auth-state.svelte";
  import {
    userPreviewState,
    loadPreviewSection,
    isSectionLoaded,
  } from "../../../debug/state/user-preview-state.svelte";
  import type { AccountManager } from '$lib/shared/auth/services/account-manager'
  import { onMount } from "svelte";
  import {
    createProfileSettingsState,
    setProfileSettingsContext,
  } from "../../../navigation/state/profile-settings-context.svelte";
  import ConnectedAccounts from "../../../navigation/components/profile-settings/ConnectedAccounts.svelte";
  import ConnectedAccountsPreview from "../../../navigation/components/profile-settings/ConnectedAccountsPreview.svelte";
  import AccountSettingsSection from "../../../navigation/components/profile-settings/AccountSettingsSection.svelte";
  import DangerZone from "../../../navigation/components/profile-settings/DangerZone.svelte";
  import SubscriptionCard from "./profile/SubscriptionCard.svelte";
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import GlassCard from "./profile/GlassCard.svelte";
  import ProfileHeroSection from "./profile/ProfileHeroSection.svelte";
  import StorageSection from "./profile/StorageSection.svelte";
  import AuthPrompt from "./profile/AuthPrompt.svelte";
  import ProfilePhotoPicker from "../ProfilePhotoPicker.svelte";
  import type { PhotoSelection } from "../../domain/photo-picker-types";
  import { updateProfile } from "firebase/auth";
  import { doc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "../../../auth/firebase";
  import { refreshUser } from "../../../auth/state/auth-state.svelte";

  import type { PreviewUserProfile } from "../../../debug/state/user-preview-state.svelte";
  import type { User } from "firebase/auth";

  // Create and provide profile settings context for child components
  const profileState = createProfileSettingsState();
  setProfileSettingsContext(profileState);

  // Check if we're in preview mode
  const isPreviewMode = $derived(
    userPreviewState.isActive && userPreviewState.data.profile !== null
  );

  // Create a User-like object from preview profile for ProfileHeroSection
  function createPreviewUser(profile: PreviewUserProfile): User {
    return {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      // Minimal User interface requirements (unused but required)
      emailVerified: false,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: "",
      tenantId: null,
      phoneNumber: null,
      providerId: "firebase",
      delete: async () => {},
      getIdToken: async () => "",
      getIdTokenResult: async () => ({}) as any,
      reload: async () => {},
      toJSON: () => ({}),
    } as User;
  }

  interface Props {
    currentSettings?: unknown;
    onSettingUpdate?: (event: { key: string; value: unknown }) => void;
  }

  let {
    currentSettings: _currentSettings,
    onSettingUpdate: _onSettingUpdate,
  }: Props = $props();

  // Services
  let hapticService = $state<HapticFeedback | null>(null);
  let accountManager = $state<AccountManager | null>(null);

  // Cache clearing state
  let clearingCache = $state(false);

  // Pronouns loaded from Firestore
  let userPronouns = $state("");

  // Profile accent color loaded from Firestore
  let profileColor = $state("#8b5cf6");

  // Google photo URL persisted in Firestore (survives avatar switches)
  let savedGooglePhotoUrl = $state<string | null>(null);

  // Photo picker state - survives refresh/HMR via sessionStorage
  const PHOTO_PICKER_KEY = "tka_photo_picker_open";
  let showPhotoPicker = $state(
    typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(PHOTO_PICKER_KEY) === "1"
  );

  // Entry animation
  let isVisible = $state(false);

  // Preview mode: auth data state
  const previewAuthData = $derived(userPreviewState.data.authData);
  const isLoadingAuthData = $derived(
    userPreviewState.loadingSection === "authData"
  );
  const authDataLoaded = $derived(isSectionLoaded("authData"));

  // Load auth data when entering preview mode and viewing profile tab
  $effect(() => {
    if (isPreviewMode && !authDataLoaded && !isLoadingAuthData) {
      loadPreviewSection("authData");
    }
  });

  onMount(async () => {
    hapticService = getHapticFeedback();
    accountManager = getAccountManager();

    setTimeout(() => (isVisible = true), 30);

    // Load pronouns from Firestore
    const user = authState.user;
    if (user) {
      try {
        const firestore = await getFirestoreInstance();
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          userPronouns = data?.pronouns || "";
          if (data?.profileColor) {
            profileColor = data.profileColor;
          }
          if (data?.googlePhotoURL) {
            savedGooglePhotoUrl = data.googlePhotoURL;
          }
        }
      } catch (err) {
        console.error("Failed to load pronouns:", err);
      }
    }
  });

  async function handleSignOut() {
    hapticService?.trigger("selection");
    try {
      await authState.signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  async function handleFacebookAuth() {
    hapticService?.trigger("selection");
    try {
      await signInWithFacebook();
    } catch (error: any) {
      console.error("❌ Facebook auth failed:", error);
      hapticService?.trigger("error");
    }
  }

  async function handleChangePassword() {
    if (!accountManager || profileState.ui.saving) return;

    profileState.ui.saving = true;

    try {
      await accountManager.changePassword(
        profileState.password.current,
        profileState.password.new
      );
      // Success handling is done by the form component (inline success state)
    } catch (error) {
      // Re-throw so the form component can show inline error
      throw error;
    } finally {
      profileState.ui.saving = false;
    }
  }

  async function handleDeleteAccount(password: string) {
    if (!accountManager) return;

    await accountManager.deleteAccount(password);
  }

  async function handleClearCache() {
    if (!accountManager) return;

    if (
      !confirm(
        "Clear all cached data?\n\n" +
          "This will remove locally stored data and reload the page. " +
          "Your account and saved sequences are not affected."
      )
    ) {
      return;
    }

    clearingCache = true;

    try {
      await accountManager.clearCache();
    } catch (error) {
      clearingCache = false;
    }
  }

  function handleOpenPhotoPicker() {
    hapticService?.trigger("selection");
    showPhotoPicker = true;
    sessionStorage.setItem(PHOTO_PICKER_KEY, "1");
  }

  async function handleColorChange(color: string) {
    // Optimistic update so the ring color changes instantly
    profileColor = color;

    const user = authState.user;
    if (!user) return;

    try {
      const userDocumentManager = getUserDocumentManager();
      await userDocumentManager.updateProfileColor(user.uid, color);
    } catch (err) {
      console.error("Failed to save profile color:", err);
    }
  }

  /**
   * Upload a profile photo file to Firebase Storage
   */
  async function uploadProfilePhoto(user: User, file: File): Promise<string> {
    const { getStorageInstance } = await import("$lib/shared/auth/firebase");
    const { ref, uploadBytes, getDownloadURL } = await import(
      "firebase/storage"
    );
    const storage = await getStorageInstance();

    // Generate unique filename with timestamp
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `avatars/${user.uid}/${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
      customMetadata: {
        userId: user.uid,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    return await getDownloadURL(storageRef);
  }

  async function handlePhotoSelected(selection: PhotoSelection) {
    const user = authState.user;
    if (!user) return;

    hapticService?.trigger("selection");

    const userDocumentManager = getUserDocumentManager();

    try {
      let newPhotoURL: string | null = null;

      switch (selection.type) {
        case "upload":
          if (selection.file) {
            // Upload file to Firebase Storage
            newPhotoURL = await uploadProfilePhoto(user, selection.file);
            await updateProfile(user, { photoURL: newPhotoURL });
          }
          break;

        case "google":
        case "facebook":
          if (selection.url) {
            newPhotoURL = selection.url;
            await updateProfile(user, { photoURL: newPhotoURL });
          }
          break;

        case "generated":
          if (selection.generatedData) {
            newPhotoURL = await generateAndUploadAvatar(
              user,
              selection.generatedData
            );
          }
          break;
      }

      // If we got a new photo URL, sync to Firestore and refresh UI
      if (newPhotoURL) {
        // Update Firestore user document so admin views reflect change instantly
        await userDocumentManager.updatePhotoURL(user.uid, newPhotoURL);
        await refreshUser(); // Triggers Svelte reactivity
        hapticService?.trigger("success");
      }
    } catch (error) {
      console.error("Failed to update profile photo:", error);
      hapticService?.trigger("error");
    }
  }
</script>

<div class="profile-tab themed-scrollbar" class:visible={isVisible}>
  {#if isPreviewMode && userPreviewState.data.profile}
    <!-- Preview Mode: Show exact same layout with preview user's data -->
    <div class="profile-content">
      <!-- Preview banner -->
      <div class="preview-banner">
        <i class="fas fa-eye"></i>
        <span
          >Viewing as <strong
            >{userPreviewState.data.profile.displayName ||
              userPreviewState.data.profile.email ||
              "User"}</strong
          ></span
        >
      </div>

      <!-- Profile Hero - same layout, preview user data, no sign out -->
      <ProfileHeroSection
        user={createPreviewUser(userPreviewState.data.profile)}
        onSignOut={() => {}}
        disabled={true}
      />

      <!-- Settings Grid - same layout as normal view -->
      <div class="settings-grid">
        <!-- Connected Accounts - now uses admin endpoint to fetch real data -->
        <GlassCard
          icon="fas fa-link"
          title="Connected Accounts"
          subtitle="View linked providers"
        >
          {#snippet children()}
            <ConnectedAccountsPreview
              providers={previewAuthData?.providers ?? []}
              emailVerified={previewAuthData?.emailVerified ?? false}
              loading={isLoadingAuthData}
            />
          {/snippet}
        </GlassCard>

        <!-- Subscription - Admin only (premium not ready yet) -->
        {#if userPreviewState.data.profile?.role === "admin"}
          <GlassCard
            icon="fas fa-crown"
            iconClass="premium-icon"
            title="Subscription"
            subtitle="Support TKA development"
          >
            {#snippet children()}
              <SubscriptionCard {hapticService} />
            {/snippet}
          </GlassCard>
        {/if}

        <!-- Password - show if user has password provider -->
        {#if previewAuthData?.providers.some((p) => p.providerId === "password")}
          <GlassCard
            icon="fas fa-key"
            title="Password"
            subtitle="Password authentication enabled"
          >
            {#snippet children()}
              <div class="password-preview">
                <div class="password-status">
                  <i class="fas fa-check-circle"></i>
                  <span>Password sign-in enabled</span>
                </div>
                {#if !previewAuthData?.emailVerified}
                  <div class="email-unverified-note">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Email not yet verified</span>
                  </div>
                {/if}
              </div>
            {/snippet}
          </GlassCard>
        {/if}

        <!-- Storage Section -->
        <StorageSection
          onClearCache={handleClearCache}
          isClearing={clearingCache}
        />
      </div>
      <!-- Danger Zone not shown in preview mode - can't delete another user's account -->
    </div>
  {:else if authState.isAuthenticated && authState.user}
    <!-- Signed In State -->
    <div class="profile-content">
      <!-- Profile Hero -->
      <ProfileHeroSection
        user={authState.user}
        onSignOut={handleSignOut}
        onAvatarClick={handleOpenPhotoPicker}
        pronouns={userPronouns}
        {profileColor}
      />

      <!-- Settings Grid - Flexbox for natural fill behavior -->
      <div class="settings-grid">
        <!-- Row 1: Smaller cards -->
        <!-- Subscription - Admin only (premium not ready yet) -->
        {#if authState.isAdmin}
          <GlassCard
            icon="fas fa-crown"
            iconClass="premium-icon"
            title="Subscription"
            subtitle="Support TKA development"
          >
            {#snippet children()}
              <SubscriptionCard {hapticService} />
            {/snippet}
          </GlassCard>
        {/if}

        <!-- Account Settings - Display name + password (if available) -->
        <GlassCard
          icon="fas fa-user-cog"
          title="Account Settings"
          subtitle="Manage your profile"
        >
          {#snippet children()}
            <AccountSettingsSection
              user={authState.user!}
              hasPasswordProvider={profileState.hasPasswordProvider(authState.user)}
              onChangePassword={handleChangePassword}
              {hapticService}
              onPronounsChanged={(p) => (userPronouns = p)}
            />
          {/snippet}
        </GlassCard>

        <!-- Storage Section -->
        <StorageSection
          onClearCache={handleClearCache}
          isClearing={clearingCache}
        />

        <!-- Connected Accounts -->
        <GlassCard
          icon="fas fa-link"
          title="Connected Accounts"
          subtitle="Manage linked providers"
        >
          {#snippet children()}
            <ConnectedAccounts />
          {/snippet}
        </GlassCard>
      </div>

      <!-- Danger Zone - Full width, separated from grid -->
      <GlassCard
        class="danger-card"
        icon="fas fa-skull"
        iconClass="danger-icon"
        title="Danger Zone"
        subtitle="Irreversible account actions"
      >
        {#snippet children()}
          <DangerZone
            onDeleteAccount={handleDeleteAccount}
            {hapticService}
            userIdentifier={authState.user?.displayName ||
              authState.user?.email ||
              ""}
          />
        {/snippet}
      </GlassCard>
    </div>
  {:else}
    <!-- Signed Out State -->
    <AuthPrompt onFacebookAuth={handleFacebookAuth} />
  {/if}
</div>

<!-- Profile Photo Picker Drawer -->
<ProfilePhotoPicker
  bind:isOpen={showPhotoPicker}
  onClose={() => {
    showPhotoPicker = false;
    sessionStorage.removeItem(PHOTO_PICKER_KEY);
  }}
  onPhotoSelected={handlePhotoSelected}
  {profileColor}
  onColorChange={handleColorChange}
  {savedGooglePhotoUrl}
/>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     PROFILE TAB - Lightweight layout container
     All component-specific styles live in child components
     ═══════════════════════════════════════════════════════════════════════════ */
  .profile-tab {
    container-type: inline-size;
    container-name: profile-tab;

    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: clamp(12px, 3cqi, 24px);
    gap: clamp(12px, 2cqi, 20px);
    overflow-y: auto;
    overflow-x: hidden;

    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .profile-tab.visible {
    opacity: 1;
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 20px);
    max-width: 100%;
  }

  /* ========================================
     SETTINGS GRID - Flexbox with natural heights
     Cards keep their natural height, partial rows expand width
     ======================================== */
  .settings-grid {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(10px, 2cqi, 16px);
    align-items: stretch; /* Cards match row height */
  }

  /* Each card: min 320px, grows to fill width */
  .settings-grid > :global(*) {
    flex: 1 1 320px;
    min-width: 0;
  }

  /* Single column on narrow screens */
  @container profile-tab (max-width: 500px) {
    .settings-grid > :global(*) {
      flex-basis: 100%;
    }
  }

  /* Tighter spacing on very small screens */
  @container profile-tab (max-width: 360px) {
    .settings-grid {
      gap: 8px;
    }
  }

  /* ========================================
     DANGER CARD & PREMIUM ICON - Special styles
     ======================================== */
  :global(.danger-card) {
    background: var(
      --theme-danger-bg,
      linear-gradient(
        135deg,
        rgba(70, 15, 20, 0.9) 0%,
        rgba(85, 20, 25, 0.85) 100%
      )
    );
    border: 1px solid var(--theme-danger-border);
    box-shadow: var(
      --theme-danger-shadow,
      inset 0 1px 0 rgba(239, 68, 68, 0.15),
      0 4px 20px var(--theme-shadow)
    );
  }

  :global(.danger-card:hover) {
    background: var(
      --theme-danger-hover-bg,
      linear-gradient(
        135deg,
        rgba(85, 18, 25, 0.92) 0%,
        rgba(100, 25, 30, 0.88) 100%
      )
    );
    border-color: var(--theme-danger-hover-border);
    box-shadow: var(
      --theme-danger-hover-shadow,
      inset 0 1px 0 rgba(239, 68, 68, 0.2),
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(239, 68, 68, 0.15)
    );
  }

  :global(.danger-card .card-icon) {
    background: rgba(239, 68, 68, 0.2);
    color: var(--semantic-error);
  }

  :global(.danger-card .card-title) {
    color: #fecaca;
  }

  :global(.premium-icon) {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.2),
      rgba(251, 191, 36, 0.15)
    );
    color: var(--semantic-warning);
  }

  /* ========================================
     PREVIEW MODE STYLES
     ======================================== */
  .preview-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 10px;
    color: #c4b5fd;
    font-size: var(--font-size-sm, 14px);
  }

  .preview-banner i {
    font-size: 14px;
  }

  .preview-banner strong {
    color: #ddd6fe;
  }

  /* Password Preview in preview mode */
  .password-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .password-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    font-size: var(--font-size-sm);
    color: var(--theme-text);
  }

  .password-status i {
    font-size: var(--font-size-base);
    color: #4ade80;
  }

  .email-unverified-note {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
    font-size: var(--font-size-compact);
    color: var(--semantic-warning);
  }

  .email-unverified-note i {
    font-size: var(--font-size-sm);
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .profile-tab {
      transition: none;
    }
  }
</style>
