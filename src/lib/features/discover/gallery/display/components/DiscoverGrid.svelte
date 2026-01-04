<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { slide } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";
  // NOTE: animate-css-grid disabled - causes layout chaos with async thumbnail loading
  // import { wrapGrid } from "animate-css-grid";
  import type { IDiscoverThumbnailProvider } from "../services/contracts/IDiscoverThumbnailProvider";
  import SequenceCard from "./SequenceCard/SequenceCard.svelte";
  import SectionHeader from "./SectionHeader.svelte";
  import VirtualizedSequenceGrid from "./VirtualizedSequenceGrid.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "../services/implementations/DiscoverThumbnailCache";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

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
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceData[];
    viewMode?: "grid" | "list";
    thumbnailService: IDiscoverThumbnailProvider | null;
    showSections?: boolean;
    onAction?: (action: string, sequence: SequenceData) => void;
  }>();

  // Determine if we should use virtualization
  // Only virtualize flat grids (not sections) with many items
  const useVirtualization = $derived(
    !showSections &&
      sequences.length > VIRTUALIZATION_THRESHOLD &&
      viewMode === "grid"
  );

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
    if (containerWidth === 0) return 2; // Default
    if (containerWidth >= 1600) return 6;
    if (containerWidth >= 1200) return 5;
    if (containerWidth >= 800) return 4;
    if (containerWidth >= 481) return 3;
    return 2;
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

  // Handle sequence actions
  function handleSequenceAction(action: string, sequence: SequenceData) {
    onAction(action, sequence);
  }

  function getCoverUrl(sequence: SequenceData) {
    if (!thumbnailService) return undefined;

    // Cat-dog mode: Return null, PropAwareThumbnail will handle lazy rendering
    if (isCatDog) {
      return undefined;
    }

    try {
      // Single-prop mode: Use prop-specific pre-rendered images
      const sequenceName = sequence.word || sequence.name;
      const propType = propSettings.bluePropType || propSettings.redPropType;

      if (sequenceName && propType) {
        // Use prop-specific thumbnail path: /gallery/{propType}/{sequence}_{mode}.webp
        return thumbnailService.getPropSpecificThumbnailUrl(
          sequenceName,
          propType,
          false // dark mode
        );
      }

      // Fallback to legacy thumbnail path
      const firstThumbnail = sequence?.thumbnails?.[0];
      if (!firstThumbnail) return undefined;
      return thumbnailService.getThumbnailUrl(sequence.id, firstThumbnail);
    } catch (error) {
      console.warn(
        "DiscoverGrid: Failed to resolve thumbnail for sequence",
        sequence.id,
        error
      );
      return undefined;
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
            style:grid-template-columns={viewMode === "grid"
              ? `repeat(${columnCount}, 1fr)`
              : undefined}
          >
            {#each section.sequences as sequence}
              <SequenceCard
                {sequence}
                coverUrl={getCoverUrl(sequence)}
                onPrimaryAction={(sequence) =>
                  handleSequenceAction("view-detail", sequence)}
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
    style:grid-template-columns={viewMode === "grid"
      ? `repeat(${columnCount}, 1fr)`
      : undefined}
    transition:slide={{ duration: 300 }}
  >
    {#each sequences as sequence}
      <SequenceCard
        {sequence}
        coverUrl={getCoverUrl(sequence)}
        onPrimaryAction={(sequence) =>
          handleSequenceAction("view-detail", sequence)}
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
    gap: var(--spacing-lg);
  }

  .sequence-section {
    display: flex;
    flex-direction: column;
  }

  /* Responsive grid that adapts to container width */
  /* animate-css-grid handles smooth FLIP transitions when columns change */
  /* Column count is controlled via JavaScript with debounced ResizeObserver */
  .sequences-grid.grid-view {
    display: grid;
    /* grid-template-columns set via inline style based on debounced container width */
    gap: var(--spacing-lg);
    /* Let cards determine their own height via aspect-ratio - no row-based sizing */
    align-items: start;
  }

  .sequences-grid.list-view {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  /* Responsive gap adjustments */
  @container (max-width: 480px) {
    .sequences-grid.grid-view {
      gap: 8px;
    }
  }

  @container (min-width: 481px) and (max-width: 1199px) {
    .sequences-grid.grid-view {
      gap: var(--spacing-md);
    }
  }
</style>
