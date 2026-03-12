<!-- AccountPopover: Desktop-only popover menu above AccountRow in sidebar -->
<script lang="ts">
  import { authState } from "../../../auth/state/authState.svelte";
  import { whatsNewState } from "../../../settings/state/whats-new-state.svelte";
  import { container } from "../../../di";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import type { IPropPreferencePersister } from "../../../community/services/contracts/IPropPreferencePersister";
  import { createPropPreferenceState } from "../../../community/state/prop-preference-state.svelte";
  import RobustAvatar from "../../../components/avatar/RobustAvatar.svelte";
  import MyPropsCard from "./MyPropsCard.svelte";
  import { myPropsDrawerState } from "./my-props-drawer-state.svelte";

  let { isOpen, onClose, onInboxClick, hasUnread = false, unreadCount = 0, anchorElement } = $props<{
    isOpen: boolean;
    onClose: () => void;
    onInboxClick: () => void;
    hasUnread?: boolean;
    unreadCount?: number;
    anchorElement: HTMLElement | null;
  }>();

  const user = $derived(authState.user);
  const isAuthenticated = $derived(authState.isAuthenticated);
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

  function handleInbox() {
    triggerHaptic();
    onInboxClick();
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

  async function handleSignIn() {
    triggerHaptic();
    try {
      const authenticator = container.items.authenticator;
      await authenticator.signInWithGoogle();
    } catch {
      // Sign-in failure handled by auth UI
    }
    onClose();
  }

  function handleWhatsNew() {
    triggerHaptic();
    void whatsNewState.openManual();
    onClose();
  }

  const userId = $derived(authState.user?.uid);
  const propState = $derived.by(() => {
    if (!userId) return null;
    const persister = container.items.propPreferencePersister as IPropPreferencePersister;
    return createPropPreferenceState(persister, userId);
  });

  function handleOpenPropEditor() {
    triggerHaptic();
    onClose();
    // Open drawer via shared state so it renders at the document root,
    // outside the sidebar's backdrop-filter containing block
    requestAnimationFrame(() => {
      if (propState) {
        myPropsDrawerState.open(propState);
      }
    });
  }
</script>

{#if isOpen}
  <div
    class="account-popover"
    role="menu"
    bind:this={popoverEl}
    style={popoverStyle}
  >
    <!-- Identity header -->
    <div class="identity-header">
      {#if isAuthenticated}
        <RobustAvatar
          src={photoURL}
          name={displayName}
          size="md"
          customSize={40}
        />
      {:else}
        <div class="identity-avatar-guest">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
      {/if}
      <div class="identity-info">
        <span class="identity-name">{displayName}</span>
        {#if email}
          <span class="identity-email">{email}</span>
        {/if}
      </div>
    </div>

    {#if isAuthenticated}
      <div class="props-section">
        <MyPropsCard {propState} onOpenPropEditor={handleOpenPropEditor} />
      </div>
    {/if}

    <!-- Actions -->
    <div class="actions">
      <button
        class="action-button"
        role="menuitem"
        onclick={handleInbox}
      >
        <div class="action-icon-wrapper">
          <i class="fas fa-inbox action-icon" aria-hidden="true"></i>
          {#if hasUnread}
            <span class="popover-unread-dot" aria-hidden="true"></span>
          {/if}
        </div>
        Inbox
        {#if hasUnread && unreadCount > 0}
          <span class="inbox-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
        {/if}
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
     PROPS SECTION
     ========================================================================== */
  .props-section {
    padding: 4px 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
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

  /* Inbox icon wrapper for unread dot positioning */
  .action-icon-wrapper {
    position: relative;
    width: 16px;
    text-align: center;
  }

  .action-icon-wrapper .action-icon {
    width: auto;
  }

  .popover-unread-dot {
    position: absolute;
    top: -2px;
    right: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--semantic-error, #ef4444);
  }

  .inbox-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--semantic-info, #3b82f6);
    opacity: 0.8;
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
