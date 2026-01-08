<script lang="ts">
  import type { SequenceSection } from "./../../../shared/domain/models/discover-models.ts";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { IDiscoverThumbnailProvider } from "../services/contracts/IDiscoverThumbnailProvider";
  import DiscoverGrid from "./DiscoverGrid.svelte";
  import DiscoverThumbnailSkeleton from "./DiscoverThumbnailSkeleton.svelte";
  import GalleryTopBarControls from "../../../shared/components/GalleryTopBarControls.svelte";

  let hapticService: IHapticFeedback | null = null;

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sequences = [],
    sections = [],
    isLoading = false,
    error = null,
    showSections = false,
    onAction = () => {},
    onScroll,
  } = $props<{
    sequences?: SequenceData[];
    sections?: SequenceSection[];
    isLoading?: boolean;
    error?: string | null;
    showSections?: boolean;
    onAction?: (action: string, sequence: SequenceData) => void;
    onScroll?: (event: CustomEvent<{ scrollTop: number }>) => void;
  }>();

  // ✅ RESOLVE SERVICES: Get services from DI container (lazy resolution)
  let thumbnailService: IDiscoverThumbnailProvider | null = $state(null);

  // ✅ DERIVED RUNES: UI state
  const isEmpty = $derived(!isLoading && !error && sequences.length === 0);
  const hasSequences = $derived(!isLoading && !error && sequences.length > 0);

  // Handle sequence actions
  function handleSequenceAction(action: string, sequence: SequenceData) {
    onAction(action, sequence);
  }

  onMount(async () => {
    thumbnailService = tryResolve<IDiscoverThumbnailProvider>(
      TYPES.IDiscoverThumbnailProvider
    );
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleRetry() {
    hapticService?.trigger("selection");
    onAction("retry", {} as SequenceData);
  }

  // Handle scroll events and emit to parent
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (onScroll) {
      onScroll(
        new CustomEvent("scroll", {
          detail: { scrollTop: target.scrollTop },
        })
      );
    }
  }
</script>

<div class="sequence-display-panel">
  <!-- Gallery controls (moved from TopBar) -->
  <div class="gallery-controls-container">
    <GalleryTopBarControls />
  </div>

  <!-- Content area -->
  <div class="display-content" onscroll={handleScroll}>
    {#if isLoading && sequences.length === 0}
      <!-- Show skeletons on initial load for instant feedback -->
      <DiscoverThumbnailSkeleton viewMode="grid" count={12} />
    {:else if error}
      <div class="error-state" role="alert" aria-live="assertive">
        <p class="error-message">{error}</p>
        <button onclick={handleRetry}> Try Again </button>
      </div>
    {:else if isEmpty}
      <div class="empty-state">
        <p>No sequences found</p>
      </div>
    {:else if hasSequences}
      <DiscoverGrid
        {sequences}
        {sections}
        viewMode="grid"
        {showSections}
        {thumbnailService}
        onAction={handleSequenceAction}
      />
    {/if}
  </div>
</div>

<style>
  .sequence-display-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Gallery controls container - wraps the top bar controls */
  .gallery-controls-container {
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .display-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    container-type: inline-size; /* Enable container queries for responsive grid */
  }

  /* Modern scrollbar - thin and subtle */
  .display-content::-webkit-scrollbar {
    width: 6px;
  }

  .display-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .display-content::-webkit-scrollbar-thumb {
    background: var(--theme-stroke-strong);
    border-radius: 3px;
  }

  .display-content::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--theme-text, white) 25%, transparent);
  }

  /* Firefox scrollbar */
  .display-content {
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke-strong) transparent;
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: var(--spacing-md);
    color: var(--semantic-error);
  }

  .error-message {
    margin: 0;
    text-align: center;
  }

  .error-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 6px;
    color: var(--semantic-error);
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-state button:hover {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-base);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    /* Responsive styles for mobile */
  }
</style>
