<!--
  AnimationSpotlight.svelte

  Full-screen animation viewer optimized for QR code scans.
  Designed for mobile-first experience with minimal UI.

  Features:
  - Full viewport animation display
  - Auto-play on load
  - Simple play/pause controls (large touch targets)
  - Speed control slider
  - Subtle CTA to open in TKA Scribe
  - Sequence name display
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import AnimationPlayer from "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte";

  interface Props {
    sequence: SequenceData;
    onOpenInApp?: () => void;
  }

  let { sequence, onOpenInApp }: Props = $props();

  // UI state
  let showControls = $state(true);
  let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

  // Derived sequence info
  const sequenceWord = $derived(sequence.word || sequence.name || "Sequence");
  const stepCount = $derived(sequence.steps?.length || sequence.sequenceLength || 0);

  // Auto-hide controls after inactivity
  function scheduleHideControls() {
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
    }
    showControls = true;
    hideControlsTimeout = setTimeout(() => {
      showControls = false;
    }, 4000);
  }

  // Show controls on any interaction
  function handleInteraction() {
    scheduleHideControls();
  }

  onMount(() => {
    scheduleHideControls();
    return () => {
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout);
      }
    };
  });
</script>

<div
  class="spotlight-container"
  role="application"
  aria-label="Sequence animation viewer"
  onclick={handleInteraction}
  onkeydown={handleInteraction}
  onmousemove={handleInteraction}
  ontouchmove={handleInteraction}
>
  <!-- Animation Canvas -->
  <div class="animation-area">
    <AnimationPlayer
      {sequence}
      autoPlay={true}
      showControls={true}
      controlsLevel="minimal"
      layout="vertical"
    />
  </div>

  <!-- Overlay UI (fades on inactivity) -->
  <div class="overlay" class:visible={showControls}>
    <!-- Top bar: Sequence info -->
    <header class="top-bar">
      <div class="sequence-info">
        <h1 class="sequence-name">{sequenceWord}</h1>
        <span class="beat-count">{stepCount} steps</span>
      </div>
    </header>

    <!-- Bottom bar: CTA -->
    <footer class="bottom-bar">
      <button class="cta-button" onclick={onOpenInApp} type="button">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        <span>Open in TKA Scribe</span>
      </button>

      <p class="attribution">
        <span class="logo-text">The Kinetic Alphabet</span>
      </p>
    </footer>
  </div>
</div>

<style>
  .spotlight-container {
    position: fixed;
    inset: 0;
    background: #0f0f1a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .animation-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
      env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
  }

  /* Overlay that fades */
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .overlay.visible {
    opacity: 1;
  }

  .overlay > * {
    pointer-events: auto;
  }

  /* Top bar */
  .top-bar {
    padding: calc(env(safe-area-inset-top, 16px) + 16px) 16px 16px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.7) 0%,
      transparent 100%
    );
  }

  .sequence-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .sequence-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .beat-count {
    font-size: var(--font-size-sm, 14px);
    color: rgba(255, 255, 255, 0.7);
  }

  /* Bottom bar */
  .bottom-bar {
    padding: 16px 16px calc(env(safe-area-inset-bottom, 16px) + 16px);
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.7) 0%,
      transparent 100%
    );
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .cta-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    min-width: 200px;
    padding: 12px 24px;
    background: var(--theme-accent, #f43f5e);
    color: #ffffff;
    border: none;
    border-radius: 24px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      filter 0.15s ease;
    box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3);
  }

  .cta-button:hover {
    filter: brightness(1.1);
  }

  .cta-button:active {
    transform: scale(0.98);
  }

  .cta-button:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }

  .cta-button svg {
    flex-shrink: 0;
  }

  .attribution {
    margin: 0;
    font-size: var(--font-size-xs, 12px);
    color: rgba(255, 255, 255, 0.5);
  }

  .logo-text {
    font-weight: 500;
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay {
      transition: none;
    }

    .cta-button {
      transition: none;
    }
  }

  /* Landscape orientation adjustments */
  @media (orientation: landscape) and (max-height: 500px) {
    .top-bar {
      padding: 8px 16px;
    }

    .bottom-bar {
      flex-direction: row;
      justify-content: space-between;
      padding: 8px 16px;
    }

    .sequence-name {
      font-size: 1rem;
    }
  }
</style>
