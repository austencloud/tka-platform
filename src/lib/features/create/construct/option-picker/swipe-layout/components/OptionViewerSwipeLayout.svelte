<!--
OptionViewerSwipeLayout.svelte - Horizontal swipe panel navigation

Displays option sections as swipeable panels using HorizontalSwipeContainer.
Each section becomes a full-width panel that users can swipe through.

Features:
- Horizontal panel swiping
- Panel position persistence in sessionStorage
- In-place pictograph transitions on option change
- Content area bounds for optimal sizing
-->

<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import type { OrganizedSection } from "../../domain/option-picker-types";
  import OptionPicker456Group from "./OptionViewer456Group.svelte";
  import OptionViewerSection from "./OptionViewerSection.svelte";

  // ===== Props =====
  const {
    organizedPictographs = [],
    onPictographSelected = () => {},
    onSectionChange = () => {},
    layoutConfig,
    currentSequence = [],
    onSlotClicked,
    getContinuationIndex,
  } = $props<{
    organizedPictographs?: OrganizedSection[];
    onPictographSelected?: (pictograph: PictographData) => void;
    onSectionChange?: (sectionIndex: number) => void;
    layoutConfig?: {
      optionsPerRow: number;
      pictographSize: number;
      spacing: number;
      containerWidth: number;
      containerHeight: number;
      gridColumns: string;
      gridGap: string;
    };
    currentSequence?: PictographData[];
    onSlotClicked?: (typeSection: string, slotIndex: number) => void;
    getContinuationIndex?: (sectionTitle: string) => number | null;
  }>();

  // ===== Panel Position Persistence =====
  const PANEL_STORAGE_KEY = "tka-option-picker-panel";

  // Load panel position from storage (non-reactive, only read once on initialization)
  function getInitialPanelIndex(): number {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(PANEL_STORAGE_KEY);
        const panelIndex = stored ? parseInt(stored, 10) : 0;
        return isNaN(panelIndex) ? 0 : Math.max(0, panelIndex);
      } catch {
        return 0;
      }
    }
    return 0;
  }

  const initialPanelIndex = getInitialPanelIndex();

  // ===== State =====
  let contentAreaBounds = $state<{
    left: number;
    right: number;
    width: number;
  } | null>(null);

  // Only render section content when bounds are ready to prevent size burst
  const boundsReady = $derived(() => {
    const ready = contentAreaBounds !== null && contentAreaBounds.width > 0;
    return ready;
  });

  // ===== Event Handlers =====
  function handlePanelChange(panelIndex: number) {
    // Save panel position to sessionStorage
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(PANEL_STORAGE_KEY, panelIndex.toString());
      } catch (error) {
        console.error(
          "❌ Failed to save panel position to sessionStorage:",
          error
        );
      }
    }

    // Notify parent of section change for header update
    onSectionChange(panelIndex);
  }

  function handleContentAreaChange(bounds: {
    left: number;
    right: number;
    width: number;
  }) {
    contentAreaBounds = bounds;
  }
</script>

<div class="swipe-layout">
  <HorizontalSwipeContainer
    showIndicators={false}
    {initialPanelIndex}
    onPanelChange={handlePanelChange}
    onContentAreaChange={handleContentAreaChange}
    freezeNavigation={false}
    loop={true}
    height="100%"
    width="100%"
    preservePosition={true}
    storageKey={PANEL_STORAGE_KEY}
  >
    {#each organizedPictographs as section, index (section.title)}
      <div
        class="panel"
        data-panel-index={index}
        data-section-type={section.type || "individual"}
      >
        <div class="option-viewer-body">
          <!-- Wait for bounds before rendering to prevent size burst on mobile -->
          {#if boundsReady()}
            {#if section.title === "Types 4-6" || section.type === "grouped"}
              <!-- Grouped section (Types 4-6) -->
              <OptionPicker456Group
                pictographs={section.pictographs}
                {onPictographSelected}
                containerWidth={contentAreaBounds?.width ||
                  layoutConfig?.containerWidth ||
                  800}
                containerHeight={layoutConfig?.containerHeight || 600}
                pictographSize={layoutConfig?.pictographSize || 144}
                gridGap={layoutConfig?.gridGap || "8px"}
                {currentSequence}
                {contentAreaBounds}
              />
            {:else}
              <!-- Individual section (Types 1-3) -->
              <OptionViewerSection
                letterType={section.title}
                pictographs={section.pictographs}
                {onPictographSelected}
                {layoutConfig}
                {currentSequence}
                {contentAreaBounds}
                showHeader={true}
                {onSlotClicked}
                continuationIndex={getContinuationIndex?.(section.title) ?? null}
              />
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </HorizontalSwipeContainer>
</div>

<style>
  .swipe-layout {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel {
    width: 100%;
    height: 100%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .option-viewer-body {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center; /* Center content vertically */
    /* Dynamic offset calculated per-panel based on actual header heights */
    /* Uses CSS custom property set by applyCentering action */
    /* Removed transition to prevent layout shifts during option changes */
  }
</style>
