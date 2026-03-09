<!-- AccountPopover: Desktop-only popover menu above AccountRow in sidebar -->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import { whatsNewState } from "../../../settings/state/whats-new-state.svelte";
  import { container } from "../../../di";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";

  let { isOpen, onClose, onSettingsClick, anchorElement } = $props<{
    isOpen: boolean;
    onClose: () => void;
    onSettingsClick: () => void;
    anchorElement: HTMLElement | null;
  }>();

  const user = $derived(authState.user);
  const isAuthenticated = $derived(authState.isAuthenticated);
  const displayName = $derived(
    user?.displayName || user?.email || "Guest"
  );
  const email = $derived(user?.email ?? null);
  const initial = $derived(displayName.charAt(0).toUpperCase());
  const photoURL = $derived(user?.photoURL ?? null);

  let popoverEl: HTMLDivElement | undefined = $state();
  let photoError = $state(false);

  // Reset photo error when URL changes
  $effect(() => {
    if (photoURL) {
      photoError = false;
    }
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

    function handleMousedown(e: MouseEvent) {
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
    document.addEventListener("mousedown", handleMousedown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("mousedown", handleMousedown);
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
      const hapticService = container.items
        .hapticFeedback as IHapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
  }

  function handleSettings() {
    triggerHaptic();
    onSettingsClick();
    onClose();
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

  function handleSignIn() {
    triggerHaptic();
    onSettingsClick();
    onClose();
  }

  function handleWhatsNew() {
    triggerHaptic();
    void whatsNewState.openManual();
    onClose();
  }

  function handlePhotoError() {
    photoError = true;
  }
</script>

{#if isOpen}
  <div
    class="account-popover"
    role="menu"
    bind:this={popoverEl}
  >
    <!-- Identity header -->
    <div class="identity-header">
      <div class="identity-avatar">
        {#if isAuthenticated && photoURL && !photoError}
          <img
            class="identity-avatar-photo"
            src={photoURL}
            alt=""
            onerror={handlePhotoError}
          />
        {:else if isAuthenticated}
          <span class="identity-avatar-initial">{initial}</span>
        {:else}
          <i class="fas fa-user" aria-hidden="true"></i>
        {/if}
      </div>
      <div class="identity-info">
        <span class="identity-name">{displayName}</span>
        {#if email}
          <span class="identity-email">{email}</span>
        {/if}
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button
        class="action-button"
        role="menuitem"
        onclick={handleSettings}
      >
        <i class="fas fa-cog action-icon" aria-hidden="true"></i>
        Settings
      </button>

      {#if isAuthenticated}
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
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    right: 0;
    min-width: 220px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
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

  .identity-avatar {
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
    font-weight: 600;
    overflow: hidden;
  }

  .identity-avatar-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .identity-avatar-initial {
    line-height: 1;
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
    padding: 8px 16px 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .version-link {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 4px 0;
    font-size: var(--font-size-compact, 12px);
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
    .version-link {
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
