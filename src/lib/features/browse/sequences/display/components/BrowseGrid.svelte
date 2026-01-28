<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { slide } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";
  // NOTE: animate-css-grid disabled - causes layout chaos with async thumbnail loading
  // import { wrapGrid } from "animate-css-grid";
  import type { IBrowseThumbnailProvider } from "../services/contracts/IBrowseThumbnailProvider";
  import type { IVariationGrouper } from "../services/contracts/IVariationGrouper";
  import ChoreoCard from "./ChoreoCard/ChoreoCard.svelte";
  import SectionHeader from "./SectionHeader.svelte";
  import VirtualizedSequenceGrid from "./VirtualizedSequenceGrid.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "../utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { container } from "$lib/shared/di";

  /**
   * 🚀 PERFORMANCE: Virtualization threshold
   * Lists with more than this many items use virtual scrolling
   * to avoid rendering 100+ DOM nodes at once.
   * Below this threshold, we use animate-css-grid for smooth FLIP animations.
   */
  const VIRTUALIZATION_THRESHOLD = 50;

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sequences = [],
    sections = [],
    viewMode = "grid",
    thumbnailService,
    showSections = false,
    onAction = () => {},
    pinchColumnOverride,
    isTransitioning = false,
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceData[];
    viewMode?: "grid" | "list";
    thumbnailService: IBrowseThumbnailProvider | null;
    showSections?: boolean;
    onAction?: (action: string, sequence: SequenceData) => void;
    /** Pinch-to-zoom column override (2-6). Active on any touch device. */
    pinchColumnOverride?: number;
    /** True for ~200ms after column change (for CSS transition timing) */
    isTransitioning?: boolean;
  }>();

  // Determine if we should use virtualization
  // Only virtualize flat grids (not sections) with many items
  const useVirtualization = $derived(
    !showSections &&
      sequences.length > VIRTUALIZATION_THRESHOLD &&
      viewMode === "grid"
  );

  // Variation grouper service for identifying sequences with same word
  const variationGrouper = container.items.variationGrouper;

  // Build variation map when sequences change
  const variationMap = $derived.by(() => {
    return variationGrouper.buildVariationMap(sequences);
  });

  // Get variations for a specific sequence
  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const word = sequence.word || sequence.name;
    if (!word) return [sequence];
    return variationMap.get(word.trim()) ?? [sequence];
  }

  // Get user's prop settings for prop-aware thumbnails
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  // Determine if we're in cat-dog mode (different props per hand)
  const isCatDog = $derived(
    isCatDogMode(
      propSettings.bluePropType,
      propSettings.redPropType,
      propSettings.catDogMode
    )
  );

  // Get light mode from visibility state (inverse of darkMode)
  // darkMode= true means dark mode, lightMode = true means light background
  const visibilityManager = getAnimationVisibilityManager();

  // Use $state to track lightMode so UI updates when it changes
  let lightMode = $state(!visibilityManager.isDarkMode());

  // Register observer to react to visibility changes (like "L" key toggle)
  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);

  onDestroy(() => {
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Grid element refs for animate-css-grid
  let sectionGridRefs = $state<HTMLElement[]>([]);
  let flatGridRef = $state<HTMLElement | undefined>(undefined);

  // Track container width to control column count
  let containerWidth = $state(0);

  const columnCount = $derived.by(() => {
    // When zoom override is active (pinch on touch OR Shift+scroll on desktop), use it
    if (pinchColumnOverride !== undefined) {
      return pinchColumnOverride;
    }

    // Responsive column counts based on container width
    if (containerWidth === 0) return 2; // Default
    if (containerWidth >= 1600) return 5;
    if (containerWidth >= 1200) return 4;
    if (containerWidth >= 800) return 3;
    if (containerWidth >= 481) return 2;
    return 2; // minimum
  });

  // Initialize ResizeObserver for responsive column count
  onMount(() => {
    // ResizeObserver to track container width changes
    const targetElement = flatGridRef || sectionGridRefs[0];
    const resizeObserver = targetElement
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const newWidth = entry.contentRect.width;
            if (newWidth > 0) {
              containerWidth = newWidth;
            }
          }
        })
      : null;

    if (targetElement && resizeObserver) {
      resizeObserver.observe(targetElement);

      // Initial width measurement
      requestAnimationFrame(() => {
        const width = targetElement.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      });
    }

    // Re-measure on window resize
    const handleResize = () => {
      if (targetElement) {
        const width = targetElement.getBoundingClientRect().width;
        if (width > 0) {
          containerWidth = width;
        }
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  });

  // Handle sequence actions (pass variations for view-detail)
  function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    // Pass variations as third argument for view-detail action
    if (action === "view-detail" && variations) {
      (onAction as (action: string, sequence: SequenceData, variations?: SequenceData[]) => void)(
        action,
        sequence,
        variations
      );
    } else {
      onAction(action, sequence);
    }
  }

</script>

{#if useVirtualization}
  <!-- 🚀 VIRTUALIZED: Large flat list with 50+ items -->
  <VirtualizedSequenceGrid {sequences} {thumbnailService} {onAction} />
{:else if showSections && sections.length > 0}
  <!-- Section-based organization (desktop app style) -->
  <div class="sections-container">
    {#each sections as section, sectionIndex (section.id)}
      <div class="sequence-section" data-section={section.title}>
        <SectionHeader title={section.title} />

        {#if section.sequences.length > 0}
          <div
            bind:this={sectionGridRefs[sectionIndex]}
            class="sequences-grid"
            class:list-view={viewMode === "list"}
            class:grid-view={viewMode === "grid"}
            class:is-transitioning={isTransitioning}
            style:grid-template-columns={viewMode === "grid"
              ? `repeat(${columnCount}, 1fr)`
              : undefined}
          >
            {#each section.sequences as sequence (sequence.id)}
              {@const seqVariations = getVariationsForSequence(sequence)}
              <ChoreoCard
                {sequence}
                variations={seqVariations}
                onPrimaryAction={(seq) =>
                  handleSequenceAction("view-detail", seq, seqVariations)}
                bluePropType={propSettings.bluePropType}
                redPropType={propSettings.redPropType}
                catDogModeEnabled={isCatDog}
                {lightMode}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else if sequences.length > 0}
  <!-- Flat organization (fallback) -->
  <div
    bind:this={flatGridRef}
    class="sequences-grid"
    class:list-view={viewMode === "list"}
    class:grid-view={viewMode === "grid"}
    class:is-transitioning={isTransitioning}
    style:grid-template-columns={viewMode === "grid"
      ? `repeat(${columnCount}, 1fr)`
      : undefined}
    transition:slide={{ duration: 300 }}
  >
    {#each sequences as sequence (sequence.id)}
      {@const seqVariations = getVariationsForSequence(sequence)}
      <ChoreoCard
        {sequence}
        variations={seqVariations}
        onPrimaryAction={(seq) =>
          handleSequenceAction("view-detail", seq, seqVariations)}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={isCatDog}
        {lightMode}
      />
    {/each}
  </div>
{/if}

<style>
  /* Sections container for organized display */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .sequence-section {
    display: flex;
    flex-direction: column;
  }

  /* Responsive grid that adapts to container width */
  /* Column count controlled via JavaScript for pinch-to-zoom support */
  .sequences-grid.grid-view {
    display: grid;
    /* grid-template-columns set via inline style */
    gap: var(--spacing-sm); /* Compact gap - pictures are the focus */
    /* Let cards determine their own height via aspect-ratio */
    align-items: start;
  }

  /* Smooth gap transition when columns change (iOS Photos style) */
  .sequences-grid.grid-view.is-transitioning {
    transition: gap 200ms ease-out;
  }

  .sequences-grid.list-view {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
  }
</style>
