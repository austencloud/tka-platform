<!--
  ModuleSwitcher - Module Navigation Drawer

  A standardized drawer component for switching between app modules.
  Uses the shared Drawer component (vaul-svelte based) for consistent UX.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { ModuleDefinition, ModuleId } from "../domain/types";
  import ModuleList from "./ModuleList.svelte";
  import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "../../device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "../../device/domain/models/device-models";
  import Drawer from "../../foundation/ui/Drawer.svelte";

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

  let hapticService: IHapticFeedback;
  let deviceDetector: IDeviceDetector | null = null;
  let isOpen = $state(false);

  // Responsive settings from DeviceDetector (same as MobileNavigation)
  let responsiveSettings = $state<ResponsiveSettings | null>(null);

  // Determine drawer placement based on navigation layout
  // - Landscape mobile (side navigation) → drawer from left
  // - Portrait mobile (bottom navigation) → drawer from bottom
  let drawerPlacement = $derived<"left" | "bottom">(
    responsiveSettings?.isLandscapeMobile ? "left" : "bottom"
  );

  function closeDrawer() {
    hapticService?.trigger("selection");
    isOpen = false;
  }

  function openDrawer() {
    hapticService?.trigger("selection");
    isOpen = true;
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    // Resolve DeviceDetector service (same pattern as MobileNavigation)
    let deviceCleanup: (() => void) | undefined;
    try {
      deviceDetector = container.items.deviceDetector;

      // Get initial responsive settings
      responsiveSettings = deviceDetector.getResponsiveSettings();

      // Subscribe to device capability changes
      deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
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

  /* Bottom placement: Full width, full height for focused navigation */
  :global(.module-switcher-drawer[data-placement="bottom"]) {
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 100vh !important;
    max-height: 100vh !important;
  }

  /* Left placement: Full height, partial width */
  :global(.module-switcher-drawer[data-placement="left"]) {
    top: 0 !important;
    bottom: 0 !important;
    height: 100vh !important;
    width: 320px !important;
    max-width: 85vw !important;
  }

  :global(.module-switcher-backdrop) {
    --sheet-backdrop-bg: rgba(0, 0, 0, 0.4);
    --sheet-backdrop-filter: blur(3px);
  }

  /* Sheet content - ensure proper z-index */
  :global(.drawer-content.module-switcher-drawer) {
    z-index: 1100 !important;
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
</style>
