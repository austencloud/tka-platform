<!--
  SharedSequenceView.svelte - External Sequence Viewer Page

  Full-page viewer for sequences received via deep links.
  Purpose: View a shared sequence and decide what to do with it.

  Actions available:
  - Open in Create (loads into Construct tab)
  - Save to Library
  - Favorite

  Uses shared primitives:
  - SequenceMediaViewerUnified for animation/image display
  - Same animation engine as Create/Discover
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { createSequenceViewerState } from "$lib/shared/sequence-viewer/state/sequence-viewer-state.svelte";
  import type { ISequenceViewer } from "$lib/shared/sequence-viewer/services/contracts/ISequenceViewer";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import SequenceMediaViewerUnified from "./SequenceMediaViewerUnified.svelte";
  import SequenceViewerActions from "./SequenceViewerActions.svelte";
  import VariationNav from "./VariationNav.svelte";

  // Props
  const {
    sequenceId,
    initialSequence = null,
    onAction = () => {},
    onClose,
    onOpenInCreate,
  } = $props<{
    sequenceId?: string;
    initialSequence?: SequenceData | null;
    onAction?: (action: string, sequence: SequenceData) => void;
    onClose?: () => void;
    onOpenInCreate?: (sequence: SequenceData) => void;
  }>();

  // State
  const viewerState = createSequenceViewerState();

  // Services
  let viewerService: ISequenceViewer | null = null;
  let hapticService: IHapticFeedback | null = null;
  let libraryService: ILibraryRepository | null = null;

  // Library state
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  let isSavedToLibrary = $state(false);
  const isAuthenticated = $derived(!!authState.effectiveUserId);

  // Derived
  const viewerTitle = $derived(
    viewerState.sequence?.word || viewerState.sequence?.name || "Sequence"
  );

  // Layout detection
  let windowWidth = $state(0);
  const isSideBySide = $derived(windowWidth >= 1024);

  function updateWidth() {
    if (browser) {
      windowWidth = window.innerWidth;
      viewerState.setLayoutMode(windowWidth >= 1024);
    }
  }

  // Load sequence
  async function loadSequence() {
    if (initialSequence) {
      viewerState.setSequence(initialSequence);
      return;
    }

    if (!sequenceId || !viewerService) {
      viewerState.setError("No sequence ID provided");
      return;
    }

    viewerState.setLoading(true);
    try {
      const seq = await viewerService.loadSequence(sequenceId);
      if (seq) {
        viewerState.setSequence(seq);
      } else {
        viewerState.setError("Sequence not found");
      }
    } catch (err) {
      viewerState.setError(
        err instanceof Error ? err.message : "Failed to load sequence"
      );
    }
  }

  // Handlers
  async function handleSaveToLibrary() {
    if (!viewerState.sequence || !libraryService || !isAuthenticated) return;

    hapticService?.trigger("selection");
    isSaving = true;
    saveError = null;

    try {
      await libraryService.saveSequence(viewerState.sequence);
      isSavedToLibrary = true;
      hapticService?.trigger("success");
      onAction("saved", viewerState.sequence);
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to save";
      hapticService?.trigger("error");
    } finally {
      isSaving = false;
    }
  }

  async function handleToggleFavorite() {
    if (!viewerState.sequence || !libraryService || !isAuthenticated) return;

    hapticService?.trigger("selection");
    const sequenceId = viewerState.sequence.id;
    if (!sequenceId) {
      // If sequence has no ID, we need to save it first
      await handleSaveToLibrary();
      return;
    }

    try {
      const isFavorite = await libraryService.toggleFavorite(sequenceId);
      viewerState.setSequence({
        ...viewerState.sequence,
        isFavorite,
      });
      hapticService?.trigger("success");
      onAction("favorite", viewerState.sequence);
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      hapticService?.trigger("error");
    }
  }

  function handleAction(action: string) {
    if (!viewerState.sequence) return;
    hapticService?.trigger("selection");

    switch (action) {
      case "open-in-create":
        // Use callback if provided, otherwise navigate directly
        if (onOpenInCreate) {
          onOpenInCreate(viewerState.sequence);
        } else {
          // Navigate to Create module with this sequence
          const encoded = viewerService?.encodeForUrl(viewerState.sequence);
          if (encoded) {
            goto(`/?open=construct:${encoded}`);
          }
        }
        break;
      case "share":
        // Share action
        onAction("share", viewerState.sequence);
        break;
      case "save":
        // Save to library
        handleSaveToLibrary();
        break;
      case "favorite":
        // Toggle favorite via library
        handleToggleFavorite();
        break;
      default:
        onAction(action, viewerState.sequence);
    }
  }

  function handleClose() {
    if (onClose) {
      onClose();
    } else if (browser) {
      // Navigate back or to app
      if (history.length > 1) {
        history.back();
      } else {
        goto("/app");
      }
    }
  }

  function handleVariationChange(delta: number) {
    hapticService?.trigger("selection");
    if (delta > 0) {
      viewerState.nextVariation();
    } else {
      viewerState.previousVariation();
    }
  }

  // Lifecycle
  onMount(() => {
    viewerService = tryResolve<ISequenceViewer>(TYPES.ISequenceViewer);
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
    libraryService = tryResolve<ILibraryRepository>(TYPES.ILibraryRepository);

    updateWidth();
    window.addEventListener("resize", updateWidth);

    // Load sequence after services are resolved
    loadSequence();

    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  });
</script>

<div class="sequence-viewer" class:side-by-side={isSideBySide}>
  <!-- Header -->
  <header class="viewer-header">
    <h1 class="viewer-title">{viewerTitle}</h1>
    <button class="close-button" onclick={handleClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </header>

  <!-- Main Content -->
  <main class="viewer-content">
    {#if viewerState.isLoading}
      <div
        class="loading-state"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading sequence...</p>
      </div>
    {:else if viewerState.error}
      <div class="error-state" role="alert">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>{viewerState.error}</p>
        <button onclick={handleClose}>Go Back</button>
      </div>
    {:else if viewerState.sequence}
      <!-- Media Section - Uses shared primitives -->
      <section class="media-section">
        <SequenceMediaViewerUnified
          sequence={viewerState.sequence}
          initialMediaType="image"
          controlsLevel="standard"
        />

        {#if viewerState.hasMultipleVariations}
          <VariationNav
            currentIndex={viewerState.currentVariationIndex}
            total={viewerState.totalVariations}
            onPrevious={() => handleVariationChange(-1)}
            onNext={() => handleVariationChange(1)}
          />
        {/if}
      </section>

      <!-- Metadata -->
      <section class="metadata-section">
        {#if viewerState.sequence.author}
          <div class="metadata-item">
            <span class="label">Author</span>
            <span class="value">{viewerState.sequence.author}</span>
          </div>
        {/if}
        {#if viewerState.sequence.beats.length > 0}
          <div class="metadata-item">
            <span class="label">Beats</span>
            <span class="value">{viewerState.sequence.beats.length}</span>
          </div>
        {/if}
        {#if viewerState.sequence.level}
          <div class="metadata-item">
            <span class="label">Level</span>
            <span class="value">{viewerState.sequence.level}</span>
          </div>
        {/if}
      </section>

      <!-- Action Buttons -->
      <SequenceViewerActions
        {isAuthenticated}
        {isSaving}
        {isSavedToLibrary}
        isFavorite={viewerState.sequence.isFavorite}
        {saveError}
        onAction={handleAction}
      />
    {/if}
  </main>
</div>

<style>
  .sequence-viewer {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--app-bg, #0a0a0f);
    color: white;
    overflow: hidden;
  }

  /* Header */
  .viewer-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    background: rgba(15, 20, 30, 0.95);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
    min-height: 72px;
  }

  .viewer-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin: 0;
    text-align: center;
  }

  .close-button {
    position: absolute;
    top: 12px;
    right: 16px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  /* Content */
  .viewer-content {
    flex: 1;
    min-height: 0; /* Critical for flex overflow containment */
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Loading & Error States */
  .loading-state,
  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--theme-text-dim);
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state i {
    font-size: var(--font-size-3xl);
    color: var(--semantic-error);
  }

  .error-state button {
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    cursor: pointer;
  }

  /* Media Section */
  .media-section {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    flex: 1; /* Allow it to grow */
    min-height: 0; /* Critical for flex overflow containment */
    max-height: 55%; /* Use percentage to leave MORE room for other content */
    width: 100%;
    overflow: hidden; /* Prevent any overflow */
  }

  /* Metadata */
  .metadata-section {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
    flex-shrink: 0; /* Prevent from being squeezed */
  }

  .metadata-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .metadata-item .label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metadata-item .value {
    font-size: var(--font-size-base);
    font-weight: 600;
  }

  /* Beats Section */

  /* Side-by-side layout (desktop) */
  .sequence-viewer.side-by-side .viewer-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    max-width: 1200px;
    margin: 0 auto;
  }

  .sequence-viewer.side-by-side .media-section {
    flex: 1; /* Allow natural sizing */
    min-width: 300px;
    max-width: 600px; /* Constrain maximum width in side-by-side */
    max-height: 60%; /* Leave room for other content */
  }

  .sequence-viewer.side-by-side .metadata-section {
    width: 100%;
  }
</style>
