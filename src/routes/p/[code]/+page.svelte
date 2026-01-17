<script lang="ts">
  /**
   * Animation Spotlight Page
   *
   * Standalone route for playing sequence animations from QR codes.
   * URL format: /p/{shortCode}
   *
   * Features:
   * - Full-screen animation playback (phone-optimized)
   * - Auto-play on load
   * - Minimal UI with play/pause controls
   * - Subtle CTA to open in TKA Scribe app
   * - Scan count tracking for analytics
   */

  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import AnimationSpotlight from "$lib/shared/qr/components/AnimationSpotlight.svelte";

  // Get short code from URL param
  const shortCode = $derived($page.params["code"]);

  // State
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Load sequence on mount
  onMount(async () => {
    if (!shortCode) {
      error = "No short code provided";
      isLoading = false;
      return;
    }

    try {
      const shortCodeManager = container.items.shortCodeManager;

      // Resolve short code to sequence
      const resolvedSequence =
        await shortCodeManager.resolveShortCode(shortCode);

      if (!resolvedSequence) {
        error = "Sequence not found";
        isLoading = false;
        return;
      }

      sequence = resolvedSequence;
      isLoading = false;

      // Increment scan count for analytics (fire-and-forget)
      shortCodeManager.incrementScanCount(shortCode).catch((err) => {
        console.warn("Failed to increment scan count:", err);
      });
    } catch (err) {
      console.error("Failed to load sequence:", err);
      error = "Failed to load sequence";
      isLoading = false;
    }
  });

  // Handle opening in full app
  function handleOpenInApp() {
    if (sequence) {
      // Store sequence for the app to consume
      try {
        localStorage.setItem(
          "tka-pending-edit-sequence",
          JSON.stringify(sequence)
        );
        goto("/?module=create&tab=edit");
      } catch (err) {
        console.error("Failed to store sequence:", err);
        goto("/");
      }
    } else {
      goto("/");
    }
  }

  // Handle going home
  function handleGoHome() {
    goto("/");
  }
</script>

<svelte:head>
  <title>
    {sequence?.word || sequence?.name || "Animation"} - TKA Scribe
  </title>
  <meta
    name="description"
    content={sequence?.word
      ? `Watch the "${sequence.word}" flow sequence animation`
      : "Watch this flow sequence animation in TKA Scribe"}
  />
  <!-- Mobile viewport optimization for full-screen experience -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  />
  <!-- Theme color for mobile browser chrome -->
  <meta name="theme-color" content="#0f0f1a" />
</svelte:head>

<div class="spotlight-page">
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading animation...</p>
    </div>
  {:else if error || !sequence}
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
        <h1>Animation Not Found</h1>
        <p>{error || "This QR code link appears to be invalid."}</p>
        <button class="home-button" onclick={handleGoHome}>
          Explore TKA Scribe
        </button>
      </div>
    </div>
  {:else}
    <AnimationSpotlight {sequence} onOpenInApp={handleOpenInApp} />
  {/if}
</div>

<style>
  .spotlight-page {
    min-height: 100vh;
    min-height: 100dvh; /* Dynamic viewport height for mobile */
    background: #0f0f1a;
    overflow: hidden;
  }

  .loading-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #f43f5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-container p {
    font-size: var(--font-size-sm, 14px);
    margin: 0;
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
    min-height: 48px;
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

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
