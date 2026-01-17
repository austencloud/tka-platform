<!--
  TimelineMediaBrowser.svelte - Browse and import media to timeline

  A drawer for adding sequences/recordings to the timeline.
  Features:
  - Browse sequences from library
  - Filter by sequences with recordings
  - Choose import type: Animation, Image, or Recording
-->
<script module lang="ts">
  /** Media import type */
  export type MediaImportType = "animation" | "image" | "recording";
</script>

<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { onMount } from "svelte";
  import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
  import type { IDiscoverThumbnailProvider } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverThumbnailProvider";
  import SequenceCard from "$lib/features/discover/sequences/display/components/SequenceCard/SequenceCard.svelte";

  interface Props {
    show?: boolean;
    onClose?: () => void;
    onImport?: (sequence: SequenceData, mediaType: MediaImportType) => void;
    /** Callback to preview sequence in source monitor */
    onPreview?: (sequence: SequenceData) => void;
  }

  let {
    show = false,
    onClose = () => {},
    onImport = () => {},
    onPreview,
  }: Props = $props();

  // Services
  let loaderService = $state<IDiscoverLoader | null>(null);
  let thumbnailService = $state<IDiscoverThumbnailProvider | null>(null);
  let servicesReady = $state(false);

  // Drawer placement based on screen size
  let drawerPlacement = $state<"bottom" | "right">("right");

  $effect(() => {
    drawerPlacement = window.innerWidth < 768 ? "bottom" : "right";
    const handleResize = () => {
      drawerPlacement = window.innerWidth < 768 ? "bottom" : "right";
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // State
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let filterMode = $state<"all" | "with-recordings">("all");

  // Selection state
  let selectedSequence = $state<SequenceData | null>(null);
  let isSelectingSequence = $state(false);

  // Filtered sequences
  const filteredSequences = $derived.by(() => {
    let filtered = sequences;

    // Filter by recordings
    if (filterMode === "with-recordings") {
      filtered = filtered.filter(
        (seq) => seq.performanceVideoUrl || seq.animatedSequenceUrl
      );
    }

    // Search filter
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

  // Check if sequence has specific media types
  function hasAnimation(seq: SequenceData | null): boolean {
    return !!seq && !!seq.steps && seq.steps.length > 0;
  }

  function hasImage(seq: SequenceData | null): boolean {
    return !!seq && !!seq.thumbnails && seq.thumbnails.length > 0;
  }

  function hasRecording(seq: SequenceData | null): boolean {
    return !!seq && !!seq.performanceVideoUrl;
  }

  // Initialize services
  function initializeServices() {
    try {
      loaderService = container.items.discoverLoader as IDiscoverLoader;
      thumbnailService = container.items
        .discoverThumbnailProvider as IDiscoverThumbnailProvider;
      servicesReady = !!(loaderService && thumbnailService);
    } catch (err) {
      console.error("TimelineMediaBrowser: Failed to init services:", err);
      error = "Failed to initialize";
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
      console.error("TimelineMediaBrowser: Failed to load:", err);
      error = err instanceof Error ? err.message : "Failed to load";
    } finally {
      isLoading = false;
    }
  }

  // Get thumbnail URL
  function getCoverUrl(sequence: SequenceData): string | undefined {
    if (!thumbnailService) return undefined;
    const first = sequence.thumbnails?.[0];
    if (!first) return undefined;
    try {
      return thumbnailService.getThumbnailUrl(sequence.id, first);
    } catch {
      return undefined;
    }
  }

  // Handle sequence card click - show media type picker
  async function handleSequenceClick(sequence: SequenceData) {
    if (!loaderService) {
      selectedSequence = sequence;
      return;
    }

    try {
      isSelectingSequence = true;
      const fullSequence = await loaderService.loadFullSequenceData(
        sequence.word || sequence.name || sequence.id
      );
      selectedSequence = fullSequence || sequence;
    } catch {
      selectedSequence = sequence;
    } finally {
      isSelectingSequence = false;
    }
  }

  // Handle media type selection
  function handleImport(mediaType: MediaImportType) {
    if (selectedSequence) {
      onImport(selectedSequence, mediaType);
      selectedSequence = null;
      onClose();
    }
  }

  // Handle preview in source monitor
  function handlePreview() {
    if (selectedSequence && onPreview) {
      onPreview(selectedSequence);
      // Don't close drawer - user might want to add after previewing
    }
  }

  // Go back to sequence list
  function handleBack() {
    selectedSequence = null;
  }

  // Load on mount
  onMount(() => {
    initializeServices();
    if (servicesReady) {
      loadSequences();
    }
  });
</script>

<Drawer
  isOpen={show}
  onclose={onClose}
  placement={drawerPlacement}
  class="timeline-media-browser"
  labelledBy="media-browser-title"
>
  <div class="browser-content">
    <!-- Header -->
    <div class="browser-header">
      {#if selectedSequence}
        <button class="back-button" onclick={handleBack} aria-label="Back">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <h2 id="media-browser-title">Import Media</h2>
      {:else}
        <h2 id="media-browser-title">Add to Timeline</h2>
      {/if}
      <button class="close-button" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    {#if selectedSequence}
      <!-- Media Type Selection View -->
      <div class="media-type-view">
        <div class="sequence-preview">
          <div class="preview-thumbnail">
            {#if getCoverUrl(selectedSequence)}
              <img
                src={getCoverUrl(selectedSequence)}
                alt={selectedSequence.word || "Sequence"}
              />
            {:else}
              <div class="placeholder-thumb">
                <i class="fas fa-film" aria-hidden="true"></i>
              </div>
            {/if}
          </div>
          <div class="preview-info">
            <h3>
              {selectedSequence.word || selectedSequence.name || "Unnamed"}
            </h3>
            <p>{selectedSequence.steps?.length || 0} steps</p>
            {#if selectedSequence.author}
              <p class="author">by {selectedSequence.author}</p>
            {/if}
            {#if onPreview && hasAnimation(selectedSequence)}
              <button
                class="preview-button"
                onclick={handlePreview}
                title="Preview in Source Monitor"
              >
                <i class="fas fa-eye" aria-hidden="true"></i>
                <span>Preview</span>
              </button>
            {/if}
          </div>
        </div>

        <div class="media-options">
          <h4>Choose import type:</h4>

          <!-- Animation Option -->
          <button
            class="media-option"
            class:disabled={!hasAnimation(selectedSequence)}
            onclick={() =>
              hasAnimation(selectedSequence) && handleImport("animation")}
            disabled={!hasAnimation(selectedSequence)}
          >
            <div class="option-icon animation">
              <i class="fas fa-play-circle" aria-hidden="true"></i>
            </div>
            <div class="option-content">
              <span class="option-label">Animation</span>
              <span class="option-desc">
                {#if hasAnimation(selectedSequence)}
                  Animated pictographs from sequence steps
                {:else}
                  No animation data available
                {/if}
              </span>
            </div>
            {#if hasAnimation(selectedSequence)}
              <i class="fas fa-chevron-right option-arrow" aria-hidden="true"
              ></i>
            {/if}
          </button>

          <!-- Image Option -->
          <button
            class="media-option"
            class:disabled={!hasImage(selectedSequence)}
            onclick={() => hasImage(selectedSequence) && handleImport("image")}
            disabled={!hasImage(selectedSequence)}
          >
            <div class="option-icon image">
              <i class="fas fa-image" aria-hidden="true"></i>
            </div>
            <div class="option-content">
              <span class="option-label">Image</span>
              <span class="option-desc">
                {#if hasImage(selectedSequence)}
                  Static thumbnail image
                {:else}
                  No image available
                {/if}
              </span>
            </div>
            {#if hasImage(selectedSequence)}
              <i class="fas fa-chevron-right option-arrow" aria-hidden="true"
              ></i>
            {/if}
          </button>

          <!-- Recording Option -->
          <button
            class="media-option"
            class:disabled={!hasRecording(selectedSequence)}
            onclick={() =>
              hasRecording(selectedSequence) && handleImport("recording")}
            disabled={!hasRecording(selectedSequence)}
          >
            <div class="option-icon recording">
              <i class="fas fa-video" aria-hidden="true"></i>
            </div>
            <div class="option-content">
              <span class="option-label">Recording</span>
              <span class="option-desc">
                {#if hasRecording(selectedSequence)}
                  Your performance video
                {:else}
                  No recording attached
                {/if}
              </span>
            </div>
            {#if hasRecording(selectedSequence)}
              <i class="fas fa-chevron-right option-arrow" aria-hidden="true"
              ></i>
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <!-- Sequence Browser View -->

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

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          class="filter-tab"
          class:active={filterMode === "all"}
          onclick={() => (filterMode = "all")}
        >
          <i class="fas fa-th" aria-hidden="true"></i>
          All Sequences
        </button>
        <button
          class="filter-tab"
          class:active={filterMode === "with-recordings"}
          onclick={() => (filterMode = "with-recordings")}
        >
          <i class="fas fa-video" aria-hidden="true"></i>
          With Recordings
        </button>
      </div>

      <!-- Loading Overlay -->
      {#if isSelectingSequence}
        <div class="selecting-overlay">
          <div class="spinner"></div>
          <p>{t("loading_sequence")}</p>
        </div>
      {/if}

      <!-- Sequence Grid -->
      <div class="sequence-grid-container" class:disabled={isSelectingSequence}>
        {#if isLoading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{t("loading_sequences")}</p>
          </div>
        {:else if error}
          <div class="error-state">
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
            <p>{error}</p>
            <button onclick={loadSequences}>Retry</button>
          </div>
        {:else if filteredSequences.length === 0}
          <div class="empty-state">
            {#if filterMode === "with-recordings"}
              <i class="fas fa-video-slash" aria-hidden="true"></i>
              <p>No sequences with recordings</p>
              <span class="empty-hint"
                >Record a performance in the Create module</span
              >
            {:else}
              <i class="fas fa-search" aria-hidden="true"></i>
              <p>No sequences found</p>
            {/if}
          </div>
        {:else}
          <div class="sequence-grid">
            {#each filteredSequences as sequence (sequence.id)}
              {@const coverUrl = getCoverUrl(sequence)}
              {@const hasVideo = hasRecording(sequence)}
              <div class="sequence-card-wrapper">
                <SequenceCard
                  {sequence}
                  {...coverUrl && { coverUrl }}
                  onPrimaryAction={handleSequenceClick}
                />
                {#if hasVideo}
                  <div class="video-badge" title="Has recording">
                    <i class="fas fa-video" aria-hidden="true"></i>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Drawer>

<style>
  :global(.drawer-content.timeline-media-browser) {
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

  .close-button,
  .back-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
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

  .close-button {
    right: var(--spacing-lg);
  }

  .back-button {
    left: var(--spacing-lg);
  }

  .close-button:hover,
  .back-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.05);
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
    border-radius: var(--border-radius-md, 8px);
    color: white;
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(74, 158, 255, 0.5);
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

  /* Filter Tabs */
  .filter-tabs {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .filter-tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .filter-tab:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .filter-tab.active {
    background: rgba(74, 158, 255, 0.2);
    border-color: rgba(74, 158, 255, 0.4);
    color: white;
  }

  /* Loading Overlay */
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

  .sequence-card-wrapper {
    position: relative;
  }

  .video-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 68, 68, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    color: white;
    z-index: 2;
    box-shadow: 0 2px 6px var(--theme-shadow);
  }

  /* States */
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

  .empty-hint {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .spinner {
    width: 44px;
    height: 44px;
    border: 3px solid var(--theme-stroke);
    border-top-color: #4a9eff;
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
    background: rgba(74, 158, 255, 0.2);
    border: 1px solid rgba(74, 158, 255, 0.3);
    border-radius: var(--border-radius-md, 8px);
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .error-state button:hover {
    background: rgba(74, 158, 255, 0.3);
  }

  /* Media Type Selection View */
  .media-type-view {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .sequence-preview {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--theme-card-bg);
    border-radius: var(--border-radius-md, 8px);
    margin-bottom: var(--spacing-lg);
  }

  .preview-thumbnail {
    width: 80px;
    height: 80px;
    border-radius: var(--border-radius-sm, 6px);
    overflow: hidden;
    flex-shrink: 0;
  }

  .preview-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-thumb {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-2xl);
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
  }

  .preview-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .preview-info h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-info p {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--theme-text-dim);
  }

  .preview-info .author {
    color: var(--theme-text-dim);
    font-style: italic;
  }

  .preview-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 212, 59, 0.15);
    color: #ffd43b;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    width: fit-content;
  }

  .preview-button:hover {
    background: rgba(255, 212, 59, 0.25);
  }

  .preview-button i {
    font-size: var(--font-size-compact);
  }

  .media-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .media-options h4 {
    margin: 0 0 var(--spacing-sm);
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .media-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
  }

  .media-option:not(.disabled):hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(74, 158, 255, 0.4);
    transform: translateX(4px);
  }

  .media-option.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .option-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }

  .option-icon.animation {
    background: rgba(74, 158, 255, 0.2);
    color: #4a9eff;
  }

  .option-icon.image {
    background: rgba(81, 207, 102, 0.2);
    color: #51cf66;
  }

  .option-icon.recording {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .option-content {
    flex: 1;
    min-width: 0;
  }

  .option-label {
    display: block;
    font-size: 0.95rem;
    font-weight: 600;
    color: white;
  }

  .option-desc {
    display: block;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    margin-top: 2px;
  }

  .option-arrow {
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
    font-size: var(--font-size-sm);
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
