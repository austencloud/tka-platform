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

  import { onMount } from "svelte";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { IDiscoverThumbnailProvider } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverThumbnailProvider";
  import type { ISequenceNormalizer } from "$lib/features/compose/services/contracts/ISequenceNormalizer";
  import SequenceCard from "$lib/features/discover/sequences/display/components/SequenceCard/SequenceCard.svelte";

  // Props
  let {
    mode = "primary",
    show = false,
    onSelect = (sequence: SequenceData) => {},
    onClose = () => {},
    requiredBeatCount = undefined,
    placement = undefined,
  }: {
    mode: "primary" | "secondary" | "grid-0" | "grid-1" | "grid-2" | "grid-3";
    show?: boolean;
    onSelect?: (sequence: SequenceData) => void;
    onClose?: () => void;
    requiredBeatCount?: number | undefined;
    placement?: "bottom" | "right" | "left" | "top" | undefined;
  } = $props();

  // Services - resolved lazily after module is loaded
  let loaderService = $state<IDiscoverLoader | null>(null);
  let thumbnailService = $state<IDiscoverThumbnailProvider | null>(null);
  let normalizationService = $state<ISequenceNormalizer | null>(null);
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

  // Filtered sequences based on search and beat count
  const filteredSequences = $derived.by(() => {
    let filtered = sequences;

    // Filter by beat count if required (use normalized beats, excluding start position)
    if (requiredBeatCount !== undefined && normalizationService) {
      const service = normalizationService; // capture for closure
      filtered = filtered.filter((seq) => {
        const normalized = service.separateBeatsFromStartPosition(seq);
        return normalized.beats.length === requiredBeatCount;
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

  // Initialize services from container
  function initializeServices() {
    try {
      // With ITI, all containers are already composed - no need for async module loading
      loaderService = container.items.discoverLoader ?? null;
      thumbnailService = container.items.discoverThumbnailProvider ?? null;
      // Note: ISequenceNormalizer may not be in the container yet - check build container
      normalizationService = (container.items as any).sequenceNormalizer ?? null;

      servicesReady = !!(loaderService && thumbnailService);

      if (!servicesReady) {
        console.warn(
          "⚠️ SequenceBrowserPanel: Some services failed to resolve"
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

      // Load full sequence data including beats
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
    requiredBeatCount !== undefined
      ? `Showing only ${requiredBeatCount}-beat sequences`
      : null
  );
</script>

<Drawer
  isOpen={show}
  onclose={onClose}
  placement={drawerPlacement}
  class="sequence-browser-panel"
  labelledBy="sequence-browser-title"
>
  <div class="browser-content">
    <!-- Header -->
    <div class="browser-header">
      <h2 id="sequence-browser-title">{modeLabel}</h2>
      <button class="close-button" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Search Bar -->
    <div class="search-container">
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

    <!-- Beat Count Filter Info -->
    {#if beatCountMessage}
      <div class="filter-info">
        <i class="fas fa-filter" aria-hidden="true"></i>
        <span>{beatCountMessage}</span>
      </div>
    {/if}

    <!-- Loading overlay when selecting sequence -->
    {#if isSelectingSequence}
      <div class="selecting-overlay" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading sequence...</p>
      </div>
    {/if}

    <!-- Sequence Grid -->
    <div class="sequence-grid-container" class:disabled={isSelectingSequence}>
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
        <div class="sequence-grid">
          {#each filteredSequences as sequence (sequence.id)}
            {@const coverUrl = getCoverUrl(sequence)}
            <SequenceCard
              {sequence}
              {...coverUrl && { coverUrl }}
              onPrimaryAction={handleSelect}
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>
</Drawer>

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

  /* Header */
  .browser-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
    background: var(--theme-card-bg);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
    min-height: 72px;
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
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.05);
  }

  .close-button:active {
    transform: translateY(-50%) scale(0.95);
  }

  /* Search */
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
    transition: all 0.2s ease;
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

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
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
    transition: all 0.2s ease;
  }

  .error-state button:hover {
    background: rgba(236, 72, 153, 0.3);
  }
</style>
