<!--
  ModalUrlRestorer.svelte

  Restores modal state from URL params on page load/HMR.
  Renders the appropriate modal based on URL state.

  Supports deep linking:
  - Same-tab refresh: Uses sessionStorage cache
  - Cross-tab: Fetches from local IndexedDB or Firebase public sequences
  - Cross-user: Fetches from Firebase public sequences

  This component should be placed at the app root level (in +layout.svelte).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    getModalUrlState,
    clearModalUrlState,
    cacheSequence,
  } from "../state/ui/modal-url-state.svelte";
  import {
    openSpotlightWithSplit,
    openSpotlightWithAnimation,
    openSpotlightWithStepGrid,
  } from "../state/ui/ui-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IDeepLinkResolver, DeepLinkError } from "../services/contracts/IDeepLinkResolver";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import SequenceDetailsModal from "$lib/shared/sequence-viewer/components/SequenceDetailsModal.svelte";

  // State for sequence details modal
  let sequenceModalOpen = $state(false);
  let sequenceModalData = $state<SequenceData | null>(null);
  let restoredBpm = $state(60);
  let restoredPlaybackTime = $state(0);
  let restoredViewMode = $state<"split" | "animation" | "image">("split");
  let restoredStaggerOpen = $state(false);

  // Error state for failed deep links
  let loadError = $state<DeepLinkError>(null);
  let isLoading = $state(false);

  // Focus management for accessibility
  let errorContainerRef = $state<HTMLDivElement | null>(null);

  // Track if we've attempted restoration
  let restorationAttempted = $state(false);

  // Focus error container when error appears (accessibility)
  $effect(() => {
    if (loadError && errorContainerRef) {
      errorContainerRef.focus();
    }
  });

  // Get URL state reactively
  let urlState = $derived(getModalUrlState());

  // Restore modal state from URL on mount
  onMount(() => {
    // Small delay to ensure page is fully loaded
    setTimeout(() => {
      restoreFromUrl();
    }, 100);
  });

  async function restoreFromUrl() {
    if (restorationAttempted) return;
    restorationAttempted = true;

    const state = getModalUrlState();

    if (!state.modal || !state.sequenceId) {
      return;
    }

    console.log("[ModalUrlRestorer] Restoring modal state:", state);
    isLoading = true;
    loadError = null;

    // Use DeepLinkResolver to fetch sequence from any source
    const deepLinkResolver = container.items.deepLinkResolver as IDeepLinkResolver;
    const result = await deepLinkResolver.resolve(state.sequenceId);

    isLoading = false;

    if (!result.sequence) {
      console.warn("[ModalUrlRestorer] Could not restore modal:", result.error);
      loadError = result.error;
      // Keep the error state visible - don't clear URL immediately
      // This lets the user see the error message
      return;
    }

    // Cache the sequence for future use (HMR, etc.)
    if (result.source === "public" || result.source === "local") {
      cacheSequence(result.sequence);
    }

    // Restore based on modal type
    if (state.modal === "sequence") {
      // Store restoration data
      restoredBpm = state.bpm;
      restoredPlaybackTime = state.playbackTimeMs;
      restoredViewMode = state.view;
      restoredStaggerOpen = state.stagger;
      sequenceModalData = result.sequence;
      sequenceModalOpen = true;
    } else if (state.modal === "spotlight") {
      // Open spotlight with appropriate mode
      switch (state.spotlightMode) {
        case "animation":
          openSpotlightWithAnimation(result.sequence);
          break;
        case "stepgrid":
          openSpotlightWithStepGrid(result.sequence);
          break;
        case "split":
          openSpotlightWithSplit(result.sequence);
          break;
        case "image":
        default:
          openSpotlightWithSplit(result.sequence);
          break;
      }
    }
  }

  function handleModalClose() {
    sequenceModalOpen = false;
    sequenceModalData = null;
  }

  function dismissError() {
    loadError = null;
    clearModalUrlState();
  }
</script>

<!-- Loading state for deep link resolution -->
{#if isLoading}
  <div class="deep-link-overlay">
    <div class="deep-link-loading" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>Loading sequence...</p>
    </div>
  </div>
{/if}

<!-- Error state for failed deep links -->
{#if loadError}
  <div class="deep-link-overlay">
    <div
      class="deep-link-error"
      role="alert"
      aria-live="assertive"
      tabindex="-1"
      bind:this={errorContainerRef}
    >
      {#if loadError === "not_found"}
        <i class="fas fa-unlink error-icon" aria-hidden="true"></i>
        <h2>Sequence Not Found</h2>
        <p>This sequence no longer exists or was made private.</p>
      {:else if loadError === "network"}
        <i class="fas fa-wifi error-icon" aria-hidden="true"></i>
        <h2>Connection Error</h2>
        <p>Check your internet connection and try again.</p>
      {:else}
        <i class="fas fa-exclamation-triangle error-icon" aria-hidden="true"></i>
        <h2>Failed to Load</h2>
        <p>Something went wrong loading this sequence.</p>
      {/if}
      <button class="dismiss-button" onclick={dismissError}>
        Go Back
      </button>
    </div>
  </div>
{/if}

<!-- Render sequence details modal if URL state indicates it should be open -->
{#if sequenceModalOpen && sequenceModalData}
  <SequenceDetailsModal
    bind:open={sequenceModalOpen}
    sequence={sequenceModalData}
    onclose={handleModalClose}
    initialBpm={restoredBpm}
    initialPlaybackTimeMs={restoredPlaybackTime}
    initialViewMode={restoredViewMode}
    initialStaggerOpen={restoredStaggerOpen}
  />
{/if}

<style>
  .deep-link-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
  }

  .deep-link-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: var(--theme-text, #ffffff);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .deep-link-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    max-width: 320px;
    text-align: center;
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    outline: none; /* Container receives focus for screen readers but isn't visually interactive */
  }

  .error-icon {
    font-size: 3rem;
    color: var(--semantic-error, #ef4444);
    opacity: 0.8;
  }

  .deep-link-error h2 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
  }

  .deep-link-error p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .dismiss-button {
    margin-top: 0.5rem;
    padding: 0.75rem 1.5rem;
    min-width: 120px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .dismiss-button:hover {
    opacity: 0.9;
  }

  .dismiss-button:active {
    opacity: 0.8;
  }
</style>
