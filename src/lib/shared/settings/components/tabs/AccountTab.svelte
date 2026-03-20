<!-- AccountTab.svelte - Account Security & Management Settings -->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import {
    userPreviewState,
    loadPreviewSection,
    isSectionLoaded,
  } from "../../../debug/state/user-preview-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IAuthenticator } from "../../../auth/services/contracts/IAuthenticator";
  import type { IAccountManager } from "../../../auth/services/contracts/IAccountManager";
  import type { IStepUpAuthCoordinator } from "../../../auth/services/contracts/IStepUpAuthCoordinator";
  import { onMount } from "svelte";
  import {
    createProfileSettingsState,
    setProfileSettingsContext,
  } from "../../../navigation/state/profile-settings-context.svelte";
  import ConnectedAccounts from "../../../navigation/components/profile-settings/ConnectedAccounts.svelte";
  import ConnectedAccountsPreview from "../../../navigation/components/profile-settings/ConnectedAccountsPreview.svelte";
  import AccountSettingsSection from "../../../navigation/components/profile-settings/AccountSettingsSection.svelte";
  import DangerZone from "../../../navigation/components/profile-settings/DangerZone.svelte";
  import AccountSecuritySection from "../../../auth/components/AccountSecuritySection.svelte";
  import SecurityPreview from "../../../auth/components/SecurityPreview.svelte";
  import SubscriptionCard from "./profile/SubscriptionCard.svelte";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import PasskeyStepUpModal from "../../../auth/components/PasskeyStepUpModal.svelte";
  import GlassCard from "./profile/GlassCard.svelte";
  import StorageSection from "./profile/StorageSection.svelte";
  import AuthPrompt from "./profile/AuthPrompt.svelte";

  // Create and provide profile settings context for child components
  const profileState = createProfileSettingsState();
  setProfileSettingsContext(profileState);

  // Check if we're in preview mode
  const isPreviewMode = $derived(
    userPreviewState.isActive && userPreviewState.data.profile !== null
  );

  interface Props {
    currentSettings?: unknown;
    onSettingUpdate?: (event: { key: string; value: unknown }) => void;
  }

  let {
    currentSettings: _currentSettings,
    onSettingUpdate: _onSettingUpdate,
  }: Props = $props();

  // Services
  let hapticService = $state<IHapticFeedback | null>(null);
  let authService = $state<IAuthenticator | null>(null);
  let accountManager = $state<IAccountManager | null>(null);
  let stepUpCoordinator = $state<IStepUpAuthCoordinator | null>(null);

  // Cache clearing state
  let clearingCache = $state(false);

  // Entry animation
  let isVisible = $state(false);

  // Preview mode: auth data state
  const previewAuthData = $derived(userPreviewState.data.authData);
  const isLoadingAuthData = $derived(
    userPreviewState.loadingSection === "authData"
  );
  const authDataLoaded = $derived(isSectionLoaded("authData"));

  // Load auth data when entering preview mode and viewing account tab
  $effect(() => {
    if (isPreviewMode && !authDataLoaded && !isLoadingAuthData) {
      loadPreviewSection("authData");
    }
  });

  onMount(async () => {
    hapticService = container.items.hapticFeedback;
    authService = container.items.authenticator;
    accountManager = container.items.accountManager;
    stepUpCoordinator = container.items.stepUpAuthCoordinator;

    setTimeout(() => (isVisible = true), 30);
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
      await authService?.signInWithFacebook();
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

  async function handleDeleteAccount() {
    if (!accountManager) return;

    // This is called after the user has typed "DELETE" to confirm
    try {
      await accountManager.deleteAccount();
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert("Failed to delete account. Please try again.");
    }
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
</script>

<div class="account-tab themed-scrollbar" class:visible={isVisible}>
  {#if isPreviewMode && userPreviewState.data.profile}
    <!-- Preview Mode: Show exact same layout with preview user's data -->
    <div class="account-content">
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

        <!-- Security - MFA factors from Firebase Auth -->
        <GlassCard
          icon="fas fa-shield-alt"
          title="Security"
          subtitle="View security settings"
        >
          {#snippet children()}
            <SecurityPreview
              mfaFactors={previewAuthData?.multiFactor?.enrolledFactors ?? null}
              loading={isLoadingAuthData}
            />
          {/snippet}
        </GlassCard>

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
    <div class="account-content">
      <!-- Sign out (moved from ProfileHeroSection) -->
      <div class="sign-out-row">
        <button class="sign-out-btn" onclick={handleSignOut}>
          <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
          <span>Sign Out</span>
        </button>
      </div>

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
              onPronounsChanged={() => {}}
            />
          {/snippet}
        </GlassCard>

        <!-- Storage Section -->
        <StorageSection
          onClearCache={handleClearCache}
          isClearing={clearingCache}
        />

        <!-- Row 2: Complex cards (expand to 50% each) -->
        <!-- Security -->
        {#if authService}
          <GlassCard
            icon="fas fa-shield-alt"
            title="Security"
            subtitle="Secure your account"
          >
            {#snippet children()}
              <AccountSecuritySection {hapticService} />
            {/snippet}
          </GlassCard>
        {/if}

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

{#if stepUpCoordinator}
  <PasskeyStepUpModal
    isOpen={stepUpCoordinator.showStepUpModal}
    allowPassword={profileState.hasPasswordProvider(authState.user)}
    onSuccess={() => stepUpCoordinator?.handleSuccess()}
    onCancel={() => stepUpCoordinator?.handleCancel()}
  />
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
     ACCOUNT TAB - Lightweight layout container
     All component-specific styles live in child components
     ═══════════════════════════════════════════════════════════════════════════ */
  .account-tab {
    container-type: inline-size;
    container-name: account-tab;

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

  .account-tab.visible {
    opacity: 1;
  }

  .account-content {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 20px);
    max-width: 100%;
  }

  /* ========================================
     SIGN OUT ROW
     ======================================== */
  .sign-out-row {
    display: flex;
    justify-content: flex-end;
  }

  .sign-out-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--duration-fast) ease,
      border-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  .sign-out-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .sign-out-btn:active {
    transform: scale(0.97);
  }

  /* ========================================
     SETTINGS GRID - Flexbox with natural heights
     Cards keep their natural height, partial rows expand width
     ======================================== */
  .settings-grid {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(10px, 2cqi, 16px);
    align-items: stretch;
  }

  /* Each card: min 320px, grows to fill width */
  .settings-grid > :global(*) {
    flex: 1 1 320px;
    min-width: 0;
  }

  /* Single column on narrow screens */
  @container account-tab (max-width: 500px) {
    .settings-grid > :global(*) {
      flex-basis: 100%;
    }
  }

  /* Tighter spacing on very small screens */
  @container account-tab (max-width: 360px) {
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
    .account-tab {
      transition: none;
    }
  }
</style>
