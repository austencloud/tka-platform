<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import { onMount, setContext, untrack } from "svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ErrorBanner from "../../../create/shared/components/ErrorBanner.svelte";

  import type {
    IDiscoverEventHandler,
    DeleteConfirmationData,
  } from "../services/contracts/IDiscoverEventHandler";
  import CollectionsDiscoverPanel from "../../collections/components/CollectionsDiscoverPanel.svelte";
  import CreatorsPanel from "../../creators/components/CreatorsPanel.svelte";
  import UserProfilePanel from "../../creators/components/UserProfilePanel.svelte";
  import { creatorsViewState } from "../../creators/state/creators-view-state.svelte";
  import { createExploreState } from "../state/discover-state-factory.svelte";
  import DiscoverDeleteDialog from "./DiscoverDeleteDialog.svelte";
  import DiscoverSequencesTab from "./DiscoverSequencesTab.svelte";
  import { discoverScrollState } from "../state/DiscoverScrollState.svelte";
  import {
    discoverNavigationState,
    type DiscoverLocation,
  } from "../state/discover-navigation-state.svelte";
  import { DiscoverScrollBehavior } from "../services/implementations/DiscoverScrollBehavior";
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";
  import { sequenceControlsManager } from "../state/sequence-controls-state.svelte";
  import { sequenceSourceManager } from "../state/sequence-source-state.svelte";
  import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import AnimationSheetCoordinator from "../../../../shared/coordinators/AnimationSheetCoordinator.svelte";

  // Note: Library tab removed - now integrated into Sequences via scope toggle (Community / My Library)
  type DiscoverModuleType = "sequences" | "collections" | "creators";

  // ============================================================================
  // STATE MANAGEMENT (Shared Coordination)
  // ============================================================================

  const galleryState = createExploreState();

  // Service resolved lazily in onMount to ensure feature module is loaded
  let eventHandlerService: IDiscoverEventHandler | null = null;

  // ✅ PURE RUNES: Local state
  let _selectedSequence = $state<SequenceData | null>(null);
  let deleteConfirmationData = $state<DeleteConfirmationData | null>(null);
  let error = $state<string | null>(null);
  let activeTab = $state<DiscoverModuleType>("sequences");
  let showAnimator = $state<boolean>(false);

  // Services
  let deviceDetector: IDeviceDetector | null = null;

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
    let newTab: DiscoverModuleType = "sequences";

    // Map navigation state to local explore tab
    // Note: "library" now redirects to "sequences" (Gallery) with scope toggle
    if (
      navTab === "sequences" ||
      navTab === "discover" ||
      navTab === "gallery" ||
      navTab === "library"
    ) {
      newTab = "sequences";
    } else if (navTab === "collections") {
      newTab = "collections";
    } else if (navTab === "creators") {
      newTab = "creators";
    }

    // Only push to history if this is a user-initiated tab change (not from history nav)
    if (newTab !== activeTab && !discoverNavigationState.isNavigating) {
      // Map to the discover navigation tab format
      const discoverTab =
        newTab === "sequences"
          ? "gallery"
          : (newTab as "collections" | "creators");
      discoverNavigationState.navigateTo({ tab: discoverTab, view: "list" });
    }

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
      !discoverNavigationState.isNavigating
    ) {
      // Check if navigation state already shows this profile (avoid duplicate push)
      const current = discoverNavigationState.currentLocation;
      if (
        current?.tab === "creators" &&
        current?.view === "profile" &&
        current?.contextId === creatorsViewState.viewingUserId
      ) {
        return; // Already at this location, don't push again
      }

      discoverNavigationState.navigateTo({
        tab: "creators",
        view: "profile",
        contextId: creatorsViewState.viewingUserId,
      });
    }
  });

  // ✅ SYNC UI FROM NAVIGATION STATE
  // When discoverNavigationState.currentLocation changes, update the UI accordingly
  // This handles the new unified navigation API (viewCreatorProfile, etc.)
  $effect(() => {
    const location = discoverNavigationState.currentLocation;
    if (!location) return;

    // Map the location tab to internal activeTab
    const internalTab = location.tab === "gallery" ? "sequences" : location.tab;

    // Update tab if needed (this will trigger bottom nav sync)
    if (internalTab !== activeTab) {
      navigationState.setActiveTab(
        location.tab === "gallery" ? "sequences" : location.tab
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
  function handleHistoryNavigation(location: DiscoverLocation) {
    // Map gallery tab back to sequences for internal state
    const internalTab = location.tab === "gallery" ? "sequences" : location.tab;

    // Navigate to the tab via global navigation state
    if (internalTab !== activeTab) {
      navigationState.setActiveTab(
        location.tab === "gallery" ? "sequences" : location.tab
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

  // ✅ SYNC GALLERY SOURCE STATE
  // Wire sequenceSourceManager changes to galleryState.setSource()
  $effect(() => {
    const currentSource = sequenceSourceManager.current;
    // Sync source to galleryState (handles data loading)
    if (currentSource !== galleryState.currentSource) {
      galleryState.setSource(currentSource);
    }
  });

  // ✅ RELOAD LIBRARY ON IMPERSONATION CHANGE
  // When admin impersonates a different user, reload My Library data
  let lastEffectiveUserId = $state<string | null>(authState.effectiveUserId);
  $effect(() => {
    const currentEffectiveUserId = authState.effectiveUserId;
    const isInMyLibrary = sequenceSourceManager.current === "my-library";

    // If user changed and we're viewing My Library, force reload
    if (currentEffectiveUserId !== lastEffectiveUserId && isInMyLibrary) {
      // Force reload by temporarily clearing and re-setting
      galleryState.loadLibrarySequences();
    }

    lastEffectiveUserId = currentEffectiveUserId;
  });

  // ✅ SYNC ANIMATION MODAL STATE
  // This effect syncs the local showAnimator state with galleryState
  $effect(() => {
    showAnimator = galleryState.isAnimationModalOpen;
  });

  // ✅ SYNC CLOSE HANDLER
  // When showAnimator is closed, inform galleryState
  $effect(() => {
    if (!showAnimator && galleryState.isAnimationModalOpen) {
      galleryState.closeAnimationModal();
    }
  });

  // ============================================================================
  // SCROLL BEHAVIOR (UI Visibility Control)
  // ============================================================================

  // Create scroll behavior service instance
  const scrollBehaviorService = new DiscoverScrollBehavior(discoverScrollState);

  // Track last scroll position for the container
  let lastContainerScrollTop = $state(0);

  // Reactive UI visibility state
  const isUIVisible = $derived(discoverScrollState.isUIVisible);

  // Provide scroll visibility context for child components
  setContext("explorerScrollVisibility", {
    getVisible: () => discoverScrollState.isUIVisible,
    hide: () => scrollBehaviorService.forceHideUI(),
    show: () => scrollBehaviorService.forceShowUI(),
  });

  // Provide navigation context for back/forward buttons and cross-tab navigation
  setContext("discoverNavigation", {
    onNavigate: handleHistoryNavigation,
    navigateToCreatorProfile: discoverNavigationState.viewCreatorProfile,
    navigateToSequenceDetail: discoverNavigationState.viewSequenceDetail,
    navigateToCollectionDetail: discoverNavigationState.viewCollectionDetail,
    navigateToCreatorSequences: discoverNavigationState.viewCreatorSequences,
  });

  // Provide gallery state for TopBar controls via global reactive state
  // (Context doesn't work for siblings, so we use module-level $state)
  $effect(() => {
    sequenceControlsManager.set({
      get currentFilter() {
        return galleryState.currentFilter;
      },
      get currentSortMethod() {
        return galleryState.currentSortMethod;
      },
      get availableNavigationSections() {
        return galleryState.availableNavigationSections;
      },
      onFilterChange: (filter) =>
        galleryState.handleFilterChange(filter.type, filter.value),
      onSortMethodChange: (method: string) =>
        galleryState.handleSortChange(method as any, "asc"),
      scrollToSection: galleryState.scrollToSection,
      openFilterModal: () => galleryState.openFilterModal(),
    });
  });

  // Handle scroll events from the scrollable container
  function handleContainerScroll(event: CustomEvent<{ scrollTop: number }>) {
    const { scrollTop } = event.detail;
    scrollBehaviorService.handleContainerScroll(
      scrollTop,
      lastContainerScrollTop
    );
    lastContainerScrollTop = scrollTop;
  }

  // ============================================================================
  // LIFECYCLE (Coordination)
  // ============================================================================

  onMount(() => {
    // Initialize navigation state (restores from localStorage if available)
    discoverNavigationState.initialize("gallery");

    // Resolve event handler service (feature module should be loaded by now)
    try {
      eventHandlerService = resolve<IDiscoverEventHandler>(
        TYPES.IDiscoverEventHandler
      );

      // Initialize event handler service with required parameters
      eventHandlerService.initialize({
        galleryState,
        setSelectedSequence: (seq: SequenceData | null) =>
          (_selectedSequence = seq),
        setDeleteConfirmationData: (data: DeleteConfirmationData | null) =>
          (deleteConfirmationData = data),
        setError: (err: string | null) => (error = err),
      });
    } catch (err) {
      console.error(
        "DiscoverModule: Failed to resolve IDiscoverEventHandler",
        err
      );
      error = "Failed to initialize discover module services";
    }

    // Initialize DeviceDetector service
    let cleanup: (() => void) | undefined;
    try {
      deviceDetector = resolve<IDeviceDetector>(TYPES.IDeviceDetector);
      responsiveSettings = deviceDetector.getResponsiveSettings();

      // Store cleanup function from onCapabilitiesChanged
      cleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
    } catch (err) {
      console.warn("DiscoverModule: Failed to resolve DeviceDetector", err);
    }

    // Load initial data through gallery state (non-blocking)
    // UI shows immediately with skeletons while data loads
    galleryState
      .loadAllSequences()
      .then(() => {
        // console.log("✅ DiscoverModule: Data loaded");
      })
      .catch((err) => {
        console.error("Data loading failed:", err);
        error =
          err instanceof Error
            ? err.message
            : "Failed to load gallery sequences";
      });

    // Return cleanup function
    return () => {
      cleanup?.();
      sequenceControlsManager.clear();
    };
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

<!-- Delete confirmation dialog -->
{#if deleteConfirmationData}
  <DiscoverDeleteDialog
    show={true}
    confirmationData={deleteConfirmationData}
    onConfirm={() =>
      eventHandlerService?.handleDeleteConfirm(deleteConfirmationData)}
    onCancel={() => eventHandlerService?.handleDeleteCancel()}
  />
{/if}

<!-- Animation Sheet Coordinator -->
<AnimationSheetCoordinator
  sequence={galleryState.sequenceToAnimate}
  bind:isOpen={showAnimator}
/>

<!-- Main layout - shows immediately with skeletons while data loads -->
<div class="explore-content">
  <!-- Tab Content - Bottom navigation controls the active tab -->
  <!-- Note: We keep all tabs mounted but hidden to preserve state and avoid refetching -->
  <div class="explore-tab-content">
    <div class="tab-panel" class:hidden={activeTab !== "sequences"}>
      <DiscoverSequencesTab
        {isMobile}
        {isUIVisible}
        {showDesktopSidebar}
        {drawerWidth}
        {galleryState}
        {error}
        isAnimationPanelOpen={showAnimator}
        onSequenceAction={(action, sequence) =>
          eventHandlerService?.handleSequenceAction(action, sequence) ??
          Promise.resolve()}
        onDetailPanelAction={(action, sequence) =>
          eventHandlerService?.handleDetailPanelAction(action, sequence) ??
          Promise.resolve()}
        onCloseDetailPanel={() => eventHandlerService?.handleCloseDetailPanel()}
        onContainerScroll={handleContainerScroll}
      />
    </div>
    <div class="tab-panel" class:hidden={activeTab !== "collections"}>
      <CollectionsDiscoverPanel />
    </div>
    <div class="tab-panel" class:hidden={activeTab !== "creators"}>
      {#if creatorsViewState.currentView === "user-profile" && creatorsViewState.viewingUserId}
        <UserProfilePanel userId={creatorsViewState.viewingUserId} />
      {:else}
        <CreatorsPanel />
      {/if}
    </div>
  </div>
</div>

<style>
  .explore-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .explore-tab-content {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .tab-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-panel.hidden {
    visibility: hidden;
    pointer-events: none;
  }
</style>
