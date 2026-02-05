<!--
  AccountSettingsButton.svelte - Profile Button

  Shows user profile info and provides access to sign in/out:
  - When signed in: Shows profile picture + user name, opens profile popover
  - When signed out: Shows user icon + "Sign In", triggers sign-in flow
  - 48px minimum touch target (WCAG AAA)
-->
<script lang="ts">
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import { openAuthDialog } from "$lib/shared/auth/state/auth-ui-state.svelte";

  // Props
  let { isCollapsed = false } = $props<{
    isCollapsed?: boolean;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = null;

  // Popover state
  let showPopover = $state(false);
  let buttonRef = $state<HTMLButtonElement | null>(null);

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
    } catch (error) {
      console.error("Failed to resolve haptic service", error);
      hapticService = null;
    }

    // Close popover on outside click
    function handleClickOutside(event: MouseEvent) {
      if (buttonRef && !buttonRef.contains(event.target as Node)) {
        showPopover = false;
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });

  function handleClick() {
    hapticService?.trigger("selection");

    if (authState.isAuthenticated) {
      // Toggle profile popover
      showPopover = !showPopover;
    } else {
      // Open sign-in dialog
      openAuthDialog();
    }
  }

  async function handleSignOut() {
    hapticService?.trigger("selection");
    showPopover = false;
    await authState.signOut();
  }

  // Derive button label based on auth state
  const buttonLabel = $derived(
    authState.isAuthenticated
      ? authState.user?.displayName || "Profile"
      : "Sign In"
  );

  const ariaLabel = $derived(
    authState.isAuthenticated ? "Open profile menu" : "Sign in"
  );
</script>

<div class="profile-button-container">
  <button
    bind:this={buttonRef}
    class="account-settings-button"
    class:collapsed={isCollapsed}
    class:has-avatar={authState.isAuthenticated && authState.user?.photoURL}
    onclick={handleClick}
    aria-label={ariaLabel}
    aria-expanded={showPopover}
    aria-controls="account-profile-popover"
    aria-haspopup="true"
  >
    <!-- Icon/Avatar Section -->
    <div class="icon-wrapper">
      {#if authState.isAuthenticated && authState.user?.photoURL}
        <!-- Profile Picture -->
        <img
          src={authState.user.photoURL}
          alt={authState.user.displayName || "User"}
          class="profile-avatar"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
          onerror={(e) => {
            // Fallback to initial on error
            const wrapper = e.currentTarget.parentElement;
            if (wrapper) {
              e.currentTarget.remove();
              const initial = document.createElement("div");
              initial.className = "profile-initial";
              initial.textContent = (
                authState.user?.displayName ||
                authState.user?.email ||
                "?"
              )
                .charAt(0)
                .toUpperCase();
              wrapper.appendChild(initial);
            }
          }}
        />
      {:else if authState.isAuthenticated && authState.user}
        <!-- Profile Initial -->
        <div class="profile-initial">
          {(authState.user.displayName || authState.user.email || "?")
            .charAt(0)
            .toUpperCase()}
        </div>
      {:else}
        <!-- User Icon (signed out) -->
        <i class="fas fa-user-circle" aria-hidden="true"></i>
      {/if}
    </div>

    <!-- Label (hidden when collapsed) -->
    {#if !isCollapsed}
      <span class="button-label">{buttonLabel}</span>
    {/if}
  </button>

  <!-- Profile Popover (shown when signed in and clicked) -->
  {#if showPopover && authState.isAuthenticated}
    <div id="account-profile-popover" class="profile-popover">
      <div class="popover-header">
        <div class="user-info">
          <span class="user-name">{authState.user?.displayName || "User"}</span>
          <span class="user-email">{authState.user?.email}</span>
        </div>
      </div>
      <div class="popover-divider"></div>
      <button class="popover-action sign-out" onclick={handleSignOut}>
        <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
        <span>Sign Out</span>
      </button>
    </div>
  {/if}
</div>

<style>
  /* ============================================================================
     ACCOUNT SETTINGS BUTTON
     ============================================================================ */
  .account-settings-button {
    width: 100%;
    height: auto;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px; /* Balanced padding for proper hover backdrop */
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    font-size: var(--font-size-sm);
    font-weight: 500;
    /* Ensure proper box-sizing */
    box-sizing: border-box;
  }

  .account-settings-button.collapsed {
    justify-content: center;
    padding: 10px;
    width: auto; /* Let it size naturally */
  }

  .account-settings-button:hover {
    color: var(--theme-text);
    transform: translateX(2px);
  }

  .account-settings-button:active {
    transform: scale(0.98);
  }

  /* ============================================================================
     ICON WRAPPER
     ============================================================================ */
  .icon-wrapper {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    overflow: visible; /* Changed from hidden to allow badge to overflow */
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent; /* No background - let button handle it */
    border: none; /* No border on wrapper itself */
    font-size: var(--font-size-xl);
    flex-shrink: 0;
    transition: all var(--duration-normal) ease;
    position: relative; /* For badge positioning */
  }

  .account-settings-button:hover .icon-wrapper {
    transform: scale(1.05);
  }

  /* Avatar styling - add border for profile pictures */
  .account-settings-button.has-avatar .icon-wrapper {
    border: 2px solid var(--theme-stroke-strong);
    background: transparent;
  }

  .account-settings-button.has-avatar:hover .icon-wrapper {
    border-color: var(--theme-stroke-strong);
  }

  .profile-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 50%;
  }

  /* Profile initial fallback */
  .profile-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    border-radius: 50%;
  }

  /* User icon styling (when signed out) */
  .icon-wrapper > i {
    color: var(--theme-text-dim, var(--theme-text-dim));
    transition: all var(--duration-normal) ease;
  }

  .account-settings-button:hover .icon-wrapper > i {
    color: var(--theme-text);
    transform: scale(1.1);
  }

  /* ============================================================================
     LABEL
     ============================================================================ */
  .button-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  .account-settings-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .account-settings-button,
    .icon-wrapper,
    .icon-wrapper i,
    .icon-wrapper > i {
      transition: none;
    }

    .account-settings-button:hover,
    .account-settings-button:active,
    .account-settings-button:hover .icon-wrapper,
    .account-settings-button:hover .icon-wrapper > i {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .account-settings-button {
      border: 2px solid var(--theme-stroke-strong);
    }
  }
</style>
