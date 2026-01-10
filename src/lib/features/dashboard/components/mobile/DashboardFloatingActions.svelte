<script lang="ts">
  /**
   * DashboardFloatingActions
   *
   * Two floating action buttons in top corners (mobile only).
   * Top-left: Messages → Opens MessagesDrawer
   * Top-right: Notifications → Opens NotificationsDrawer
   */

  import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";

  // Props
  let { onMessagesClick, onNotificationsClick } = $props<{
    onMessagesClick: () => void;
    onNotificationsClick: () => void;
  }>();

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Count unread messages
  const unreadMessagesCount = $derived(
    inboxState.conversations.filter((c) => c.unreadCount > 0).length
  );

  // Count unread notifications
  const unreadNotificationsCount = $derived(
    inboxState.notifications.filter((n) => !n.read).length
  );

  function handleMessagesClick() {
    hapticService?.trigger("selection");
    onMessagesClick();
  }

  function handleNotificationsClick() {
    hapticService?.trigger("selection");
    onNotificationsClick();
  }
</script>

<div class="floating-actions">
  <!-- Messages Button (Top-left) -->
  <button
    class="floating-button messages-button"
    onclick={handleMessagesClick}
    aria-label="Messages{unreadMessagesCount > 0
      ? ` (${unreadMessagesCount} unread)`
      : ''}"
  >
    <i class="fas fa-envelope" aria-hidden="true"></i>
    {#if unreadMessagesCount > 0}
      <span class="badge">{unreadMessagesCount}</span>
    {/if}
  </button>

  <!-- Notifications Button (Top-right) -->
  <button
    class="floating-button notifications-button"
    onclick={handleNotificationsClick}
    aria-label="Notifications{unreadNotificationsCount > 0
      ? ` (${unreadNotificationsCount} unread)`
      : ''}"
  >
    <i class="fas fa-bell" aria-hidden="true"></i>
    {#if unreadNotificationsCount > 0}
      <span class="badge">{unreadNotificationsCount}</span>
    {/if}
  </button>
</div>

<style>
  .floating-actions {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    pointer-events: none;
  }

  .floating-button {
    position: absolute;
    top: calc(16px + env(safe-area-inset-top, 0px));
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    padding: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 50%;
    color: var(--theme-text);
    cursor: pointer;
    pointer-events: auto;
    box-shadow:
      0 4px 12px var(--theme-shadow),
      0 2px 4px var(--theme-shadow);
    transition:
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.2s ease,
      background 0.2s ease;
  }

  .messages-button {
    left: 16px;
  }

  .notifications-button {
    right: 16px;
  }

  .floating-button i {
    font-size: var(--font-size-xl);
  }

  .floating-button:hover {
    transform: scale(1.05);
    background: rgba(0, 0, 0, 0.7);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.4),
      0 3px 6px var(--theme-shadow);
  }

  .floating-button:active {
    transform: scale(0.92);
  }

  .floating-button:focus-visible {
    outline: none;
    box-shadow:
      0 4px 12px var(--theme-shadow),
      0 2px 4px var(--theme-shadow),
      0 0 0 3px color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Badge styling */
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--semantic-error) 0%,
      var(--semantic-error) 100%
    );
    border: 2px solid rgba(0, 0, 0, 0.8);
    border-radius: 9px;
    color: #ffffff;
    font-size: var(--font-size-compact);
    font-weight: 700;
    line-height: 1;
    animation: badgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes badgePop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .floating-button {
      transition: none !important;
    }

    .badge {
      animation: none !important;
    }
  }
</style>
