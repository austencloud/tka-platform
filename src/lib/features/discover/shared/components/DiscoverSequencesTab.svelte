<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import DiscoverLayout from "./DiscoverLayout.svelte";
  import SequenceDrawers from "./SequenceDrawers.svelte";
  import { galleryPanelManager } from "../state/gallery-panel-state.svelte";
  import SequenceDisplayPanel from "../../gallery/display/components/SequenceDisplayPanel.svelte";

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
    !isMobile && (galleryPanelManager.isOpen || isAnimationPanelOpen)
  );
</script>

<DiscoverLayout>
  {#snippet centerPanel()}
    <div class="sequences-with-detail">
      <div
        class="sequences-main"
        class:panel-open={isPanelOpen}
        style:--drawer-width={drawerWidth}
      >
        <SequenceDisplayPanel
          sequences={galleryState.displayedSequences}
          sections={galleryState.sequenceSections}
          isLoading={galleryState.isLoading}
          {error}
          showSections={galleryState.showSections}
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
    galleryPanelManager.close();
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
    /* No transition on padding - let animate-css-grid handle the smoothness */
  }

  /* Add padding when panel is open (desktop only) - simple, standard approach */
  .sequences-main.panel-open {
    padding-right: var(--drawer-width);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sequences-with-detail,
    .sequences-main {
      transition: none;
    }
  }
</style>
