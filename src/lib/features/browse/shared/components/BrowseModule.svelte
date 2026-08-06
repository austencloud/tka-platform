<script lang="ts">
  import { getOfflineCacheOrchestrator } from "$lib/shared/offline/get-offline-cache-orchestrator";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { DeviceDetector } from "$lib/shared/device/services/device-detector";
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
  import MyCollectionsPanel from "../../collections/components/MyCollectionsPanel.svelte";
  import CommunityCollectionsPanel from "../../collections/components/CommunityCollectionsPanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import GalleryTab from "./GalleryTab.svelte";
  import SmartCollectionSaveDialog from "$lib/features/library/components/SmartCollectionSaveDialog.svelte";
  import GalleryDrill from "$lib/features/browse/gallery-home/GalleryDrill.svelte";
  import { loadCanonicalTnDSequences } from "$lib/features/browse/gallery-home/canonical-tnd-pool";
  import { browseScrollState } from "$lib/shared/browse/state/browse-scroll-state.svelte";
  import {
    browseNavigationState,
    getCollectionScanTargetFromURL,
    type BrowseLocation,
  } from "$lib/shared/browse/state/browse-navigation-state.svelte";
  import { setPendingScanIntent } from "$lib/features/browse/state/pending-scan-intent.svelte";
  import { replaceState as svelteKitReplaceState } from "$app/navigation";
  import { BrowseScrollBehavior } from "../services/browse-scroll-behavior";
  import { desktopSidebarState } from "$lib/shared/layout/desktop-sidebar-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import AnimationSheetCoordinator from "../../../../shared/coordinators/AnimationSheetCoordinator.svelte";
  import { consumePendingSequenceView } from "../../state/pending-sequence.svelte";
  import {
    peekPendingBrowseIntent,
    clearPendingBrowseIntent,
  } from "../../state/pending-browse-intent.svelte";
  import HallOfShameGallery from "$lib/features/hall-of-shame/components/HallOfShameGallery.svelte";
  import { openSequenceViewer } from "../../../../shared/sequence-viewer/services/sequence-viewer-navigator";
  import {
    getGalleryViewState,
    setGalleryViewState,
  } from "../services/gallery-view-persister";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
  import { communityCollectionsState } from "$lib/features/browse/collections/state/community-collections-state.svelte";
  import { createSharedCollectionsState } from "$lib/features/browse/collections/state/shared-collections-state.svelte";
  import { setSharedCollectionsContext } from "$lib/features/browse/collections/context/shared-collections-context";
  import { getCollectionCollaborationManager } from "$lib/shared/library/get-collection-collaboration-manager";
  import type { CollectionOption } from "$lib/features/browse/gallery-home/gallery-drill-catalog.svelte";
  import FilterRuleStrip from "$lib/shared/browse/components/FilterRuleStrip.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { withResultsMorph } from "$lib/shared/transitions/results-morph";

  // Tab ids match tab labels (renamed 2026-07-10): "library" is your saved
  // work (label Library, was id "collections"); "collections" is community
  // collection discovery (label Collections, was id "discover"). Legacy URLs
  // (/browse/discover, /browse/collections/{id} scan links) and persisted nav
  // state migrate in navigation-coordinator.svelte.ts and
  // browse-navigation-state.svelte.ts.
  type BrowseModuleType =
    | "gallery"
    | "library"
    | "collections"
    | "hall-of-shame";

  // Tab order for determining slide direction (left-to-right in bottom nav)
  const TAB_ORDER: BrowseModuleType[] = [
    "gallery",
    "library",
    "collections",
    "hall-of-shame",
  ];

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
    // Gallery is pure discovery — your saved work lives in Library
    // (Collections module: the All shelf). A previously persisted
    // "my-library" source sanitizes back to community in the engine.
    sources: ["community"],
    // The canonical T&D alphabet joins the community pool as normal sequences:
    // one card per word ("AAAA" displays simplified as "A"), 49 turn combos as
    // its variations in the standard picker. Same citizenship as saved work.
    extraCommunitySequences: loadCanonicalTnDSequences,
  });

  // Restore where this SESSION was (sessionStorage — survives reload/HMR,
  // dies with the tab). Mid-browse: re-apply the search. The drill is now a
  // filter WORKSPACE with a rule strip, so persisted filters are visible and
  // editable there — restoring them no longer strands invisible state (the
  // old failure that forced a clear). Search stays transient.
  const restoredGalleryView = getGalleryViewState();
  if (restoredGalleryView?.view === "browse-all") {
    engine.setSearch(restoredGalleryView.search);
  } else {
    engine.setSearch("");
  }

  // Service resolved lazily in onMount to ensure feature module is loaded
  let eventHandlerService: BrowseEventHandler | null = null;

  // Offline cache: create reactive state, publish to context for descendants
  const orchestrator = getOfflineCacheOrchestrator();
  const offlineCacheState = createOfflineCacheState(orchestrator);
  setOfflineCacheContext(offlineCacheState);

  const sharedCollectionsState = createSharedCollectionsState(
    getCollectionCollaborationManager()
  );
  setSharedCollectionsContext(sharedCollectionsState);

  $effect(() => {
    sharedCollectionsState.start(authState.user?.uid ?? null);
  });

  // ✅ PURE RUNES: Local state
  let _selectedSequence = $state<SequenceData | null>(null);
  let error = $state<string | null>(null);
  let activeTab = $state<BrowseModuleType>("gallery");
  // Gallery opens on the drill front door (GalleryDrill); any pick or
  // "Browse all" reveals the full GalleryTab. Stays on the chosen view
  // while mounted, and this session's view survives reload/HMR.
  let galleryView = $state<"start-here" | "browse-all">(
    restoredGalleryView?.view ?? "start-here"
  );

  // Record view + search whenever they change so a reload/HMR remount
  // restores this exact spot (filters restore via the engine's own persist).
  $effect(() => {
    setGalleryViewState({ view: galleryView, search: engine.searchQuery });
  });

  // Instant tap feel. A drill pick used to apply the filter AND mount the grid
  // in the same task, so the filter/sort/section compute (~250ms on the prod
  // pool) blocked the first paint — a dead beat where nothing changed on tap.
  // Instead: flip to the grid + paint its skeleton THIS frame, then run the
  // mutation (the expensive compute) a frame later, behind the skeleton. The
  // layout changes the instant you tap; cards fill in a beat afterward.
  let gridWarming = $state(false);
  let smartSaveOpen = $state(false);

  // --- Filter workspace (the drill in builder mode) ---
  // Same wiring the Smart Collection builder uses: toggle-in-place, stable
  // option sets, Match any/all connectives, and the shared rule strip.
  type WorkspaceSection =
    | "level"
    | "length"
    | "letter"
    | "position"
    | "gridmode"
    | "author"
    | "loop"
    | "family"
    | "max_turn_intensity";
  const SECTION_FOR_FILTER_TYPE: Partial<Record<string, WorkspaceSection>> = {
    [BrowseFilterType.DIFFICULTY]: "level",
    [BrowseFilterType.LENGTH]: "length",
    [BrowseFilterType.STARTING_LETTER]: "letter",
    [BrowseFilterType.STARTING_POSITION]: "position",
    [BrowseFilterType.GRID_MODE]: "gridmode",
    [BrowseFilterType.OWNER]: "author",
    [BrowseFilterType.LOOP_TYPE]: "loop",
    [BrowseFilterType.TND_FAMILY]: "family",
    [BrowseFilterType.MAX_TURN_INTENSITY]: "max_turn_intensity",
    [BrowseFilterType.COLLECTION]: "collection",
  };

  // Collections are a FILTER in the gallery, not a door out of it: the tile
  // opens a value editor and picking one stacks an "In: <name>" rule. The
  // Library tab stays the management home (create, edit membership, share).
  const collectionOptions = $derived.by(() => {
    const seen = new Set<string>();
    const out: CollectionOption[] = [];
    const push = (
      c: {
        id: string;
        name: string;
        sequenceCount?: number;
        sequenceIds?: readonly string[];
        coverImageUrl?: string;
        color?: string;
        icon?: string;
        ownerId?: string;
        systemType?: string;
        kind?: string;
      },
      ownerName?: string
    ) => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      out.push({
        id: c.id,
        name: c.name,
        size: c.sequenceCount ?? c.sequenceIds?.length ?? 0,
        coverImageUrl: c.coverImageUrl,
        color: c.color,
        icon: c.icon,
        ownerName,
        ownerId: c.ownerId,
        canShare: !ownerName && !c.systemType && c.kind !== "smart",
      });
    };
    for (const c of collectionsState.collections) push(c);
    for (const c of communityCollectionsState.items)
      push(c.collection, c.ownerName);
    return out.sort((a, b) => b.size - a.size);
  });
  // Remount seed: editing a strip chip reopens the drill ON that filter's
  // editor instead of the chooser.
  let drillSeed = $state<{ section?: WorkspaceSection }>({});

  const loopKeyByValue = $derived(
    new Map(
      [...engine.activeFilters]
        .filter(([, f]) => f.type === BrowseFilterType.LOOP_TYPE && !f.locked)
        .map(([key, f]) => [String(f.value), key])
    )
  );
  const activeLoopValues = $derived(new Set(loopKeyByValue.keys()));
  const familyKeyByValue = $derived(
    new Map(
      [...engine.activeFilters]
        .filter(([, f]) => f.type === BrowseFilterType.TND_FAMILY && !f.locked)
        .map(([key, f]) => [String(f.value), key])
    )
  );
  const activeFamilyValues = $derived(new Set(familyKeyByValue.keys()));
  // Which category each active rule belongs to, so the split pane's catalog
  // tiles can carry a count dot.
  const ruleCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const f of engine.activeFilters.values()) {
      if (f.locked) continue;
      const key = SECTION_FOR_FILTER_TYPE[String(f.type)];
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    // The Collections tile's catalog key is plural; its section is singular.
    if (counts["collection"]) counts["collections"] = counts["collection"];
    return counts;
  });
  // True while the drill is rendering results live beside the filters. The
  // pinned strip and "View N results" belong to the step-through flow only;
  // with the grid on screen they are noise (and a second, contradicting count).
  let splitPaneActive = $state(false);
  // Wide enough for live results even while the editorial landing is up. "Show
  // all" reads this to decide between opening the pane and ejecting to the grid.
  let splitCapable = $state(false);
  // Bound into the drill: opens its pane on the full live grid with no active
  // category (the destination "Show all" / "View N results" used to eject to).
  let showAllPane = $state(false);
  const appliedValueKeys = $derived(
    new Set(
      [...engine.activeFilters.values()]
        .filter((f) => !f.locked)
        .map((f) => `${f.type}:${String(f.value)}`)
    )
  );
  function applyToGrid(mutate: () => void) {
    galleryView = "browse-all";
    gridWarming = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        mutate();
        gridWarming = false;
      })
    );
  }
  // A handoff from another module — today the profile's Archive doorway, which
  // displays a count above its button and so must land on the pool that count
  // was read from. Consumed in an effect rather than onMount because Browse is
  // keep-alive: it mounts once and every later handoff would be dropped.
  //
  // Deferred a frame in both branches. The tab-sync effect below writes its own
  // `navigateTo({ view: "list" })` when the active tab changes, and effect order
  // between the two is not guaranteed — running after the frame settles means
  // the intent always wins rather than usually winning.
  $effect(() => {
    const intent = peekPendingBrowseIntent();
    if (!intent) return;
    clearPendingBrowseIntent();

    if (intent.kind === "creator-gallery") {
      const name = intent.ownerName;
      requestAnimationFrame(() => {
        // Browse restores its own last location from localStorage, and the
        // effect that mirrors it into the active tab will happily pull the
        // Library tab back over a gallery handoff. Say where we are in that
        // vocabulary too, so both sources of truth agree.
        browseNavigationState.navigateTo({ tab: "gallery", view: "list" });
        // Exactly what the drill's own creator row applies
        // (GalleryDrill.svelte), so the destination is the familiar filtered
        // grid rather than a second thing that means the same.
        applyToGrid(() => {
          engine.clearUserFilters();
          engine.setSearch("");
          engine.addFilter(BrowseFilterType.OWNER, name, name, "#6aa0ff");
        });
      });
    } else if (intent.kind === "art-shelf") {
      const { shelfId, label } = intent;
      requestAnimationFrame(() =>
        browseNavigationState.viewCollectionDetail(shelfId, label)
      );
    } else {
      requestAnimationFrame(() =>
        browseNavigationState.viewCollectionDetail("all", "All")
      );
    }
  });

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

    // Map navigation state to local browse tab. Ids match labels since
    // 2026-07-10: "library" = Library panel, "collections" = community
    // Collections panel.
    if (navTab === "gallery" || navTab === "browse") {
      newTab = "gallery";
    } else if (navTab === "library") {
      newTab = "library";
    } else if (navTab === "collections" || navTab === "community") {
      // "community" was the transient 2026-07-10 id between the two renames;
      // accept it defensively (stale history/persisted state).
      newTab = "collections";
    } else if (navTab === "hall-of-shame") {
      newTab = "hall-of-shame";
    }

    // Only push to history if this is a user-initiated tab change (not from history nav)
    if (newTab !== activeTab && !browseNavigationState.isNavigating) {
      // Map to the browse navigation tab format
      const browseTab =
        newTab === "gallery"
          ? "gallery"
          : (newTab as "library" | "collections");
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

  // ✅ SYNC UI FROM NAVIGATION STATE
  // When browseNavigationState.currentLocation changes, mirror the active tab
  // (gallery / library / collections). Creators now lives in Social.
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
    navigateToSequenceDetail: browseNavigationState.viewSequenceDetail,
    navigateToCollectionDetail: browseNavigationState.viewCollectionDetail,
    navigateToCreatorSequences: browseNavigationState.viewCreatorSequences,
  });

  // ============================================================================
  // LIFECYCLE (Coordination)
  // ============================================================================

  onMount(() => {
    // The gallery's Collections filter needs the live collection lists; both
    // stores are session singletons that no-op on a repeat call.
    collectionsState.ensureStarted();
    void communityCollectionsState.ensureLoaded();

    // Start background caching of gallery metadata + thumbnails so the browse
    // module works offline on subsequent visits without any user action.
    offlineCacheState.startBackgroundCache();

    // On reconnect: clear PublicSequencesLoader's in-memory cache so the next
    // gallery load re-fetches from Firestore and repopulates the Dexie offline cache
    // with fresh data. This cast is intentional - adding clearCache() to PublicSequencesLoader
    // is a larger interface change deferred to a later task.
    const unsubscribeReconnect = networkStatusState.onOnline(() => {
      const loader = getBrowseLoader() as unknown as {
        cachedSequences?: unknown;
      };
      if (loader) {
        loader.cachedSequences = null;
      }
    });

    // Collection deep links (/browse/library/[id]?scan=1) —
    // this is the URL a phone lands on after scanning the desktop scan sheet's
    // handoff QR. The scan flag asks the detail view to open the scanner
    // immediately, so the phone goes from QR scan to camera in one hop.
    const scanTarget = getCollectionScanTargetFromURL();

    // Initialize navigation state (restores from localStorage if available)
    browseNavigationState.initialize("gallery");

    if (scanTarget) {
      // The URL is the source of truth on load — override localStorage.
      browseNavigationState.viewCollectionDetail(scanTarget.collectionId);
      if (scanTarget.scan) {
        setPendingScanIntent(scanTarget.collectionId);
        // Consume the flag from the URL too: a refresh should show the
        // collection, not relaunch the scanner.
        const url = new URL(window.location.href);
        url.searchParams.delete("scan");
        svelteKitReplaceState(url.toString(), {});
      }
    }

    // Resolve event handler service from ITI container
    try {
      eventHandlerService = getBrowseEventHandler();

      // Initialize event handler service with required parameters
      eventHandlerService.initialize({
        engine,
        openAnimationModal,
        setSelectedSequence: (seq: SequenceData | null) =>
          (_selectedSequence = seq),
        setError: (err: string | null) => (error = err),
      });
    } catch (err) {
      console.error("BrowseModule: Failed to resolve BrowseEventHandler", err);
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

    // Return cleanup function
    return () => {
      cleanup?.();
      unsubscribeReconnect();
    };
  });

  onDestroy(() => {
    sharedCollectionsState.stop();
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

<!-- The gallery workspace's right-hand column: the rule as a header, the live
     grid underneath. Both are the SHARED components the step-through flow and
     the grid tab already use — never a copy. -->
{#snippet resultsHeader()}
  <span class="strip-count" aria-live="polite">
    {engine.resultCount}
    {engine.resultCount === 1 ? "match" : "matches"}
  </span>
  {#if engine.hasActiveFilters}
    <FilterRuleStrip
      filters={engine.allFilterChips.filter((c) => !c.locked)}
      connectives={engine.connectives}
      onEditFilter={(type) =>
        (drillSeed = { section: SECTION_FOR_FILTER_TYPE[type] })}
      onRemoveFilter={(key) => withResultsMorph(() => engine.removeFilter(key))}
    />
  {:else}
    <span class="strip-empty">No filters yet — pick one on the left.</span>
  {/if}
  <div class="strip-actions">
    <PanelButton
      variant="secondary"
      ariaLabel="Save these filters as a Smart Collection"
      onclick={() => (smartSaveOpen = true)}
    >
      <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      Save
    </PanelButton>
  </div>
{/snippet}

{#snippet resultsPane()}
  <!-- The toolbar keeps its own search: the gallery's page-top search bar is
       gone (2026-08-05), so THIS is the search, and it narrows the live grid in
       place instead of ejecting to the full-page tab. -->
  <BrowsePanel
    {engine}
    layout="compact"
    showFilterBar={false}
    hideFilterChips
    onSelect={(sequence, variations) =>
      eventHandlerService?.handleSequenceAction(
        "view-detail",
        sequence,
        variations
      )}
  />
{/snippet}

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

<SmartCollectionSaveDialog {engine} bind:show={smartSaveOpen} />

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
            <div class="gallery-workspace">
              {#if engine.hasActiveFilters && !splitPaneActive}
                <div class="gallery-rule-strip" aria-label="Current filters">
                  <span class="strip-count" aria-live="polite">
                    {engine.resultCount}
                    {engine.resultCount === 1 ? "match" : "matches"}
                  </span>
                  <FilterRuleStrip
                    filters={engine.allFilterChips.filter((c) => !c.locked)}
                    connectives={engine.connectives}
                    onEditFilter={(type) =>
                      (drillSeed = { section: SECTION_FOR_FILTER_TYPE[type] })}
                    onRemoveFilter={(key) =>
                      withResultsMorph(() => engine.removeFilter(key))}
                  />
                  <div class="strip-actions">
                    <PanelButton
                      variant="primary"
                      onclick={() => {
                        // Above the seam this opens the workspace's own live
                        // pane; the gallery never hands a desktop user to the
                        // "Start here" screen. Below it, today's grid tab.
                        if (splitCapable) showAllPane = true;
                        else applyToGrid(() => {});
                      }}
                    >
                      View {engine.resultCount} results
                    </PanelButton>
                    <PanelButton
                      variant="secondary"
                      ariaLabel="Save these filters as a Smart Collection"
                      onclick={() => (smartSaveOpen = true)}
                    >
                      <i class="fas fa-wand-magic-sparkles" aria-hidden="true"
                      ></i>
                      Save
                    </PanelButton>
                  </div>
                </div>
              {/if}
              {#key drillSeed}
                <GalleryDrill
                  pool={engine.allSequences}
                  adaptiveValueLayout
                  persistentDesktopCatalog
                  fluidWideCanvas
                  initialSection={drillSeed.section}
                  getCount={(type, value) =>
                    engine.getFilteredCount(type, value)}
                  isValueApplied={(type, value) =>
                    appliedValueKeys.has(`${type}:${String(value)}`)}
                  onApply={(type, value, label, color) =>
                    engine.addFilter(type, value, label, color ?? "#6aa0ff")}
                  onToggleValue={(type, value, label, color, nowActive) => {
                    // The workspace never bounces: values toggle in place and
                    // the strip + counts recompose live. The grid is reached
                    // via "View results" / search / show-all.
                    if (nowActive) {
                      engine.addFilter(type, value, label, color ?? "#6aa0ff");
                    } else {
                      // Stacking categories (LOOPs, T&D, and the OR-stacking
                      // set) key per value; single-valued ones key by bare type
                      // because re-adding replaces. Removing the wrong key is a
                      // SILENT no-op, so remove whichever one the engine holds.
                      const perValue = `${type}:${String(value)}`;
                      engine.removeFilter(
                        engine.activeFilters.has(perValue)
                          ? perValue
                          : String(type)
                      );
                    }
                  }}
                  {activeLoopValues}
                  loopConnective={engine.connectives[
                    String(BrowseFilterType.LOOP_TYPE)
                  ] ?? "any"}
                  onLoopConnectiveChange={(connective) =>
                    engine.setConnective(
                      BrowseFilterType.LOOP_TYPE,
                      connective
                    )}
                  onToggleLoop={(value, label, color, nowActive) => {
                    if (nowActive) {
                      engine.addFilter(
                        BrowseFilterType.LOOP_TYPE,
                        value,
                        label,
                        color
                      );
                    } else {
                      const key = loopKeyByValue.get(value);
                      if (key) engine.removeFilter(key);
                    }
                  }}
                  {activeFamilyValues}
                  familyConnective={engine.connectives[
                    String(BrowseFilterType.TND_FAMILY)
                  ] ?? "any"}
                  onFamilyConnectiveChange={(connective) =>
                    engine.setConnective(
                      BrowseFilterType.TND_FAMILY,
                      connective
                    )}
                  onToggleFamily={(familyId, label, color, nowActive) => {
                    if (nowActive) {
                      engine.addFilter(
                        BrowseFilterType.TND_FAMILY,
                        familyId,
                        label,
                        color
                      );
                    } else {
                      const key = familyKeyByValue.get(familyId);
                      if (key) engine.removeFilter(key);
                    }
                  }}
                  onShowAll={() => {
                    // Above the seam the drill opens its own pane on the full
                    // live grid; the gallery's own flows never land on the
                    // "Start here" screen at desktop widths. Below it, today's
                    // hand-off to the full-page grid.
                    if (splitCapable) engine.clearUserFilters();
                    else applyToGrid(() => engine.clearUserFilters());
                  }}
                  {ruleCounts}
                  collections={collectionOptions}
                  onSplitPaneChange={(active) => (splitPaneActive = active)}
                  onSplitCapableChange={(capable) => (splitCapable = capable)}
                  bind:showAllPane
                  {resultsHeader}
                  {resultsPane}
                />
              {/key}
            </div>
          {:else}
            <GalleryTab
              {isMobile}
              {drawerWidth}
              {engine}
              {error}
              warming={gridWarming}
              onSequenceAction={(action, sequence, variations) => {
                return (
                  eventHandlerService?.handleSequenceAction(
                    action,
                    sequence,
                    variations
                  ) ?? Promise.resolve()
                );
              }}
              onBackToStart={() => {
                // Back to the WORKSPACE, rule intact — the strip shows and
                // edits it there. Only transient search resets.
                engine.setSearch("");
                galleryView = "start-here";
              }}
              onOpenWorkspace={() => {
                engine.setSearch("");
                galleryView = "start-here";
              }}
              onSaveSmart={() => (smartSaveOpen = true)}
            />
          {/if}
        {:else if activeTab === "library"}
          <MyCollectionsPanel />
        {:else if activeTab === "collections"}
          <CommunityCollectionsPanel />
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

  .gallery-workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* The pinned rule strip: count, grouped sentence, actions on one wrapping
     row. The drill below keeps the remaining height. */
  .gallery-rule-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    padding: 0.55rem 1rem;
    flex: 0 0 auto;
    border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
  }

  .strip-count {
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .strip-empty {
    font-size: 0.8rem;
    color: var(--theme-text-muted, #9aa6b8);
  }

  .strip-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
    flex: 0 0 auto;
  }
</style>
