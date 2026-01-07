<script lang="ts">
  /**
   * UserProfileWidget
   * Shows user profile summary with quick access to library and auth
   * Supports preview mode for admin user viewing
   */

  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { libraryState } from "$lib/features/library/state/library-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IAuthenticator } from "$lib/shared/auth/services/contracts/IAuthenticator";
  import { useUserPreview } from "$lib/shared/debug/context/user-preview-context";

  let hapticService: IHapticFeedback | null = $state(null);
  let authService: IAuthenticator | null = $state(null);
  let showAuthOptions = $state(false);

  // Get preview context
  const preview = useUserPreview();

  const isAuthenticated = $derived(authState.isAuthenticated);
  const user = $derived(authState.user);

  // Effective values (use preview data when active)
  const effectiveDisplayName = $derived(
    preview.getEffectiveDisplayName(user?.displayName ?? null)
  );
  const effectiveEmail = $derived(
    preview.getEffectiveEmail(user?.email ?? null)
  );
  const effectivePhotoURL = $derived(
    preview.getEffectivePhotoURL(user?.photoURL ?? null)
  );

  // Stats - use preview data when active
  const sequenceCount = $derived(
    preview.isActive ? preview.sequences.length : libraryState.sequences.length
  );
  const favoriteCount = $derived(
    preview.isActive
      ? 0 // Preview doesn't track favorites yet
      : libraryState.sequences.filter((s) => s.isFavorite).length
  );

  onMount(async () => {
    try {
      hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
      authService = await resolve<IAuthenticator>(TYPES.IAuthenticator);
    } catch {
      // Services may not be available in all contexts
    }

    // Load library data if authenticated
    if (authState.effectiveUserId) {
      libraryState.loadSequences();
    }
  });

  function navigateToLibrary() {
    hapticService?.trigger("selection");
    // Library is now a tab within Discover module
    handleModuleChange("discover", "gallery");
  }

  async function handleSignOut() {
    hapticService?.trigger("selection");
    try {
      await authState.signOut();
      showAuthOptions = false;
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  async function handleGoogleSignIn() {
    hapticService?.trigger("selection");
    try {
      await authService?.signInWithGoogle();
      showAuthOptions = false;
    } catch (error) {
      console.error("Google sign-in failed:", error);
    }
  }

  async function handleFacebookSignIn() {
    hapticService?.trigger("selection");
    try {
      await authService?.signInWithFacebook();
      showAuthOptions = false;
    } catch (error) {
      console.error("Facebook sign-in failed:", error);
    }
  }

  function toggleAuthOptions() {
    hapticService?.trigger("selection");
    showAuthOptions = !showAuthOptions;
  }
</script>

<div class="profile-widget" class:preview-mode={preview.isActive}>
  {#if preview.isActive}
    <div class="preview-badge">
      <i class="fas fa-eye" aria-hidden="true"></i>
      Viewing as {effectiveDisplayName || effectiveEmail || "User"}
    </div>
  {/if}

  {#if isAuthenticated && user}
    <!-- Signed In State -->
    <div class="user-profile">
      <button class="profile-header" onclick={toggleAuthOptions}>
        <div class="profile-avatar">
          {#if effectivePhotoURL}
            <img
              src={effectivePhotoURL}
              alt={effectiveDisplayName || "User"}
              class="avatar-image"
              crossorigin="anonymous"
              referrerpolicy="no-referrer"
            />
          {:else}
            <div class="avatar-placeholder">
              {(effectiveDisplayName || effectiveEmail || "?")
                .charAt(0)
                .toUpperCase()}
            </div>
          {/if}
        </div>
        <div class="profile-info">
          {#if effectiveDisplayName}
            <span class="profile-name">{effectiveDisplayName}</span>
          {/if}
          <span class="profile-email">{effectiveEmail || "Signed In"}</span>
        </div>
        {#if !preview.isActive}
          <i
            class="fas fa-chevron-down dropdown-icon"
            aria-hidden="true"
            class:open={showAuthOptions}
          ></i>
        {/if}
      </button>

      {#if showAuthOptions}
        <div class="auth-dropdown">
          <button class="dropdown-item sign-out" onclick={handleSignOut}>
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            Sign Out
          </button>
        </div>
      {/if}

      <!-- Quick Stats -->
      <div class="quick-stats">
        <button class="stat-item" onclick={navigateToLibrary}>
          <div class="stat-icon">
            <i class="fas fa-layer-group" aria-hidden="true"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{sequenceCount}</span>
            <span class="stat-label">Sequences</span>
          </div>
        </button>
        <button class="stat-item" onclick={navigateToLibrary}>
          <div class="stat-icon favorites">
            <i class="fas fa-star" aria-hidden="true"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{favoriteCount}</span>
            <span class="stat-label">Favorites</span>
          </div>
        </button>
      </div>

      <!-- Library Access Button -->
      <button class="library-btn" onclick={navigateToLibrary}>
        <i class="fas fa-book" aria-hidden="true"></i>
        Open Library
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  {:else}
    <!-- Signed Out State -->
    <div class="sign-in-prompt">
      <div class="prompt-header">
        <div class="prompt-icon">
          <i class="fas fa-user-circle" aria-hidden="true"></i>
        </div>
        <div class="prompt-text">
          <h3>Sign In</h3>
          <p>Save sequences & sync across devices</p>
        </div>
      </div>

      <div class="auth-buttons">
        <button class="auth-btn google" onclick={handleGoogleSignIn}>
          <svg viewBox="0 0 24 24" class="google-icon">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </button>
        <button class="auth-btn facebook" onclick={handleFacebookSignIn}>
          <i class="fab fa-facebook-f" aria-hidden="true"></i>
          Facebook
        </button>
      </div>

      <p class="guest-note">
        <i class="fas fa-info-circle" aria-hidden="true"></i>
        Continue as guest - data saved locally
      </p>
    </div>
  {/if}
</div>

<style>
  /* 2026 Refined Minimalism - UserProfileWidget */
  .profile-widget {
    display: flex;
    flex-direction: column;
    padding: var(--space-2026-md, 20px);
    background: var(--surface-2026, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border-2026, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-2026-lg, 18px);
    height: 100%;
  }

  /* Preview Mode Styling */
  .profile-widget.preview-mode {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.05);
  }

  .preview-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: var(--space-2026-sm, 12px);
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: var(--radius-2026-sm, 10px);
    font-size: var(--text-2026-micro, 0.75rem);
    font-weight: 600;
    color: var(--semantic-info);
  }

  .preview-badge i {
    font-size: var(--font-size-compact);
  }

  /* User Profile (Signed In) */
  .user-profile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2026-md, 16px);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: var(--space-2026-sm, 12px);
    padding: 8px;
    margin: -8px;
    background: transparent;
    border: none;
    border-radius: var(--radius-2026-sm, 10px);
    cursor: pointer;
    transition: background var(--duration-2026-fast, 150ms)
      var(--ease-2026, ease);
    text-align: left;
    width: calc(100% + 16px);
  }

  .profile-header:hover {
    background: var(--surface-2026-hover, rgba(255, 255, 255, 0.05));
  }

  .profile-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 20%,
        transparent
      );
    flex-shrink: 0;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base);
    font-weight: 700;
    background: var(--theme-accent, var(--theme-accent));
    color: white;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .profile-name {
    font-size: var(--text-2026-body, 1rem);
    font-weight: 600;
    color: var(--theme-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-email {
    font-size: var(--text-2026-micro, 0.75rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-icon {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    transition: transform var(--duration-2026-fast, 150ms)
      var(--ease-2026, ease);
  }

  .dropdown-icon.open {
    transform: rotate(180deg);
  }

  /* Auth Dropdown */
  .auth-dropdown {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm, 10px);
    margin-top: -8px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-2026-xs, 8px);
    color: var(--theme-text);
    font-size: var(--text-2026-caption, 0.875rem);
    cursor: pointer;
    transition: background var(--duration-2026-fast, 150ms)
      var(--ease-2026, ease);
    width: 100%;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--surface-2026-hover, rgba(255, 255, 255, 0.06));
  }

  .dropdown-item.sign-out {
    color: var(--semantic-error, var(--semantic-error));
  }

  .dropdown-item.sign-out:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 12%,
      transparent
    );
  }

  /* Quick Stats - Inline text style for 2026 */
  .quick-stats {
    display: flex;
    gap: var(--space-2026-sm, 10px);
  }

  .stat-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2026-sm, 10px);
    padding: var(--space-2026-sm, 12px);
    background: var(--surface-2026, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--border-2026, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-2026-sm, 10px);
    cursor: pointer;
    transition: all var(--duration-2026-fast, 150ms) var(--ease-2026, ease);
    text-align: left;
  }

  .stat-item:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 15%,
      transparent
    );
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-2026-xs, 8px);
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 12%,
      transparent
    );
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-compact);
    flex-shrink: 0;
  }

  .stat-icon.favorites {
    background: var(--accent-2026-amber-soft, rgba(245, 158, 11, 0.12));
    color: var(--accent-2026-amber, var(--semantic-warning));
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: var(--text-2026-title, 1.125rem);
    font-weight: 700;
    color: var(--theme-text);
    line-height: 1.2;
  }

  .stat-label {
    font-size: var(--text-2026-micro, 0.75rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Library Button - 2026 text link style */
  .library-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--space-2026-sm, 12px) var(--space-2026-md, 16px);
    background: var(--accent-2026-emerald-soft, rgba(16, 185, 129, 0.12));
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--accent-2026-emerald, var(--semantic-success));
    font-size: var(--text-2026-caption, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-2026-fast, 150ms) var(--ease-2026, ease);
  }

  .library-btn:hover {
    background: rgba(16, 185, 129, 0.18);
    border-color: rgba(16, 185, 129, 0.3);
    /* No transform lift - cleaner 2026 aesthetic */
  }

  .library-btn i:last-child {
    font-size: var(--font-size-compact);
    margin-left: auto;
    transition: transform var(--duration-2026-fast, 150ms)
      var(--ease-2026, ease);
  }

  .library-btn:hover i:last-child {
    transform: translateX(2px);
  }

  /* Sign In Prompt (Signed Out) - 2026 Refined */
  .sign-in-prompt {
    display: flex;
    flex-direction: column;
    gap: var(--space-2026-md, 16px);
  }

  .prompt-header {
    display: flex;
    align-items: center;
    gap: var(--space-2026-sm, 12px);
  }

  .prompt-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 12%,
      transparent
    );
    border-radius: var(--radius-2026-sm, 10px);
    color: var(--theme-accent, var(--theme-accent));
    font-size: var(--font-size-xl);
    flex-shrink: 0;
  }

  .prompt-text h3 {
    margin: 0;
    font-size: var(--text-2026-body, 1rem);
    font-weight: 600;
    color: var(--theme-text);
  }

  .prompt-text p {
    margin: 2px 0 0;
    font-size: var(--text-2026-micro, 0.75rem);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Auth Buttons - 2026 Cleaner */
  .auth-buttons {
    display: flex;
    gap: var(--space-2026-sm, 10px);
  }

  .auth-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--space-2026-sm, 12px);
    border-radius: var(--radius-2026-sm, 10px);
    font-size: var(--text-2026-caption, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-2026-fast, 150ms) var(--ease-2026, ease);
    border: none;
  }

  .auth-btn.google {
    background: rgba(255, 255, 255, 0.95);
    color: #333;
  }

  .auth-btn.google:hover {
    background: white;
    box-shadow: var(--shadow-2026-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
    /* No transform lift */
  }

  .google-icon {
    width: 16px;
    height: 16px;
  }

  .auth-btn.facebook {
    background: #1877f2;
    color: white;
  }

  .auth-btn.facebook:hover {
    background: #166fe5;
    box-shadow: var(--shadow-2026-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
    /* No transform lift */
  }

  .guest-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--text-2026-micro, 0.75rem);
    color: var(--theme-text-dim);
  }

  .guest-note i {
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 60%,
      transparent
    );
  }

  /* Responsive - 2026 */
  @media (max-width: 480px) {
    .profile-widget {
      padding: var(--space-2026-sm, 14px);
      border-radius: var(--radius-2026-md, 14px);
    }

    .profile-avatar {
      width: 40px;
      height: 40px;
    }

    .profile-name {
      font-size: var(--text-2026-caption, 0.875rem);
    }

    .stat-item {
      padding: 10px;
    }

    .stat-icon {
      width: 28px;
      height: 28px;
      font-size: var(--font-size-compact);
    }

    .stat-value {
      font-size: var(--text-2026-body, 1rem);
    }

    .library-btn {
      padding: 10px 14px;
      font-size: var(--text-2026-caption, 0.875rem);
    }

    .auth-buttons {
      flex-direction: column;
      gap: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .profile-header,
    .stat-item,
    .library-btn,
    .auth-btn,
    .dropdown-icon,
    .library-btn i:last-child {
      transition: none;
    }

    .library-btn:hover i:last-child {
      transform: none;
    }
  }
</style>
