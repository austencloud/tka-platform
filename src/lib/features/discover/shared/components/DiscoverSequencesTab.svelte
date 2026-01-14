<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import DiscoverLayout from "./DiscoverLayout.svelte";
  import SequenceDrawers from "./SequenceDrawers.svelte";
  import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
  import SequenceDisplayPanel from "../../sequences/display/components/SequenceDisplayPanel.svelte";

  interface Props {
    isMobile: boolean;
    isUIVisible: boolean;
    showDesktopSidebar: boolean;
    drawerWidth: string;
    galleryState: any;
    error: string | null;
    isAnimationPanelOpen?: boolean;
    onSequenceAction: (action: string, sequence: SequenceData) => Promise<void>;
    onDetailPanelAction: (
      action: string,
      sequence: SequenceData
    ) => Promise<void>;
    onCloseDetailPanel: () => void;
    onContainerScroll: (event: CustomEvent<{ scrollTop: number }>) => void;
  }

  let {
    isMobile,
    isUIVisible: _isUIVisible,
    showDesktopSidebar: _showDesktopSidebar,
    drawerWidth,
    galleryState,
    error,
    isAnimationPanelOpen = false,
    onSequenceAction,
    onDetailPanelAction,
    onCloseDetailPanel,
    onContainerScroll,
  }: Props = $props();

  // Panel is "open" when either the detail panel OR animation panel is showing (desktop only)
  const isPanelOpen = $derived(
    !isMobile && (sequencePanelManager.isOpen || isAnimationPanelOpen)
  );

  // Effective drawer width - accounts for expansion state
  // When detail panel is expanded, use wider width for grid padding
  const effectiveDrawerWidth = $derived(
    sequencePanelManager.isDetailExpanded ? "min(900px, 85vw)" : drawerWidth
  );
</script>

<DiscoverLayout>
  {#snippet centerPanel()}
    <div class="sequences-with-detail">
      <div
        class="sequences-main"
        class:panel-open={isPanelOpen}
        style:--drawer-width={effectiveDrawerWidth}
      >
        <SequenceDisplayPanel
          sequences={galleryState.displayedSequences}
          sections={galleryState.sequenceSections}
          isLoading={galleryState.isLoading}
          sectionsReady={galleryState.sectionsReady}
          {error}
          showSections={galleryState.showSections}
          source={galleryState.currentSource}
          onAction={onSequenceAction}
          onScroll={onContainerScroll}
        />
      </div>
    </div>
  {/snippet}
</DiscoverLayout>

<!-- Drawers -->
<SequenceDrawers
  {isMobile}
  {drawerWidth}
  isNavVisible={_isUIVisible}
  currentFilter={galleryState.currentFilter}
  currentSortMethod={galleryState.currentSortMethod}
  availableSections={galleryState.availableNavigationSections}
  loopTypeCounts={galleryState.loopTypeCounts}
  onFilterChange={galleryState.handleFilterChange}
  onSortMethodChange={(method) => galleryState.handleSortChange(method, "asc")}
  onSectionClick={(sectionId) => {
    galleryState.scrollToSection(sectionId);
    sequencePanelManager.close();
  }}
  {onDetailPanelAction}
  {onCloseDetailPanel}
/>

<style>
  /* Container for sequences grid + detail panel */
  .sequences-with-detail {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: 100%;
    transition: all 0.3s ease;
  }

  /* Main sequences area (grid) */
  .sequences-main {
    flex: 1;
    overflow-y: auto; /* Allow scrolling */
    overflow-x: hidden;
    min-width: 0; /* Allow flexbox shrinking */
    --drawer-width: min(
      600px,
      90vw
    ); /* Default width, overridden by inline style */
    /* Smooth transition for padding when panel expands/collapses */
    transition: padding-right 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Add padding when panel is open (desktop only) - simple, standard approach */
  .sequences-main.panel-open {
    padding-right: var(--drawer-width);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sequences-with-detail {
      transition: none;
    }

    .sequences-main {
      transition: none;
    }
  }
</style>
