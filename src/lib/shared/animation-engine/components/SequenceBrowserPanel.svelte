<!--
  SequenceBrowserPanel.svelte - Sequence Selection Panel

  A slide-in panel for selecting sequences to animate.
  Reuses Discover module's sequence grid/display logic.

  Props:
  - mode: Which sequence slot we're filling (primary, secondary, grid-0, etc.)
  - onSelect: Callback when sequence is selected
  - onClose: Callback to close the panel
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";

  import { onMount } from "svelte";
  import type { IExploreLoader } from "$lib/features/explore/sequences/display/services/contracts/IExploreLoader";
  import type { IExploreThumbnailProvider } from "$lib/features/explore/sequences/display/services/contracts/IExploreThumbnailProvider";
  import type { ISequenceNormalizer } from "$lib/features/compose/services/contracts/ISequenceNormalizer";
  import type { IExploreSorter } from "$lib/features/explore/sequences/display/services/contracts/IExploreSorter";
  import { ExploreSortMethod } from "$lib/features/explore/shared/domain/enums/explore-enums";
  import SequenceCard from "$lib/features/explore/sequences/display/components/SequenceCard/SequenceCard.svelte";

  // Sort options for dropdown
  const sortOptions = [
    { id: ExploreSortMethod.ALPHABETICAL, label: "A-Z", icon: "fa-font" },
    { id: ExploreSortMethod.DIFFICULTY_LEVEL, label: "Difficulty", icon: "fa-signal" },
    { id: ExploreSortMethod.DATE_ADDED, label: "Recent", icon: "fa-clock" },
    { id: ExploreSortMethod.SEQUENCE_LENGTH, label: "Length", icon: "fa-ruler" },
  ];

  // Props
  let {
    mode = "primary",
    show = false,
    onSelect = (sequence: SequenceData) => {},
    onClose = () => {},
    requiredStepCount = undefined,
    placement = undefined,
    displayMode = "auto",
  }: {
    mode: "primary" | "secondary" | "grid-0" | "grid-1" | "grid-2" | "grid-3";
    show?: boolean;
    onSelect?: (sequence: SequenceData) => void;
    onClose?: () => void;
    requiredStepCount?: number | undefined;
    placement?: "bottom" | "right" | "left" | "top" | undefined;
    /** Display mode: "auto" = modal on desktop, drawer on mobile; "modal" = always modal; "drawer" = always drawer */
    displayMode?: "auto" | "modal" | "drawer";
  } = $props();

  // Determine effective display mode based on viewport
  let windowWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1024);
  const effectiveDisplayMode = $derived(
    displayMode === "auto"
      ? windowWidth >= 768 ? "modal" : "drawer"
      : displayMode
  );

  $effect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      windowWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Services - resolved lazily after module is loaded
  let loaderService = $state<IExploreLoader | null>(null);
  let thumbnailService = $state<IExploreThumbnailProvider | null>(null);
  let normalizationService = $state<ISequenceNormalizer | null>(null);
  let sorterService = $state<IExploreSorter | null>(null);
  let servicesReady = $state(false);

  // Auto-detect placement based on screen size if not provided
  let drawerPlacement = $state<"bottom" | "right" | "left" | "top">("right");

  $effect(() => {
    if (placement) {
      drawerPlacement = placement;
      return;
    } else {
      // Default behavior: bottom on mobile, right on desktop
      drawerPlacement = window.innerWidth < 768 ? "bottom" : "right";

      const handleResize = () => {
        if (!placement) {
          drawerPlacement = window.innerWidth < 768 ? "bottom" : "right";
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  });

  // State
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");

  // Sort state
  let currentSort = $state<ExploreSortMethod>(ExploreSortMethod.ALPHABETICAL);
  let showSortDropdown = $state(false);

  // Column count control (2-5 columns, persisted to localStorage)
  const STORAGE_KEY_COLUMNS = "sequence-browser-columns";
  const MIN_COLUMNS = 2;
  const MAX_COLUMNS = 5;

  // Get default columns based on screen width
  function getDefaultColumns(): number {
    if (typeof window === "undefined") return 3;
    const width = window.innerWidth;
    if (width >= 1600) return 5;
    if (width >= 1200) return 4;
    if (width >= 900) return 3;
    return 2;
  }

  // Load columns from localStorage or use screen-based default
  function loadColumns(): number {
    if (typeof window === "undefined") return 3;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= MIN_COLUMNS && parsed <= MAX_COLUMNS) return parsed;
      }
    } catch {
      // Ignore localStorage errors
    }
    return getDefaultColumns();
  }

  let columnCount = $state(loadColumns());

  // Save column count to localStorage when it changes
  function setColumnCount(count: number) {
    const clamped = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, count));
    if (clamped !== columnCount) {
      columnCount = clamped;
      try {
        localStorage.setItem(STORAGE_KEY_COLUMNS, String(clamped));
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  const canZoomIn = $derived(columnCount < MAX_COLUMNS);
  const canZoomOut = $derived(columnCount > MIN_COLUMNS);

  let gridContainerEl: HTMLDivElement | null = $state(null);

  // Filtered sequences based on search and beat count
  const filteredSequences = $derived.by(() => {
    let filtered = sequences;

    // Filter by beat count if required (use normalized steps, excluding start position)
    if (requiredStepCount !== undefined && normalizationService) {
      const service = normalizationService; // capture for closure
      filtered = filtered.filter((seq) => {
        const normalized = service.separateStepsFromStartPosition(seq);
        return normalized.steps.length === requiredStepCount;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (seq) =>
          seq.word?.toLowerCase().includes(query) ||
          seq.name?.toLowerCase().includes(query) ||
          seq.author?.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  // Sorted and grouped sequences with length sub-groups for alphabetical sort
  const sortedSections = $derived.by(() => {
    if (!sorterService || filteredSequences.length === 0) {
      return [{ key: "All", sequences: filteredSequences, lengthGroups: null }];
    }

    // Sort first
    const sorted = sorterService.sortSequences(filteredSequences, currentSort);

    // Group into sections
    const grouped = sorterService.groupSequencesIntoSections(sorted, currentSort);

    // Convert to array format for rendering
    // For alphabetical sort, also create length sub-groups within each section
    return Object.entries(grouped).map(([key, seqs]) => {
      if (currentSort === ExploreSortMethod.ALPHABETICAL && seqs.length > 1) {
        // Group by length within this letter section
        const byLength: Record<number, SequenceData[]> = {};
        for (const seq of seqs) {
          const len = seq.sequenceLength ?? 0;
          if (!byLength[len]) byLength[len] = [];
          byLength[len].push(seq);
        }
        // Convert to sorted array of length groups
        const lengthGroups = Object.entries(byLength)
          .map(([len, sequences]) => ({ length: parseInt(len), sequences }))
          .sort((a, b) => a.length - b.length);

        return { key, sequences: seqs, lengthGroups };
      }
      return { key, sequences: seqs, lengthGroups: null };
    });
  });

  // Get current sort label
  const currentSortLabel = $derived(
    sortOptions.find((o) => o.id === currentSort)?.label ?? "Sort"
  );

  // Handle sort change
  function handleSortChange(method: ExploreSortMethod) {
    currentSort = method;
    showSortDropdown = false;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".sort-dropdown-wrapper")) {
      showSortDropdown = false;
    }
  }

  // Initialize services from container
  function initializeServices() {
    try {
      // With ITI, all containers are already composed - no need for async module loading
      loaderService = container.items.exploreLoader ?? null;
      thumbnailService = container.items.exploreThumbnailProvider ?? null;
      sorterService = container.items.exploreSorter ?? null;
      // Note: ISequenceNormalizer may not be in the container yet - check build container
      normalizationService = (container.items as any).sequenceNormalizer ?? null;

      servicesReady = !!(loaderService && thumbnailService);

      if (!servicesReady) {
        console.warn(
          "⚠️ SequenceBrowserPanel: Some services failed to resolve",
          { loaderService: !!loaderService, thumbnailService: !!thumbnailService }
        );
      }
    } catch (err) {
      console.error(
        "❌ SequenceBrowserPanel: Failed to initialize services:",
        err
      );
      error = "Failed to initialize services";
    }
  }

  // Load sequences
  async function loadSequences() {
    if (!loaderService) {
      error = "Loader service not available";
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      error = null;

      const loaded = await loaderService.loadSequenceMetadata();
      sequences = loaded;
    } catch (err) {
      console.error("❌ SequenceBrowserPanel: Failed to load sequences:", err);
      error = err instanceof Error ? err.message : "Failed to load sequences";
    } finally {
      isLoading = false;
    }
  }

  // Get cover URL for a sequence
  function getCoverUrl(sequence: SequenceData): string | undefined {
    if (!thumbnailService) return undefined;

    // Get the first thumbnail from the sequence's thumbnails array
    const firstThumbnail = sequence.thumbnails?.[0];
    if (!firstThumbnail) return undefined;
    try {
      return thumbnailService.getThumbnailUrl(sequence.id, firstThumbnail);
    } catch (error) {
      return undefined;
    }
  }

  // State for loading selection
  let isSelectingSequence = $state(false);

  // Handle sequence selection - load full data before passing to parent
  async function handleSelect(sequence: SequenceData) {
    if (!loaderService) {
      onSelect(sequence);
      onClose();
      return;
    }

    try {
      isSelectingSequence = true;

      // Load full sequence data including steps
      const fullSequence = await loaderService.loadFullSequenceData(
        sequence.word || sequence.name || sequence.id
      );

      if (fullSequence) {
        onSelect(fullSequence);
      } else {
        // Fallback to basic sequence if full load fails
        console.warn(
          `⚠️ Could not load full data for ${sequence.word}, using metadata`
        );
        onSelect(sequence);
      }
      onClose();
    } catch (err) {
      console.error("❌ Failed to load full sequence data:", err);
      // Fallback to basic sequence
      onSelect(sequence);
      onClose();
    } finally {
      isSelectingSequence = false;
    }
  }

  // Load on mount - initialize services first, then load sequences
  onMount(() => {
    initializeServices();
    if (servicesReady) {
      loadSequences();
    }
  });

  // Mode label
  const modeLabel = $derived.by(() => {
    switch (mode) {
      case "primary":
        return "Primary Sequence";
      case "secondary":
        return "Secondary Sequence";
      case "grid-0":
        return "Grid Position 1 (Top-Left)";
      case "grid-1":
        return "Grid Position 2 (Top-Right)";
      case "grid-2":
        return "Grid Position 3 (Bottom-Left)";
      case "grid-3":
        return "Grid Position 4 (Bottom-Right)";
      default:
        return "Select Sequence";
    }
  });

  // Beat count filter message
  const beatCountMessage = $derived(
    requiredStepCount !== undefined
      ? `Showing only ${requiredStepCount}-beat sequences`
      : null
  );

  // Shift+scroll to resize thumbnails
  function handleWheel(e: WheelEvent) {
    if (!e.shiftKey) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? -10 : 10;
    thumbnailSize = Math.max(MIN_THUMB_SIZE, Math.min(MAX_THUMB_SIZE, thumbnailSize + delta));
  }

  // Pinch to zoom (touch)
  let lastPinchDistance = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      lastPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length !== 2) return;

    const currentDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );

    if (lastPinchDistance > 0) {
      const delta = (currentDistance - lastPinchDistance) * 0.5;
      thumbnailSize = Math.max(MIN_THUMB_SIZE, Math.min(MAX_THUMB_SIZE, thumbnailSize + delta));
    }

    lastPinchDistance = currentDistance;
  }

  function handleTouchEnd() {
    lastPinchDistance = 0;
  }

  // Attach wheel listener to grid container
  $effect(() => {
    if (!gridContainerEl) return;

    gridContainerEl.addEventListener("wheel", handleWheel, { passive: false });
    gridContainerEl.addEventListener("touchstart", handleTouchStart, { passive: true });
    gridContainerEl.addEventListener("touchmove", handleTouchMove, { passive: true });
    gridContainerEl.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      gridContainerEl?.removeEventListener("wheel", handleWheel);
      gridContainerEl?.removeEventListener("touchstart", handleTouchStart);
      gridContainerEl?.removeEventListener("touchmove", handleTouchMove);
      gridContainerEl?.removeEventListener("touchend", handleTouchEnd);
    };
  });
</script>

{#snippet browserContent()}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="browser-content"
    class:modal-mode={effectiveDisplayMode === "modal"}
    onclick={handleClickOutside}
  >
    <!-- Sticky header area -->
    <div class="sticky-header">
      <!-- Top row: Sort dropdown, Title, Close button -->
      <div class="browser-header">
        <!-- Sort dropdown (left) -->
        <div class="sort-dropdown-wrapper">
          <button
            class="sort-trigger"
            onclick={(e) => {
              e.stopPropagation();
              showSortDropdown = !showSortDropdown;
            }}
            aria-haspopup="listbox"
            aria-expanded={showSortDropdown}
          >
            <i class="fas fa-sort-amount-down" aria-hidden="true"></i>
            <span>{currentSortLabel}</span>
            <i class="fas fa-chevron-down dropdown-arrow" class:open={showSortDropdown} aria-hidden="true"></i>
          </button>

          {#if showSortDropdown}
            <div class="sort-dropdown" role="listbox">
              {#each sortOptions as option}
                <button
                  class="sort-option"
                  class:active={currentSort === option.id}
                  onclick={(e) => {
                    e.stopPropagation();
                    handleSortChange(option.id);
                  }}
                  role="option"
                  aria-selected={currentSort === option.id}
                >
                  <i class="fas {option.icon}" aria-hidden="true"></i>
                  <span>{option.label}</span>
                  {#if currentSort === option.id}
                    <i class="fas fa-check check-icon" aria-hidden="true"></i>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Title (center) -->
        <h2 id="sequence-browser-title">{modeLabel}</h2>

        <!-- Close button (right) -->
        <button class="close-button" onclick={onClose} aria-label="Close">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Second row: Search + Zoom controls -->
      <div class="controls-row">
        <!-- Search Bar -->
        <div class="search-wrapper">
          <i class="fas fa-search search-icon" aria-hidden="true"></i>
          <input
            type="text"
            class="search-input"
            placeholder="Search sequences..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button
              class="clear-search"
              onclick={() => (searchQuery = "")}
              aria-label="Clear search"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          {/if}
        </div>

        <!-- Zoom Controls (column count) -->
        <div class="zoom-controls">
          <button
            class="zoom-button"
            onclick={() => setColumnCount(columnCount - 1)}
            disabled={!canZoomOut}
            type="button"
            aria-label="Fewer columns (larger cards)"
            title="Larger cards"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="zoom-indicator">{columnCount}</span>
          <button
            class="zoom-button"
            onclick={() => setColumnCount(columnCount + 1)}
            disabled={!canZoomIn}
            type="button"
            aria-label="More columns (smaller cards)"
            title="Smaller cards"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- Beat Count Filter Info -->
      {#if beatCountMessage}
        <div class="filter-info">
          <i class="fas fa-filter" aria-hidden="true"></i>
          <span>{beatCountMessage}</span>
        </div>
      {/if}
    </div>

    <!-- Loading overlay when selecting sequence -->
    {#if isSelectingSequence}
      <div class="selecting-overlay" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading sequence...</p>
      </div>
    {/if}

    <!-- Sequence Grid -->
    <div
      class="sequence-grid-container"
      class:disabled={isSelectingSequence}
      bind:this={gridContainerEl}
    >
      {#if isLoading}
        <div class="loading-state" role="status" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <p>Loading sequences...</p>
        </div>
      {:else if error}
        <div class="error-state" role="alert" aria-live="assertive">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <p>{error}</p>
          <button onclick={loadSequences}>Retry</button>
        </div>
      {:else if filteredSequences.length === 0}
        <div class="empty-state" role="status" aria-live="polite">
          <i class="fas fa-search" aria-hidden="true"></i>
          <p>No sequences found</p>
        </div>
      {:else}
        <!-- Sectioned grid -->
        <div class="sections-container" style:--grid-columns={columnCount}>
          {#each sortedSections as section (section.key)}
            {#if sortedSections.length > 1}
              <div class="section-header">
                <span class="section-title">{section.key}</span>
                <span class="section-count">{section.sequences.length}</span>
              </div>
            {/if}

            {#if section.lengthGroups}
              <!-- Alphabetical with length sub-groups -->
              {#each section.lengthGroups as lengthGroup (lengthGroup.length)}
                <div class="length-group">
                  <div class="length-label">{lengthGroup.length} beats</div>
                  <div
                    class="sequence-grid"
                    class:modal-grid={effectiveDisplayMode === "modal"}
                  >
                    {#each lengthGroup.sequences as sequence (sequence.id)}
                      {@const coverUrl = getCoverUrl(sequence)}
                      <SequenceCard
                        {sequence}
                        {...coverUrl && { coverUrl }}
                        onPrimaryAction={handleSelect}
                      />
                    {/each}
                  </div>
                </div>
              {/each}
            {:else}
              <!-- No length sub-groups -->
              <div
                class="sequence-grid"
                class:modal-grid={effectiveDisplayMode === "modal"}
              >
                {#each section.sequences as sequence (sequence.id)}
                  {@const coverUrl = getCoverUrl(sequence)}
                  <SequenceCard
                    {sequence}
                    {...coverUrl && { coverUrl }}
                    onPrimaryAction={handleSelect}
                  />
                {/each}
              </div>
            {/if}
          {/each}
        </div>

        <!-- Zoom hint -->
        <div class="zoom-hint">
          <i class="fas fa-search-plus" aria-hidden="true"></i>
          <span>Shift + scroll to resize</span>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<!-- Modal mode (desktop) -->
{#if effectiveDisplayMode === "modal"}
  <BaseModal
    open={show}
    onclose={() => onClose()}
    size="xl"
    class="sequence-browser-modal"
    labelledBy="sequence-browser-title"
  >
    {@render browserContent()}
  </BaseModal>
{:else}
  <!-- Drawer mode (mobile) -->
  <Drawer
    isOpen={show}
    onclose={onClose}
    placement={drawerPlacement}
    class="sequence-browser-panel"
    labelledBy="sequence-browser-title"
  >
    {@render browserContent()}
  </Drawer>
{/if}

<style>
  /* Glass morphism styling for sequence browser */
  :global(.drawer-content.sequence-browser-panel) {
    max-width: 500px;
    --sheet-bg: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.25),
      rgba(0, 0, 0, 0.4)
    );
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.25),
      rgba(0, 0, 0, 0.4)
    ) !important;
    backdrop-filter: blur(24px) !important;
    -webkit-backdrop-filter: blur(24px) !important;
  }

  .browser-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Sticky Header Area */
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    flex-shrink: 0;
  }

  /* Header */
  .browser-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--theme-card-bg);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
    min-height: 56px;
  }

  .browser-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    text-align: center;
  }

  .close-button {
    position: absolute;
    top: 50%;
    right: var(--spacing-lg);
    transform: translateY(-50%);
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.05);
  }

  .close-button:active {
    transform: translateY(-50%) scale(0.95);
  }

  /* Sort Dropdown */
  .sort-dropdown-wrapper {
    position: absolute;
    left: var(--spacing-lg);
    top: 50%;
    transform: translateY(-50%);
  }

  .sort-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-sm);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    transition: all var(--duration-normal) ease;
  }

  .sort-trigger:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
  }

  .sort-trigger i:first-child {
    font-size: 0.8rem;
  }

  .dropdown-arrow {
    font-size: 0.6rem;
    margin-left: 2px;
    transition: transform var(--duration-normal) ease;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 140px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--border-radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    text-align: left;
    transition: all var(--duration-fast) ease;
  }

  .sort-option:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text);
  }

  .sort-option.active {
    background: rgba(236, 72, 153, 0.15);
    color: #ec4899;
  }

  .sort-option i:first-child {
    width: 16px;
    text-align: center;
    opacity: 0.7;
  }

  .sort-option .check-icon {
    margin-left: auto;
    color: #ec4899;
  }

  /* Controls Row (Search + Zoom) */
  .controls-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .search-wrapper {
    position: relative;
    flex: 1;
  }

  .search-wrapper .search-icon {
    position: absolute;
    left: var(--spacing-md);
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
    pointer-events: none;
  }

  .search-wrapper .search-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-left: calc(var(--spacing-xl) + var(--spacing-xs));
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-md);
    color: white;
    font-size: 0.875rem;
  }

  .search-wrapper .search-input:focus {
    outline: none;
    border-color: rgba(236, 72, 153, 0.5);
    background: var(--theme-card-bg);
  }

  .search-wrapper .clear-search {
    position: absolute;
    right: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    opacity: 0.7;
    transition: all var(--duration-normal) ease;
  }

  .search-wrapper .clear-search:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  /* Zoom Controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    padding: 2px;
    flex-shrink: 0;
  }

  .zoom-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .zoom-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .zoom-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-indicator {
    min-width: 20px;
    text-align: center;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  /* Search - old styles kept for backwards compat, can be removed */
  .search-container {
    position: relative;
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .search-icon {
    position: absolute;
    left: calc(var(--spacing-lg) + var(--spacing-md));
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-left: calc(var(--spacing-xl) + var(--spacing-sm));
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-md);
    color: white;
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(236, 72, 153, 0.5);
    background: var(--theme-card-bg);
  }

  .clear-search {
    position: absolute;
    right: calc(var(--spacing-lg) + var(--spacing-sm));
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    opacity: 0.7;
    transition: all var(--duration-normal) ease;
  }

  .clear-search:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  /* Filter Info */
  .filter-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(59, 130, 246, 0.1);
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    color: var(--semantic-info);
    font-size: 0.875rem;
  }

  .filter-info i {
    font-size: 0.875rem;
  }

  /* Selecting Overlay */
  .selecting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .selecting-overlay p {
    color: white;
    font-size: 0.9rem;
  }

  /* Grid Container */
  .sequence-grid-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-lg);
  }

  .sequence-grid-container.disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  /* Sections Container */
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--theme-stroke);
    margin-bottom: var(--spacing-sm);
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .section-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* Length sub-groups within sections */
  .length-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .length-group + .length-group {
    margin-top: var(--spacing-sm);
  }

  .length-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    padding-left: 2px;
    opacity: 0.7;
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
    gap: var(--spacing-md);
  }

  /* Loading/Error/Empty States */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: var(--spacing-md);
    color: var(--theme-text-dim);
  }

  .error-state i,
  .empty-state i {
    font-size: 3rem;
    opacity: 0.3;
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top-color: #ec4899;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(236, 72, 153, 0.2);
    border: 1px solid rgba(236, 72, 153, 0.3);
    border-radius: var(--border-radius-md);
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .error-state button:hover {
    background: rgba(236, 72, 153, 0.3);
  }

  /* Modal mode styles */
  .browser-content.modal-mode {
    height: 100%;
  }

  .browser-content.modal-mode .browser-header {
    background: transparent;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .modal-grid {
    grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
  }

  /* Zoom hint */
  .zoom-hint {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-top: var(--spacing-md);
    background: linear-gradient(to top, var(--theme-panel-bg) 60%, transparent);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    pointer-events: none;
    opacity: 0.7;
  }

  .zoom-hint i {
    font-size: 0.875rem;
  }

  /* Modal-specific styling via global selector */
  :global(.sequence-browser-modal) {
    --modal-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
