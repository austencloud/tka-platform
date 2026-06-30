<script lang="ts">

import { getOfflineCacheOrchestrator } from "$lib/shared/offline/get-offline-cache-orchestrator";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { getBrowseEventHandler } from "../get-browse-event-handler";
  import { getThumbnailRenderOrchestrator } from "$lib/shared/browse/get-thumbnail-render-orchestrator";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import { onMount, onDestroy, setContext } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ErrorBanner from "../../../create/shared/components/ErrorBanner.svelte";

  import { createOfflineCacheState } from "$lib/shared/offline/state/offline-cache-state.svelte";
  import { setOfflineCacheContext } from "$lib/shared/offline/context/offline-cache-context";

  import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";

  import type { BrowseEventHandler } from "../services/browse-event-handler";
  import CollectionsBrowsePanel from "../../collections/components/CollectionsBrowsePanel.svelte";
  import CreatorsPanel from "../../creators/components/CreatorsPanel.svelte";
  import UserProfilePanel from "../../creators/components/UserProfilePanel.svelte";
  import { creatorsViewState } from "../../creators/state/creators-view-state.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import GalleryTab from "./GalleryTab.svelte";
  import StartHere from "$lib/features/browse/start-here/components/StartHere.svelte";
  import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
  import {
    browseNavigationState,
    getCreatorIdFromURL,
    type BrowseLocation,
  } from "$lib/shared/browse/state/browse-navigation-state.svelte";
  import { BrowseScrollBehavior } from "../services/browse-scroll-behavior";
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import AnimationSheetCoordinator from "../../../../shared/coordinators/AnimationSheetCoordinator.svelte";
  import { consumePendingSequenceView } from "../../state/pending-sequence.svelte";
  import HallOfShameGallery from "$lib/features/hall-of-shame/components/HallOfShameGallery.svelte";
  import { openSequenceViewer } from "../../../../shared/sequence-viewer/services/sequence-viewer-navigator";

  // Note: Library tab removed - now integrated into Sequences via scope toggle (Community / My Library)
  type BrowseModuleType = "gallery" | "collections" | "creators" | "hall-of-shame";

  // Tab order for determining slide direction (left-to-right in bottom nav)
  const TAB_ORDER: BrowseModuleType[] = ["gallery", "collections", "creators", "hall-of-shame"];

  // Transition configuration
  const SLIDE_DISTANCE = 30; // pixels
  const SLIDE_DURATION = 200; // ms

  // ============================================================================
  // STATE MANAGEMENT (Shared Coordination)
  // ============================================================================

  // `visible` is passed by ModuleRenderer's keep-alive host (browse stays mounted
  // across module switches; the host toggles display). Browse has no render loop
  // to pause — off-screen thumbnails already idle via their IntersectionObserver
  // when display:none — so this is accepted for prop hygiene / future use.
  const { visible = true }: { visible?: boolean } = $props();

  const engine = createBrowseEngine({
    persistKey: "tka-browse-gallery",
    initialSource: "community",
    sections: true,
    // No defaultSectionGroupBy: the left section index follows the active sort
    // (A–Z → letters, Level → difficulty, Date → dates, Length → lengths).
    allowSourceToggle: true,
    sources: ["community", "my-library"],
  });

  // Service resolved lazily in onMount to ensure feature module is loaded
  let eventHandlerService: BrowseEventHandler | null = null;

  // Offline cache: create reactive state, publish to context for descendants
  const orchestrator = getOfflineCacheOrchestrator();
  const offlineCacheState = createOfflineCacheState(orchestrator);
  setOfflineCacheContext(offlineCacheState);

  // ✅ PURE RUNES: Local state
  let _selectedSequence = $state<SequenceData | null>(null);
  let error = $state<string | null>(null);
  let activeTab = $state<BrowseModuleType>("gallery");
  // Gallery opens on the taxonomy-first "Start here" surface; "Browse all"
  // reveals the full GalleryTab. Stays on the chosen view while mounted.
  let galleryView = $state<"start-here" | "browse-all">("start-here");
  let showAnimator = $state<boolean>(false);
  let sequenceToAnimate = $state<SequenceData | null>(null);
  let isAnimationModalOpen = $state(false);

  function openAnimationModal(sequence: SequenceData) {
    sequenceToAnimate = sequence;
    isAnimationModalOpen = true;
  }

  function closeAnimationModal() {
    isAnimationModalOpen = false;
    sequenceToAnimate = null;
  }

  // Slide direction for tab transitions (1 = right, -1 = left)
  let slideDirection = $state<1 | -1>(1);
  let previousTab = $state<BrowseModuleType | null>(null);

  // Services
  let deviceDetector: DeviceDetector | null = null;

  // Reactive responsive settings from DeviceDetector
  let responsiveSettings = $state<ResponsiveSettings | null>(null);

  // ✅ PURE RUNES: Device detection for UI adaptation
  const isMobile = $derived(
    responsiveSettings?.isMobile || responsiveSettings?.isTablet || false
  );

  // Desktop sidebar visibility (to hide top section when sidebar is visible)
  const showDesktopSidebar = $derived(desktopSidebarState.isVisible);

  // ✅ Calculate drawer width for 60/40 split (grid gets 60%, detail panel gets 40% of remaining space)
  // Use actual sidebar width which reflects collapsed state (220px expanded, 64px collapsed, 0px hidden)
  const sidebarWidth = $derived(
    showDesktopSidebar ? desktopSidebarState.width : 0
  );
  // Keep drawer width constant to avoid flashing when opening/closing
  const drawerWidth = $derived(
    !isMobile
      ? `calc((100vw - ${sidebarWidth}px) * 0.4)` // Detail panel takes 40% of remaining space
      : "min(600px, 90vw)"
  );

  // ✅ SYNC WITH BOTTOM NAVIGATION STATE
  // This effect syncs the local tab state with the global navigation state
  $effect(() => {
    const navTab = navigationState.activeTab;
    let newTab: BrowseModuleType = "gallery";

    // Map navigation state to local browse tab
    // Note: "library" now redirects to "gallery" (Gallery) with scope toggle
    if (
      navTab === "gallery" ||
      navTab === "browse" ||
      navTab === "library"
    ) {
      newTab = "gallery";
    } else if (navTab === "collections") {
      newTab = "collections";
    } else if (navTab === "creators") {
      newTab = "creators";
    } else if (navTab === "hall-of-shame") {
      newTab = "hall-of-shame";
    }

    // Only push to history if this is a user-initiated tab change (not from history nav)
    if (newTab !== activeTab && !browseNavigationState.isNavigating) {
      // Map to the browse navigation tab format
      const browseTab =
        newTab === "gallery"
          ? "gallery"
          : (newTab as "collections" | "creators");
      browseNavigationState.navigateTo({ tab: browseTab, view: "list" });
    }

    // Calculate slide direction based on tab order
    if (previousTab !== null && newTab !== previousTab) {
      const oldIndex = TAB_ORDER.indexOf(previousTab);
      const newIndex = TAB_ORDER.indexOf(newTab);
      slideDirection = newIndex > oldIndex ? 1 : -1;
    }

    previousTab = activeTab;
    activeTab = newTab;
  });

  // Reset creators view state when leaving the creators tab
  $effect(() => {
    if (activeTab !== "creators") {
      creatorsViewState.reset();
    }
  });

  // Track when viewing a creator profile (push to history via unified state)
  // This handles the case when creatorsViewState is updated directly (legacy path)
  $effect(() => {
    if (
      creatorsViewState.currentView === "user-profile" &&
      creatorsViewState.viewingUserId &&
      !browseNavigationState.isNavigating
    ) {
      // Check if navigation state already shows this profile (avoid duplicate push)
      const current = browseNavigationState.currentLocation;
      if (
        current?.tab === "creators" &&
        current?.view === "profile" &&
        current?.contextId === creatorsViewState.viewingUserId
      ) {
        return; // Already at this location, don't push again
      }

      browseNavigationState.navigateTo({
        tab: "creators",
        view: "profile",
        contextId: creatorsViewState.viewingUserId,
      });
    }
  });

  // ✅ SYNC UI FROM NAVIGATION STATE
  // When browseNavigationState.currentLocation changes, update the UI accordingly
  // This handles the new unified navigation API (viewCreatorProfile, etc.)
  $effect(() => {
    const location = browseNavigationState.currentLocation;
    if (!location) return;

    // Map the location tab to internal activeTab
    const internalTab = location.tab === "gallery" ? "gallery" : location.tab;

    // Update tab if needed (this will trigger bottom nav sync)
    if (internalTab !== activeTab) {
      navigationState.setActiveTab(
        location.tab === "gallery" ? "gallery" : location.tab
      );
    }

    // Handle sub-view navigation for creators
    if (location.tab === "creators") {
      if (location.view === "profile" && location.contextId) {
        // Only update creatorsViewState if it doesn't match
        if (creatorsViewState.viewingUserId !== location.contextId) {
          creatorsViewState.viewUserProfile(location.contextId);
        }
      } else if (creatorsViewState.currentView !== "list") {
        creatorsViewState.reset();
      }
    }
  });

  /**
   * Handle navigation from history back/forward buttons
   */
  function handleHistoryNavigation(location: BrowseLocation) {
    // Map gallery tab back to sequences for internal state
    const internalTab = location.tab === "gallery" ? "gallery" : location.tab;

    // Navigate to the tab via global navigation state
    if (internalTab !== activeTab) {
      navigationState.setActiveTab(
        location.tab === "gallery" ? "gallery" : location.tab
      );
    }

    // Handle sub-view navigation
    if (location.tab === "creators") {
      if (location.view === "profile" && location.contextId) {
        creatorsViewState.viewUserProfile(location.contextId);
      } else {
        creatorsViewState.reset();
      }
    }

    // Handle gallery detail view
    if (
      location.tab === "gallery" &&
      location.view === "detail" &&
      location.contextId
    ) {
      // TODO: Re-open sequence detail panel with contextId
    }
  }

  // ✅ RELOAD LIBRARY ON IMPERSONATION CHANGE
  // When admin impersonates a different user, reload My Library data
  let lastEffectiveUserId = $state<string | null>(authState.effectiveUserId);
  $effect(() => {
    const currentEffectiveUserId = authState.effectiveUserId;
    const isInMyLibrary = engine.source === "my-library";

    // If user changed and we're viewing My Library, reload for the new user.
    // Clearing the cache ensures loadLibrarySequences fetches from Firestore
    // instead of returning the previous user's data.
    if (currentEffectiveUserId !== lastEffectiveUserId && isInMyLibrary) {
      engine.invalidateLibraryCache();
      void engine.refresh();
    }

    lastEffectiveUserId = currentEffectiveUserId;
  });

  // ✅ SYNC ANIMATION MODAL STATE
  $effect(() => {
    showAnimator = isAnimationModalOpen;
  });

  // ✅ SYNC CLOSE HANDLER
  $effect(() => {
    if (!showAnimator && isAnimationModalOpen) {
      closeAnimationModal();
    }
  });

  // ============================================================================
  // SCROLL BEHAVIOR (UI Visibility Control)
  // ============================================================================

  // Create scroll behavior service instance
  const scrollBehaviorService = new BrowseScrollBehavior(browseScrollState);

  // Reactive UI visibility state
  const isUIVisible = $derived(browseScrollState.isUIVisible);

  // Provide scroll visibility context for child components
  setContext("browserScrollVisibility", {
    getVisible: () => browseScrollState.isUIVisible,
    hide: () => scrollBehaviorService.forceHideUI(),
    show: () => scrollBehaviorService.forceShowUI(),
  });

  // Provide navigation context for back/forward buttons and cross-tab navigation
  setContext("browseNavigation", {
    onNavigate: handleHistoryNavigation,
    navigateToCreatorProfile: browseNavigationState.viewCreatorProfile,
    navigateToSequenceDetail: browseNavigationState.viewSequenceDetail,
    navigateToCollectionDetail: browseNavigationState.viewCollectionDetail,
    navigateToCreatorSequences: browseNavigationState.viewCreatorSequences,
  });

  // ============================================================================
  // LIFECYCLE (Coordination)
  // ============================================================================

  onMount(() => {
    // Start background caching of gallery metadata + thumbnails so the browse
    // module works offline on subsequent visits without any user action.
    offlineCacheState.startBackgroundCache();

    // On reconnect: clear PublicSequencesLoader's in-memory cache so the next
    // gallery load re-fetches from Firestore and repopulates the Dexie offline cache
    // with fresh data. This cast is intentional - adding clearCache() to PublicSequencesLoader
    // is a larger interface change deferred to a later task.
    const unsubscribeReconnect = networkStatusState.onOnline(() => {
      const loader = getBrowseLoader() as unknown as { cachedSequences?: unknown };
      if (loader) {
        loader.cachedSequences = null;
      }
    });

    // Check whether the URL contains a creator profile path (/browse/creators/[userId]).
    // If it does, override the localStorage-restored state and open that profile directly
    // so a page refresh lands on the same profile the user was viewing.
    const initialCreatorId = getCreatorIdFromURL();

    // Initialize navigation state (restores from localStorage if available)
    browseNavigationState.initialize("gallery");

    if (initialCreatorId) {
      // Override whatever localStorage had - the URL is the source of truth on load.
      browseNavigationState.viewCreatorProfile(initialCreatorId);
    }

    // Resolve event handler service from ITI container
    try {
      eventHandlerService = getBrowseEventHandler();

      // Initialize event handler service with required parameters
      eventHandlerService.initialize({
        engine,
        openAnimationModal,
        setSelectedSequence: (seq: SequenceData | null) => (_selectedSequence = seq),
        setError: (err: string | null) => (error = err),
      });

    } catch (err) {
      console.error(
        "BrowseModule: Failed to resolve BrowseEventHandler",
        err
      );
      error = "Failed to initialize browse module services";
    }

    // Initialize DeviceDetector service
    let cleanup: (() => void) | undefined;
    try {
      deviceDetector = getDeviceDetector();
      if (deviceDetector) {
        responsiveSettings = deviceDetector.getResponsiveSettings();

        // Store cleanup function from onCapabilitiesChanged
        cleanup = deviceDetector.onCapabilitiesChanged(() => {
          responsiveSettings = deviceDetector!.getResponsiveSettings();
        });
      }
    } catch (err) {
      console.warn("BrowseModule: Failed to resolve DeviceDetector", err);
    }

    // Load initial data (engine restores persisted source from localStorage).
    engine
      .initialize()
      .then(() => {
        // Check if we have a pending sequence to view (e.g., from inbox message)
        const pendingSequenceId = consumePendingSequenceView();
        if (pendingSequenceId) {
          const sequence = engine.sequences.find(
            (s) => s.id === pendingSequenceId
          );
          if (sequence) {
            openSequenceViewer(sequence, {
              returnPath: "/browse/gallery",
              returnLabel: "Browse",
            });
          } else {
            console.warn(
              "[BrowseModule] Pending sequence not found:",
              pendingSequenceId
            );
          }
        }
      })
      .catch((err) => {
        console.error("Data loading failed:", err);
        error =
          err instanceof Error
            ? err.message
            : "Failed to load gallery sequences";
      });

    // Listen for the browser's native Back/Forward within the creators sub-path.
    // When the user presses Back from /browse/creators/[userId], the URL changes
    // to /browse/creators. The navigation coordinator handles module/section, but
    // we need to also close the creator profile view.
    function handleCreatorPopState() {
      const creatorId = getCreatorIdFromURL();
      if (creatorId) {
        // Navigated forward to a creator profile (e.g., via browser Forward button)
        if (creatorsViewState.viewingUserId !== creatorId) {
          browseNavigationState.viewCreatorProfile(creatorId);
        }
      } else if (window.location.pathname.startsWith("/browse/creators")) {
        // Navigated back to the creators list
        if (creatorsViewState.currentView !== "list") {
          creatorsViewState.reset();
        }
      }
    }

    window.addEventListener("popstate", handleCreatorPopState);

    // Return cleanup function
    return () => {
      cleanup?.();
      unsubscribeReconnect();
      window.removeEventListener("popstate", handleCreatorPopState);
    };
  });

  // Cancel all pending thumbnail renders when leaving the browse module
  // This prevents the render queue from continuing to process after navigation
  onDestroy(() => {
    engine.destroy();
    try {
      const orchestrator = getThumbnailRenderOrchestrator();
      if (orchestrator) {
        orchestrator.cancelAll();
      }
    } catch {
      // Service may not be available during HMR or early unmount
    }
  });
</script>

<!-- Error banner -->
{#if error}
  <ErrorBanner
    message={error}
    onDismiss={() => eventHandlerService?.handleErrorDismiss()}
    onRetry={() => eventHandlerService?.handleRetry()}
  />
{/if}

<!-- Animation Sheet Coordinator -->
<AnimationSheetCoordinator
  sequence={sequenceToAnimate}
  bind:isOpen={showAnimator}
/>

<!-- Sequence Details Modal removed - BrowseEventHandler.handleViewDetail() navigates to /sequence/[id] route -->

<!-- Main layout - shows immediately with skeletons while data loads -->
<div class="browse-content">
  <!-- Tab Content - uses {#key} with directional slide transitions (like Learn module) -->
  <div class="browse-tab-content">
    {#key activeTab}
      <div
        class="tab-panel"
        in:fly={{
          x: slideDirection * SLIDE_DISTANCE,
          duration: SLIDE_DURATION,
          easing: cubicOut,
        }}
        out:fly={{
          x: -slideDirection * SLIDE_DISTANCE,
          duration: SLIDE_DURATION,
          easing: cubicOut,
        }}
      >
        {#if activeTab === "gallery"}
          {#if galleryView === "start-here"}
            <StartHere
              onBrowseAll={() => (galleryView = "browse-all")}
              pool={engine.sequences}
            />
          {:else}
            <div class="browse-all-wrap">
              <button
                type="button"
                class="back-to-start"
                onclick={() => (galleryView = "start-here")}
              >
                ← Start here
              </button>
              <div class="gallery-host">
                <GalleryTab
                  {isMobile}
                  {drawerWidth}
                  {engine}
                  {error}
                  onSequenceAction={(action, sequence, variations) => {
                    return eventHandlerService?.handleSequenceAction(action, sequence, variations) ??
                      Promise.resolve();
                  }}
                />
              </div>
            </div>
          {/if}
        {:else if activeTab === "collections"}
          <CollectionsBrowsePanel />
        {:else if activeTab === "creators"}
          {#if creatorsViewState.currentView === "user-profile" && creatorsViewState.viewingUserId}
            <UserProfilePanel userId={creatorsViewState.viewingUserId} />
          {:else}
            <CreatorsPanel />
          {/if}
        {:else if activeTab === "hall-of-shame"}
          <HallOfShameGallery />
        {/if}
      </div>
    {/key}
  </div>
</div>

<style>
  .browse-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .browse-tab-content {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .tab-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .browse-all-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .gallery-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .back-to-start {
    align-self: flex-start;
    margin: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.85rem;
    flex: 0 0 auto;
  }

  .back-to-start:hover {
    border-color: var(--theme-accent);
  }
</style>
