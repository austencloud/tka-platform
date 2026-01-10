<script lang="ts">
  /**
   * InboxTabs
   *
   * Tab switcher with animated underline indicator
   */

  import { onMount } from "svelte";
  import { inboxState, type InboxTab } from "../state/inbox-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { notificationService } from "$lib/features/feedback/services/implementations/Notifier";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";

  interface Props {
    class?: string;
  }

  let { class: className = "" }: Props = $props();

  const tabs: { id: InboxTab; label: string; icon: string }[] = [
    { id: "messages", label: "Messages", icon: "fa-comments" },
    { id: "notifications", label: "Notifications", icon: "fa-bell" },
  ];

  // Haptic feedback service
  let hapticService: IHapticFeedback | undefined;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Auto-mark notifications as read when viewing (Facebook/Instagram pattern)
  $effect(() => {
    // Only run when notifications tab is active
    if (inboxState.activeTab !== "notifications") return;

    // Get effective user ID (preview mode or actual)
    const userId =
      userPreviewState.isActive && userPreviewState.data.profile
        ? userPreviewState.data.profile.uid
        : authState.user?.uid;

    if (!userId) return;

    // Check if there are unread notifications
    const unreadCount = inboxState.unreadNotificationCount;

    if (unreadCount > 0) {
      // Mark all notifications as read when viewing the tab (social media pattern)
      notificationService.markAllAsRead(userId).catch((error) => {
        console.error("Failed to auto-mark notifications as read:", error);
      });
    }
  });

  function handleTabClick(tab: InboxTab) {
    hapticService?.trigger("selection");
    inboxState.setTab(tab);
  }

  // Keyboard navigation for tabs (arrow keys)
  function handleKeydown(event: KeyboardEvent) {
    const currentIndex = tabs.findIndex((t) => t.id === inboxState.activeTab);

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        hapticService?.trigger("selection");
        inboxState.setTab(nextTab.id);
      }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const prevTab = tabs[prevIndex];
      if (prevTab) {
        hapticService?.trigger("selection");
        inboxState.setTab(prevTab.id);
      }
    } else if (event.key === "Home") {
      event.preventDefault();
      const firstTab = tabs[0];
      if (firstTab) {
        hapticService?.trigger("selection");
        inboxState.setTab(firstTab.id);
      }
    } else if (event.key === "End") {
      event.preventDefault();
      const lastTab = tabs[tabs.length - 1];
      if (lastTab) {
        hapticService?.trigger("selection");
        inboxState.setTab(lastTab.id);
      }
    }
  }

  // Track active tab index for indicator position
  const activeIndex = $derived(
    tabs.findIndex((t) => t.id === inboxState.activeTab)
  );
</script>

<div
  class="inbox-tabs {className}"
  role="tablist"
  aria-label="Inbox tabs"
  tabindex="0"
  onkeydown={handleKeydown}
>
  <!-- Sliding indicator -->
  <div
    class="tab-indicator"
    style="--active-index: {activeIndex}; --tab-count: {tabs.length}"
  ></div>

  {#each tabs as tab, index}
    {@const unreadCount =
      tab.id === "messages"
        ? inboxState.unreadMessageCount
        : inboxState.unreadNotificationCount}
    <button
      id="inbox-tab-{tab.id}"
      class="tab"
      class:active={inboxState.activeTab === tab.id}
      onclick={() => handleTabClick(tab.id)}
      role="tab"
      aria-selected={inboxState.activeTab === tab.id}
      aria-controls="{tab.id}-panel"
      tabindex={inboxState.activeTab === tab.id ? 0 : -1}
    >
      <i class="fas {tab.icon}" aria-hidden="true"></i>
      <span>{tab.label}</span>
      {#if unreadCount > 0}
        <span class="inbox-tab-badge" aria-label="{unreadCount} unread">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .inbox-tabs {
    position: relative;
    display: flex;
    gap: 4px;
    padding: 8px;
    background: var(--theme-panel-bg);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  /* Sliding indicator */
  .tab-indicator {
    position: absolute;
    left: 8px;
    bottom: 8px;
    height: calc(100% - 16px);
    width: calc((100% - 16px - 4px) / var(--tab-count));
    background: var(--theme-accent, var(--semantic-info));
    border-radius: 8px;
    transform: translateX(calc(var(--active-index) * (100% + 4px)));
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  .tab {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      color 0.2s ease,
      transform 0.15s ease;
    z-index: 1;
  }

  .tab:hover:not(.active) {
    color: var(--theme-text);
  }

  .tab:active {
    transform: scale(0.98);
  }

  .tab:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  .tab.active {
    color: white;
  }

  .tab i {
    font-size: var(--font-size-sm);
    transition: transform 0.2s ease;
  }

  .tab:hover i {
    transform: scale(1.1);
  }

  /* Badge */
  .inbox-tab-badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    line-height: 20px;
    text-align: center;
    transition: background 0.2s ease;
  }

  .tab.active .inbox-tab-badge {
    background: rgba(255, 255, 255, 0.3);
  }

  .tab:not(.active) .inbox-tab-badge {
    background: var(--theme-accent, var(--semantic-info));
    color: white;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tab-indicator,
    .tab,
    .tab i,
    .inbox-tab-badge {
      transition: none !important;
    }
  }
</style>
