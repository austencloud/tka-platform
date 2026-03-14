<script lang="ts">
  /**
   * QR Code Resolver Page
   *
   * Resolves short codes from QR scans and redirects to the unified
   * sequence viewer at /sequence/{encoded}.
   *
   * URL format: /p/{shortCode}
   *
   * Flow:
   * 1. Resolve short code to SequenceData (Firebase or inline-encoded)
   * 2. Track scan count (Firebase codes only)
   * 3. Save sequence via route handoff for instant loading
   * 4. Redirect to /sequence/{encoded} with replaceState
   *
   * The /sequence/ route handles all viewing: playback controls, auth-aware
   * actions, export, share, etc. This route is purely a resolver.
   */

  import { page } from "$app/stores";
  import { goto, pushState } from "$app/navigation";
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { saveSequenceRouteHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  // Get short code from URL param
  const shortCode = $derived($page.params["code"]);

  // State
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!shortCode) {
      error = "No short code provided";
      isLoading = false;
      return;
    }

    try {
      const shortCodeManager = container.items.shortCodeManager;
      const sequenceEncoder = container.items.sequenceEncoder;

      // Resolve short code to sequence
      // Handles both formats:
      // - s~{encodedData} -> offline decode (no Firebase needed)
      // - {shortCode} -> Firebase lookup (traditional)
      const sequence = await shortCodeManager.resolveShortCode(shortCode);

      if (!sequence) {
        error = "Sequence not found";
        isLoading = false;
        return;
      }

      // Track scan count for Firebase-backed short codes (not offline codes)
      if (!sequenceEncoder.isInlineEncoded(shortCode)) {
        shortCodeManager.incrementScanCount(shortCode).catch((err: unknown) => {
          console.warn("Failed to increment scan count:", err);
        });
      }

      // Mobile: go directly to app shell with drawer overlay (skip /sequence/[id] redirect)
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (isMobile) {
        openSequenceOverlay(sequence, {
          returnLabel: "Browse",
          dismissPath: "/browse/gallery",
          skipHistoryPush: true,
        });
        await goto("/browse/gallery", { replaceState: true });
        pushState('', { sequenceOverlay: true });
        return;
      }

      // Desktop: redirect to /sequence/{encoded} route for full-page viewer
      saveSequenceRouteHandoff({
        sequence,
        returnPath: "/browse/gallery",
        returnLabel: "Browse",
      });

      // Generate the /sequence/{encoded} path and redirect
      // Preserve any query params (like prop types) that came with the original URL
      const routePath = sequenceEncoder.generateSequenceRoutePath(sequence);
      const currentSearch = typeof window !== "undefined" ? window.location.search : "";
      await goto(routePath + currentSearch, { replaceState: true });
    } catch (err: unknown) {
      console.error("Failed to resolve short code:", err);
      error = "Failed to load sequence";
      isLoading = false;
    }
  });

  function handleGoHome() {
    goto("/browse/gallery");
  }
</script>

<svelte:head>
  <title>Loading... - TKA Scribe</title>
  <meta name="description" content="Loading a flow sequence in TKA Scribe" />
  <meta name="theme-color" content="#0f0f1a" />
</svelte:head>

<div class="resolver-page">
  {#if isLoading}
    <div class="loading-container">
      <LoadingGate variant="card" message="Loading sequence..." />
    </div>
  {:else if error}
    <div class="error-container">
      <div class="error-card">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="error-icon"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h1>Sequence Not Found</h1>
        <p>{error}</p>
        <button class="home-button" onclick={handleGoHome} type="button">
          Browse Sequences
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .resolver-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #0f0f1a;
    overflow: hidden;
  }

  .loading-container {
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
  }

  .error-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
    color: var(--semantic-error, #ef4444);
    margin-bottom: 1rem;
  }

  .error-card h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 0.5rem 0;
  }

  .error-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
    font-size: var(--font-size-sm, 14px);
  }

  .home-button {
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--duration-normal) ease;
  }

  .home-button:hover {
    filter: brightness(1.1);
  }

  .home-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

</style>
