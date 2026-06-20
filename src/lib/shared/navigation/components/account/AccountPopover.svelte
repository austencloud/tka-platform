<!-- AccountPopover: Desktop-only popover menu above AccountRow in sidebar -->
<script lang="ts">

import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { signInWithGoogle } from "$lib/shared/auth/services/authenticator";
  import { authState } from "../../../auth/state/auth-state.svelte";
  import { whatsNewState } from "../../../settings/state/whats-new-state.svelte";
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import { createPropPreferenceState } from "../../../community/state/prop-preference-state.svelte";
  import RobustAvatar from "../../../components/avatar/RobustAvatar.svelte";
  import {
    navigationState,
  } from "../../state/navigation-state.svelte";
  import {
    handleModuleChange,
  } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import type { ModuleId } from "../../domain/types";

  let { isOpen, onClose, anchorElement } = $props<{
    isOpen: boolean;
    onClose: () => void;
    anchorElement: HTMLElement | null;
  }>();

  const user = $derived(authState.user);
  const isFullAccount = $derived(authState.isFullAccount);
  const displayName = $derived(
    user?.displayName || user?.email || "Guest"
  );
  const email = $derived(user?.email ?? null);
  const photoURL = $derived(user?.photoURL ?? null);

  let popoverEl: HTMLDivElement | undefined = $state();

  // Compute fixed position from anchor element so the popover escapes
  // the sidebar's overflow: hidden
  let popoverStyle = $derived.by(() => {
    if (!anchorElement) return "";
    const rect = anchorElement.getBoundingClientRect();
    const gap = 8;
    return `left: ${rect.left}px; bottom: ${window.innerHeight - rect.top + gap}px; width: ${rect.width}px;`;
  });

  // Document-level listeners for close on Escape and click-outside
  $effect(() => {
    if (!isOpen) return;

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        popoverEl &&
        !popoverEl.contains(target) &&
        (!anchorElement || !anchorElement.contains(target))
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  });

  // Focus first button when popover opens
  $effect(() => {
    if (isOpen && popoverEl) {
      const firstButton = popoverEl.querySelector<HTMLButtonElement>(
        'button[role="menuitem"]'
      );
      firstButton?.focus();
    }
  });

  function triggerHaptic() {
    try {
      const hapticService = getHapticFeedback();
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
  }

  async function handleSignOut() {
    triggerHaptic();
    try {
      await authState.signOut();
    } catch {
      // Sign-out failure is rare; close regardless
    }
    onClose();
  }

  async function handleSignIn() {
    triggerHaptic();
    // Close the popover before launching the Google popup. When Firebase
    // returns and the auth listener fan-out starts re-rendering the sidebar
    // (swapping in premium modules, pulling the user avatar, etc.), there's
    // no stale "Sign In" menu hanging over the top of it. Visually the user
    // sees the popover dismiss, the OAuth popup take focus, then the signed-in
    // app on return - no double-update flash.
    onClose();
    try {
      await signInWithGoogle();
    } catch {
      // Sign-in failure handled by auth UI
    }
  }

  function handleWhatsNew() {
    triggerHaptic();
    void whatsNewState.openManual();
    onClose();
  }

  // Prop preference state for nudge detection
  const userId = $derived(authState.user?.uid);
  const propState = $derived.by(() => {
    if (!userId) return null;
    return createPropPreferenceState(userId);
  });

  // Profile completeness nudges - each disappears once the user completes the action
  const needsPhoto = $derived(isFullAccount && !photoURL);
  const needsProp = $derived(
    isFullAccount && propState && !propState.loading && !propState.favoriteProp
  );
  const hasNudges = $derived(needsPhoto || needsProp);

  function handleNavigateToProfile() {
    triggerHaptic();
    onClose();
    handleModuleChange("settings" as ModuleId, "profile");
  }
</script>

{#if isOpen}
  <div
    class="account-popover"
    role="menu"
    bind:this={popoverEl}
    style={popoverStyle}
  >
    <!-- Identity header - clickable when authenticated, navigates to Settings > Account -->
    {#if isFullAccount}
      <button
        class="identity-header interactive"
        onclick={handleNavigateToProfile}
        aria-label="Edit profile"
      >
        <RobustAvatar
          src={photoURL}
          name={displayName}
          size="md"
          customSize={40}
        />
        <div class="identity-info">
          <span class="identity-name">{displayName}</span>
          {#if email}
            <span class="identity-email">{email}</span>
          {/if}
        </div>
        <i class="fas fa-chevron-right identity-chevron" aria-hidden="true"></i>
      </button>
    {:else}
      <div class="identity-header">
        <div class="identity-avatar-guest">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
        <div class="identity-info">
          <span class="identity-name">{displayName}</span>
          {#if email}
            <span class="identity-email">{email}</span>
          {/if}
        </div>
      </div>
    {/if}

    {#if isFullAccount && hasNudges}
      <div class="nudges-section">
        {#if needsPhoto}
          <button
            class="nudge-card"
            onclick={handleNavigateToProfile}
            aria-label="Add a profile photo"
          >
            <div class="nudge-icon">
              <i class="fas fa-camera" aria-hidden="true"></i>
            </div>
            <div class="nudge-info">
              <span class="nudge-label">Add a profile photo</span>
              <span class="nudge-hint">Let people recognize you</span>
            </div>
            <i class="fas fa-chevron-right nudge-arrow" aria-hidden="true"></i>
          </button>
        {/if}
        {#if needsProp}
          <button
            class="nudge-card"
            onclick={handleNavigateToProfile}
            aria-label="Pick your favorite prop"
          >
            <div class="nudge-icon">
              <i class="fas fa-fire" aria-hidden="true"></i>
            </div>
            <div class="nudge-info">
              <span class="nudge-label">Pick your favorite prop</span>
              <span class="nudge-hint">What do you spin?</span>
            </div>
            <i class="fas fa-chevron-right nudge-arrow" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <div class="actions">
      {#if isFullAccount}
        <button
          class="action-button sign-out"
          role="menuitem"
          onclick={handleSignOut}
        >
          <i
            class="fas fa-sign-out-alt action-icon"
            aria-hidden="true"
          ></i>
          Sign Out
        </button>
      {:else}
        <button
          class="action-button"
          role="menuitem"
          onclick={handleSignIn}
        >
          <i
            class="fas fa-sign-in-alt action-icon"
            aria-hidden="true"
          ></i>
          Sign In
        </button>
      {/if}
    </div>

    <!-- Version footer -->
    <div class="version-footer">
      <button class="version-link" onclick={handleWhatsNew}>
        v{__APP_VERSION__}
        <span class="whats-new-label">What's new</span>
      </button>
    </div>
  </div>
{/if}


<style>
  /* ==========================================================================
     POPOVER CONTAINER
     ========================================================================== */
  .account-popover {
    position: fixed;
    min-width: 220px;
    background: rgb(18, 18, 28);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    z-index: 200;
    overflow: hidden;
    transform-origin: bottom left;
    animation: popover-enter var(--duration-normal, 200ms) ease-out;
  }

  @keyframes popover-enter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* ==========================================================================
     IDENTITY HEADER
     ========================================================================== */
  .identity-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  .identity-header.interactive {
    width: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: background var(--duration-fast, 150ms) ease;
    border-radius: 0;
  }

  .identity-header.interactive:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .identity-header.interactive:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: -2px;
  }

  .identity-chevron {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.3;
    flex-shrink: 0;
  }

  .identity-avatar-guest {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 14px);
  }

  .identity-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .identity-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .identity-email {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ==========================================================================
     NUDGES SECTION
     ========================================================================== */
  .nudges-section {
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .nudge-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .nudge-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .nudge-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: -2px;
  }

  .nudge-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-accent, #6366f1);
    font-size: 12px;
  }

  .nudge-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    text-align: left;
  }

  .nudge-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .nudge-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .nudge-arrow {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    flex-shrink: 0;
  }

  /* ==========================================================================
     ACTIONS
     ========================================================================== */
  .actions {
    padding: 4px 8px;
  }

  .action-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .action-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
  }

  .action-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: -2px;
  }

  .action-icon {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .action-button:hover .action-icon {
    opacity: 1;
  }

  /* Sign out hover turns red */
  .action-button.sign-out:hover {
    color: var(--semantic-error);
  }

  .action-button.sign-out:hover .action-icon {
    color: var(--semantic-error);
  }

  /* ==========================================================================
     VERSION FOOTER
     ========================================================================== */
  .version-footer {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .version-link {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    padding: 10px 16px 12px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    opacity: 0.6;
    cursor: pointer;
    transition:
      opacity var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .version-link:hover {
    opacity: 1;
    color: var(--theme-accent);
  }

  .version-link:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .whats-new-label {
    font-weight: 500;
  }

  /* ==========================================================================
     ACCESSIBILITY
     ========================================================================== */
  @media (prefers-reduced-motion: reduce) {
    .account-popover {
      animation: none;
    }

    .action-button,
    .version-link,
    .identity-header.interactive {
      transition: none !important;
    }
  }

  @media (prefers-contrast: high) {
    .account-popover {
      border: 2px solid white;
      background: rgba(0, 0, 0, 0.95);
    }

    .action-button:focus-visible,
    .version-link:focus-visible {
      outline-color: white;
    }
  }
</style>
