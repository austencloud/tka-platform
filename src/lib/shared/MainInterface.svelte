<script lang="ts">
  /**
   * MainInterface
   * Domain: Application Layout Shell
   *
   * Pure layout orchestration component.
   * Delegates all business logic to specialized managers.
   */
  import { onMount } from "svelte";
  import { getActiveTab } from "./application/state/ui/ui-state.svelte";
  // import { handleHMRInit } from "./hmr-helper"; // No longer needed
  import {
    layoutState,
    moduleHasPrimaryNav,
    setCurrentWord,
    setLearnHeader,
    setPrimaryNavHeight,
    setPrimaryNavLandscape,
    setTabAccessibility,
  } from "./layout/layout-state.svelte";
  import {
    currentModule,
    currentModuleName,
    currentSection,
    handleModuleChange,
    handleSectionChange,
    initializeNavigationHistory,
    getModuleDefinitions,
    moduleSections,
    navigationCoordinator,
  } from "./navigation-coordinator/navigation-coordinator.svelte";

  // Get module definitions reactively
  const moduleDefinitions = $derived(getModuleDefinitions());

  // Layout components
  import MobileNavigation from "./navigation/components/MobileNavigation.svelte";
  import DesktopNavigationSidebar from "./navigation/components/DesktopNavigationSidebar.svelte";
  import ModuleSwitcher from "./navigation/components/ModuleSwitcher.svelte";
  // Domain managers
  import ModuleRenderer from "./modules/ModuleRenderer.svelte";
  import PWAInstallationManager from "./pwa/PWAInstallationManager.svelte";
  import SpotlightRouter from "./spotlight/SpotlightRouter.svelte";
  import {
    desktopSidebarState,
    setDesktopSidebarCollapsed,
  } from "./layout/desktop-sidebar-state.svelte";
  import SidebarTourOverlay from "./onboarding/components/sidebar-tour/SidebarTourOverlay.svelte";
  // Keyboard shortcuts

  import type { IDeepLinker } from "./navigation/services/contracts/IDeepLinker";
  import { useDesktopSidebarVisibility } from "./navigation/services/desktop-sidebar-visibility.svelte";
  import { exploreScrollState } from "../features/explore/shared/state/ExploreScrollState.svelte";
  import type { IViewportManager } from "./device/services/contracts/IViewportManager";
  import { container } from "./di";
  import type { IDeviceDetector } from "./device/services/contracts/IDeviceDetector";
  import type { ModuleId } from "./navigation/domain/types";
  import { navigationState } from "./navigation/state/navigation-state.svelte";
  import { hasOpenDrawers } from "./foundation/ui/drawer/DrawerStack";
  import { keyboardShortcutState } from "./keyboard/state/keyboard-shortcut-state.svelte";
  import CommandPalette from "./keyboard/components/CommandPalette.svelte";
  import ShortcutsHelp from "./keyboard/components/ShortcutsHelp.svelte";
  import KeyboardShortcutCoordinator from "./keyboard/coordinators/KeyboardShortcutCoordinator.svelte";

  // 🚀 Performance: Module prefetching
  import {
    preloadCriticalModules,
    prefetchLikelyNextModules,
  } from "./navigation/utils/module-prefetch";

  // Debug tools
  import AdminToolbar from "./debug/components/AdminToolbar.svelte";
  import { initUserPreviewContext } from "./debug/context/user-preview-context";
  import { userPreviewState } from "./debug/state/user-preview-state.svelte";
  import { adminToolbarState } from "./debug/state/admin-toolbar-state.svelte";
  import { featureFlagService } from "./auth/services/FeatureFlagService.svelte";
  import ToastContainer from "./toast/components/ToastContainer.svelte";
  import ReleaseNotesDrawer from "./settings/components/ReleaseNotesDrawer.svelte";

  // Toast notifications

  // Initialize user preview context for app-wide access
  initUserPreviewContext();

  // Reactive state
  const activeModule = $derived(getActiveTab()); // Using legacy getActiveTab for now
  const isModuleLoading = $derived(activeModule === null);
  // Show banner offset when user preview OR admin toolbar is open
  const isAdmin = $derived(featureFlagService.userRole === "admin");
  const isPreviewMode = $derived(
    isAdmin && (userPreviewState.isActive || adminToolbarState.isOpen)
  );

  // Desktop sidebar visibility management
  let desktopSidebarVisibility: ReturnType<
    typeof useDesktopSidebarVisibility
  > | null = null;
  const showDesktopSidebar = $derived(desktopSidebarState.isVisible);

  // Primary navigation visibility - hide during Discover module scroll
  const isPrimaryNavVisible = $derived(() => {
    const module = currentModule();
    if (module === "explore") {
      return exploreScrollState.isUIVisible;
    }
    return true;
  });

  // Sync state to coordinators
  $effect(() => {
    navigationCoordinator.canAccessEditAndExportPanels =
      layoutState.canAccessEditAndExportPanels;
  });

  // Sync preview banner state to body for drawer CSS positioning
  $effect(() => {
    if (isPreviewMode) {
      document.body.classList.add("has-preview-banner");
    } else {
      document.body.classList.remove("has-preview-banner");
    }
  });

  // Handle reveal navigation from peek indicator
  function handleRevealNav() {
    exploreScrollState.forceShowUI();
  }


  // 🚀 Prefetch likely next modules when current module changes
  $effect(() => {
    const module = currentModule();
    if (module) {
      prefetchLikelyNextModules(module);
    }
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    // handleHMRInit(); // Disabled - causing HMR verification loops

    // 🚀 PERFORMANCE: Preload critical modules during idle time
    // Only prefetch from Dashboard - prefetching on Settings/other modules
    // would defeat lazy loading (Create has 150+ files = 5+ seconds)
    preloadCriticalModules(currentModule());

    // Enable native back/forward by wiring navigation state to history
    initializeNavigationHistory();

    // Initialize deep linking for shareable sequence URLs
    try {
      const deepLinkService = container.items.deepLinker as IDeepLinker;
      deepLinkService.initialize();
    } catch (error) {
      console.warn("Failed to initialize deep link service:", error);
    }

    // Initialize desktop sidebar visibility
    try {
      const deviceDetector = container.items.deviceDetector as IDeviceDetector;
      const viewportService = container.items.viewportManager as IViewportManager;
      desktopSidebarVisibility = useDesktopSidebarVisibility(
        deviceDetector,
        viewportService
      );
    } catch (error) {
      console.warn(
        "MainInterface: Failed to initialize desktop sidebar visibility",
        error
      );
    }

    return () => {
      desktopSidebarVisibility?.cleanup();
    };
  });
</script>

<!-- Skip to main content link for keyboard/screen reader users -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Admin Toolbar (F9) -->
<AdminToolbar />

<div
  class="main-interface"
  class:nav-landscape={layoutState.isPrimaryNavLandscape}
  class:has-desktop-sidebar={showDesktopSidebar}
  class:has-preview-banner={isPreviewMode}
  style="--primary-nav-height: {layoutState.primaryNavHeight}px; --desktop-sidebar-width: {desktopSidebarState.width}px;"
>
  <!-- Desktop Navigation Sidebar (only on desktop in side-by-side layout) -->
  {#if showDesktopSidebar}
    <DesktopNavigationSidebar
      currentModule={currentModule()}
      currentSection={currentSection()}
      modules={moduleDefinitions}
      onModuleChange={handleModuleChange}
      onSectionChange={handleSectionChange}
    />
    <!-- Sidebar Tour (desktop only, first-time users) -->
    <SidebarTourOverlay
      sidebarCollapsed={desktopSidebarState.isCollapsed}
      onExpandSidebar={() => setDesktopSidebarCollapsed(false)}
      onRestoreSidebar={(wasCollapsed) =>
        setDesktopSidebarCollapsed(wasCollapsed)}
    />
  {/if}

  <!-- Content + Navigation Wrapper (flex layout) -->
  <div class="content-wrapper">
    <!-- Main Content Area -->
    <main
      id="main-content"
      class="content-area"
      class:nav-hidden={!isPrimaryNavVisible()}
      class:nav-landscape={layoutState.isPrimaryNavLandscape}
    >
      <ModuleRenderer
        {activeModule}
        {isModuleLoading}
        onTabAccessibilityChange={setTabAccessibility}
        onCurrentWordChange={setCurrentWord}
        onLearnHeaderChange={setLearnHeader}
      />
    </main>

    <!-- Mobile Navigation (conditionally rendered) -->
    {#if moduleHasPrimaryNav(currentModule()) && !showDesktopSidebar}
      <MobileNavigation
        sections={moduleSections()}
        currentSection={currentSection()}
        onSectionChange={handleSectionChange}
        onModuleSwitcherTap={() => {
          // Open module switcher drawer directly
          window.dispatchEvent(new CustomEvent("module-switcher-toggle"));
        }}
        onLayoutChange={setPrimaryNavLandscape}
        onHeightChange={setPrimaryNavHeight}
        isUIVisible={isPrimaryNavVisible()}
        onRevealNav={handleRevealNav}
        isDashboard={currentModule() === "dashboard"}
      />
    {/if}
  </div>

  <!-- Domain Managers -->
  <PWAInstallationManager />
  <SpotlightRouter />
  <!-- Module Switcher Drawer (opens via custom event) -->
  <ModuleSwitcher
    currentModule={currentModule()}
    currentModuleName={currentModuleName()}
    modules={moduleDefinitions}
    onModuleChange={handleModuleChange}
  />
  <!-- Keyboard Shortcuts -->
  <KeyboardShortcutCoordinator />
  <CommandPalette />
  <ShortcutsHelp />
  <!-- Toast Notifications -->
  <ToastContainer />
  <!-- Release Notes Drawer -->
  <ReleaseNotesDrawer />
</div>

<style>
  /* Skip link - visually hidden until focused (sr-only pattern) */
  .skip-link {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
    /* Style for when focused */
    background: var(--theme-panel-bg);
    color: var(--theme-text, white);
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    z-index: 9999;
  }

  .skip-link:focus {
    position: fixed;
    top: 16px;
    left: 16px;
    width: auto;
    height: auto;
    padding: 12px 24px;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  .main-interface {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: var(--viewport-height, 100vh);
    height: 100dvh;
    width: 100%;
    overflow: hidden;
    position: relative;
    background: transparent;
    transition:
      padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      padding-top 0.2s ease;
  }

  /* Desktop sidebar support */
  .main-interface.has-desktop-sidebar {
    padding-left: var(--desktop-sidebar-width, 280px);
  }

  /* Debug banner support (user preview OR role override) - push content down */
  /* Banner height: 56px content + 2px border = 58px total */
  .main-interface.has-preview-banner {
    padding-top: 58px;
  }

  /* Push desktop sidebar down when banner is shown */
  .main-interface.has-preview-banner :global(.desktop-navigation-sidebar) {
    top: 58px;
  }

  @media (max-width: 768px) {
    /* Mobile banner: 48px content + 2px border = 50px total */
    .main-interface.has-preview-banner {
      padding-top: 50px;
    }
  }

  /* Content + Navigation Wrapper - flex container for content and nav */
  .content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }

  /* Landscape mode - add left padding for side navigation */
  .content-area.nav-landscape {
    padding-left: 72px !important;
    padding-left: max(72px, env(safe-area-inset-left)) !important;
  }

  /* Reset padding when desktop sidebar is visible */
  .main-interface.has-desktop-sidebar .content-area {
    padding-left: 0 !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .main-interface {
      transition: none !important;
      animation: none !important;
    }
  }

  @media (prefers-contrast: high) {
    .main-interface {
      border: 2px solid #667eea;
    }
  }

  @media print {
    .main-interface {
      height: auto;
      overflow: visible;
    }

    .content-area {
      overflow: visible;
      height: auto;
    }
  }
</style>
