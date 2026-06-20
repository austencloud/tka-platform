<!--
  ModuleSwitcher - Module Navigation Drawer

  A standardized drawer component for switching between app modules.
  Uses the shared Drawer component (vaul-svelte based) for consistent UX.
-->
<script lang="ts">
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { desktopSidebarState } from "../../layout/desktop-sidebar-state.svelte";
  import type { ModuleDefinition, ModuleId } from "../domain/types";
  import ModuleList from "./ModuleList.svelte";
  import type { HapticFeedback } from "../../application/services/haptic-feedback";
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import type { ResponsiveSettings } from "../../device/domain/models/device-models";
  import Drawer from "../../foundation/ui/Drawer.svelte";
  import AccountRow from "./account/AccountRow.svelte";
  import { authState } from "../../auth/state/auth-state.svelte";
  import { inboxState } from "../../inbox/state/inbox-state.svelte";
  import { userPreviewState } from "../../debug/state/user-preview-state.svelte";

  let {
    // Current state
    currentModule,
    currentModuleName,

    // Available options
    modules = [],

    // Callbacks
    onModuleChange,
  } = $props<{
    currentModule: ModuleId;
    currentModuleName: string;
    modules: ModuleDefinition[];
    onModuleChange?: (moduleId: ModuleId) => void;
  }>();

  let hapticService: HapticFeedback = null!;
  let deviceDetector: DeviceDetector | null = null;
  let isOpen = $state(false);

  const hasUnread = $derived(inboxState.totalUnreadCount > 0);
  const unreadCount = $derived(inboxState.totalUnreadCount);

  // A full account (member) — NOT an anonymous guest, who is technically
  // authenticated. Inbox / Sign Out / profile navigation are member-only;
  // guests get the AccountRow "Sign in" entry instead.
  const isFullAccount = $derived(authState.isFullAccount);

  // Responsive settings from DeviceDetector (same as MobileNavigation)
  let responsiveSettings = $state<ResponsiveSettings | null>(null);

  // Determine drawer placement based on navigation layout
  // - Landscape mobile (side navigation) → drawer from left
  // - Portrait mobile (bottom navigation) → drawer from bottom
  let drawerPlacement = $derived<"left" | "bottom">(
    responsiveSettings?.isLandscapeMobile ? "left" : "bottom"
  );

  // Auto-close drawer when desktop sidebar appears (e.g. viewport resized wider)
  $effect(() => {
    if (desktopSidebarState.isVisible && isOpen) {
      isOpen = false;
    }
  });

  function closeDrawer() {
    hapticService?.trigger("selection");
    isOpen = false;
  }

  function openDrawer() {
    hapticService?.trigger("selection");
    isOpen = true;
  }

  function handleInboxClick() {
    hapticService?.trigger("selection");
    inboxState.open();
    closeDrawer();
  }

  onMount(() => {
    hapticService = getHapticFeedback();

    // Resolve DeviceDetector service (same pattern as MobileNavigation)
    let deviceCleanup: (() => void) | undefined;
    try {
      deviceDetector = getDeviceDetector();

      if (deviceDetector) {
        // Get initial responsive settings
        responsiveSettings = deviceDetector.getResponsiveSettings();

        // Subscribe to device capability changes
        deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
          responsiveSettings = deviceDetector!.getResponsiveSettings();
        });
      }
    } catch (error) {
      console.warn("ModuleSwitcher: Failed to resolve DeviceDetector", error);
    }

    // Return cleanup function
    return () => {
      deviceCleanup?.();
    };
  });

  function handleModuleSelect(moduleId: ModuleId) {
    onModuleChange?.(moduleId);
    closeDrawer();
  }

  function handleAccountSettings() {
    hapticService?.trigger("selection");
    onModuleChange?.("settings" as ModuleId);
    closeDrawer();
  }

  function handleProfileTap() {
    hapticService?.trigger("selection");
    onModuleChange?.("settings" as ModuleId);
    closeDrawer();
    // Navigate to profile tab after settings module loads
    setTimeout(() => {
      import("../state/navigation-state.svelte").then(({ navigationState }) => {
        navigationState.setActiveTab("profile");
      });
    }, 50);
  }

  async function handleSignOut() {
    hapticService?.trigger("selection");
    closeDrawer();
    try {
      await authState.signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  // Listen for custom event from primary navigation
  onMount(() => {
    const handleToggleEvent = () => {
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    };
    window.addEventListener("module-switcher-toggle", handleToggleEvent);

    return () => {
      window.removeEventListener("module-switcher-toggle", handleToggleEvent);
    };
  });
</script>

<!-- Drawer Component -->
<Drawer
  bind:isOpen
  ariaLabel="Module navigation menu"
  class="module-switcher-drawer"
  backdropClass="module-switcher-backdrop"
  placement={drawerPlacement}
  showHandle={true}
  closeOnBackdrop={true}
>
  <div class="module-switcher-container">
    <!-- Header -->
    <div class="module-switcher-header">
      <div class="header-content">
        <h2>Navigation</h2>
        <div class="current-location">
          <span class="module-name">{currentModuleName}</span>
        </div>
      </div>
      <button
        class="close-button"
        onclick={closeDrawer}
        aria-label="Close menu"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Content -->
    <div class="module-switcher-content themed-scrollbar">
      <!-- Module Selection -->
      <ModuleList
        {currentModule}
        {modules}
        onModuleSelect={handleModuleSelect}
      />
    </div>

    <!-- Account Footer -->
    <div class="account-footer">
      <AccountRow
        variant="drawer"
        onclick={userPreviewState.isActive
          ? undefined
          : isFullAccount
            ? handleProfileTap
            : closeDrawer}
      />
      <div class="account-footer-actions">
        {#if isFullAccount}
          <button class="drawer-action inbox" onclick={handleInboxClick}>
            <div class="drawer-action-icon-wrapper">
              <i class="fas fa-inbox" aria-hidden="true"></i>
              {#if hasUnread}
                <span class="drawer-unread-dot" aria-hidden="true"></span>
              {/if}
            </div>
            <span>Inbox</span>
            {#if hasUnread && unreadCount > 0}
              <span class="drawer-inbox-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
            {/if}
          </button>
        {/if}
        <button class="drawer-action" onclick={handleAccountSettings}>
          <i class="fas fa-cog" aria-hidden="true"></i>
          <span>Settings</span>
        </button>
        {#if isFullAccount}
          <button class="drawer-action sign-out" onclick={handleSignOut}>
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            <span>Sign Out</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
</Drawer>

<style>
  /* ============================================================================
     DRAWER STYLING - Refined Minimal Design
     ============================================================================ */
  :global(.module-switcher-drawer) {
    /* Drawer fills viewport appropriately based on placement */
    --sheet-bg: var(--theme-panel-bg);
    --sheet-filter: blur(24px) saturate(140%);
    --sheet-border: 1px solid var(--theme-stroke);
    --sheet-radius-large: 20px;
    box-sizing: border-box !important;
  }

  /* Bottom placement: Full width, content-adaptive height */
  :global(.module-switcher-drawer[data-placement="bottom"]) {
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    /* Default: full height on narrow mobile */
    height: 100vh !important;
    height: 100dvh !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
  }

  /* Widescreen devices (Z-Fold unfolded, tablets): content-sized drawer */
  @media (min-width: 700px) and (min-height: 500px) {
    :global(.module-switcher-drawer[data-placement="bottom"]) {
      height: auto !important;
      max-height: 85vh !important;
      max-height: 85dvh !important;
      border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
    }
  }

  /* Left placement: Full height, partial width */
  :global(.module-switcher-drawer[data-placement="left"]) {
    top: 0 !important;
    bottom: 0 !important;
    height: 100vh !important;
    height: 100dvh !important;
    width: 320px !important;
    max-width: 85vw !important;
  }

  :global(.module-switcher-backdrop) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.4);
    --sheet-backdrop-filter: blur(3px);
  }

  /* Drawer inner fills available height */
  :global(.drawer-content.module-switcher-drawer .drawer-inner) {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* ============================================================================
     CONTAINER - Fills drawer height
     ============================================================================ */
  .module-switcher-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  /* ============================================================================
     HEADER - Refined Minimal
     ============================================================================ */
  .module-switcher-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 14px; /* Adjusted for larger close button */
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
    gap: 16px; /* More space between header content and close button */
    position: relative;
  }

  /* Subtle gradient accent at top of header */
  .module-switcher-header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--theme-accent) 30%, transparent),
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 30%,
        transparent
      ),
      transparent
    );
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .module-switcher-header h2 {
    margin: 0 0 4px 0;
    font-size: var(--font-size-xl); /* Larger, more prominent on mobile */
    font-weight: 700;
    color: var(--theme-text, var(--theme-text));
    letter-spacing: -0.01em;
  }

  .current-location {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(
      --font-size-sm
    ); /* Increased from 12px for better mobile readability */
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .module-name {
    font-weight: 600;
    color: var(
      --theme-text,
      rgba(255, 255, 255, 0.75)
    ); /* Slightly more prominent */
  }

  /* Close button - accessible touch target (50px minimum) */
  .close-button {
    width: var(
      --min-touch-target
    ); /* Increased from 36px for proper touch target */
    height: var(
      --min-touch-target
    ); /* Increased from 36px for proper touch target */
    border-radius: 12px; /* Slightly larger to match new size */
    background: transparent;
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base); /* Slightly larger icon */
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, var(--theme-stroke));
    color: var(--theme-text);
  }

  .close-button:active {
    transform: scale(0.95);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  /* ============================================================================
     CONTENT - Fill available space with generous padding
     ============================================================================ */
  .module-switcher-content {
    padding: 20px 20px 40px; /* More generous padding for modern spacious feel */
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    display: flex;
    flex-direction: column;

    /* Smooth scrolling */
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  /* ============================================================================
     RESPONSIVE ADJUSTMENTS
     ============================================================================ */

  /* Landscape mobile - optimize for left drawer */
  @media (max-height: 600px) and (orientation: landscape) {
    .module-switcher-header {
      padding: 12px 14px 10px;
    }

    .module-switcher-header h2 {
      font-size: var(--font-size-lg); /* Keep it readable in landscape */
    }

    .current-location {
      font-size: var(--font-size-compact);
    }

    .module-switcher-content {
      padding: 14px 16px 24px;
    }

    :global(.module-switcher-drawer[data-placement="left"]) {
      width: 280px !important; /* Slightly narrower in landscape */
    }
  }

  /* Portrait mobile - maintain readability */
  @media (max-width: 500px) and (orientation: portrait) {
    .module-switcher-header {
      padding: 14px 14px 12px;
    }

    .module-switcher-header h2 {
      font-size: var(
        --font-size-lg
      ); /* Slightly smaller on very small screens */
    }

    .current-location {
      font-size: var(--font-size-sm); /* Maintain readability */
    }

    .module-switcher-content {
      padding: 16px 16px 32px; /* Maintain generous padding on mobile */
    }
  }

  /* Widescreen bottom drawer: tighten padding so content is compact */
  @media (min-width: 700px) and (min-height: 500px) {
    .module-switcher-content {
      padding: 12px 20px 16px;
    }

    .module-switcher-header {
      padding: 12px 16px 10px;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }

    .close-button:active {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    :global(.module-switcher-drawer) {
      --sheet-bg: rgba(0, 0, 0, 0.98);
      --sheet-border: 2px solid white;
    }

    .close-button {
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid white;
      color: black;
    }
  }

  /* ============================================================================
     ACCOUNT FOOTER - Pinned at bottom of drawer
     ============================================================================ */
  .account-footer {
    flex-shrink: 0;
    padding: 12px 20px max(20px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--theme-stroke);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .drawer-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1;
    min-height: var(--min-touch-target, 50px);
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    transition: all var(--duration-fast) ease;
  }

  .drawer-action:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .drawer-action:active {
    transform: scale(0.97);
  }

  .drawer-action:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  .drawer-action i {
    font-size: var(--font-size-sm, 14px);
  }

  /* Inbox - blue accent */
  .drawer-action.inbox {
    color: var(--semantic-info, #3b82f6);
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 25%, transparent);
  }

  .drawer-action.inbox:hover {
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
  }

  /* Sign Out - red by default */
  .drawer-action.sign-out {
    color: var(--semantic-error, #ef4444);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
  }

  .drawer-action.sign-out:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
  }

  /* ============================================================================
     ACCOUNT FOOTER ACTIONS - Inline row of quick actions
     ============================================================================ */
  .account-footer-actions {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .drawer-action-icon-wrapper {
    position: relative;
  }

  .drawer-unread-dot {
    position: absolute;
    top: -3px;
    right: -5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--semantic-error, #ef4444);
  }

  .drawer-inbox-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--semantic-info, #3b82f6);
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-action {
      transition: none;
    }
  }
</style>
