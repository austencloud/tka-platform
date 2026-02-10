<!--
  ScreenshotCaptureLab — Two-panel layout for on-demand screenshot capture.

  Left/Top: Capture Controls (route tree, device picker, floating capture bar)
  Right/Bottom: Gallery (module-organized, filterable, lightbox)
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IScreenshotOrchestrator } from "../services/contracts/IScreenshotOrchestrator";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IRippleEffect } from "$lib/shared/application/services/contracts/IRippleEffect";
  import RouteTreePicker from "../components/screenshots/RouteTreePicker.svelte";
  import DeviceSelector from "../components/screenshots/DeviceSelector.svelte";
  import CaptureProgress from "../components/screenshots/CaptureProgress.svelte";
  import ScreenshotGallery from "../components/screenshots/ScreenshotGallery.svelte";
  import { onMount } from "svelte";

  const orchestrator: IScreenshotOrchestrator = container.items.screenshotOrchestrator;

  let hapticService: IHapticFeedback;
  let rippleService: IRippleEffect;
  let captureButtonEl = $state<HTMLButtonElement | null>(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    rippleService = container.items.rippleEffect;

    // Attach ripple to capture button when it appears
    const interval = setInterval(() => {
      if (captureButtonEl && rippleService) {
        rippleService.attachRipple(captureButtonEl, {
          color: "rgba(255, 255, 255, 0.4)",
          duration: 600,
          opacity: 0.5,
        });
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  });

  const moduleGroups = orchestrator.getModuleGroups();
  const devices = orchestrator.getDevices();

  let selectedRoutes = $state<string[]>([]);
  let selectedDevices = $state<string[]>([]);
  let activeJobId = $state<string | null>(null);
  let captureError = $state<string | null>(null);
  let galleryRefreshToken = $state(0);

  const canCapture = $derived(
    selectedRoutes.length > 0 && selectedDevices.length > 0 && !activeJobId
  );

  const hasSelection = $derived(
    selectedRoutes.length > 0 && selectedDevices.length > 0
  );

  const expectedTotal = $derived(selectedRoutes.length * selectedDevices.length);

  async function startCapture() {
    hapticService?.trigger("selection");
    captureError = null;

    try {
      const result = await orchestrator.startCapture({
        routes: selectedRoutes,
        devices: selectedDevices,
      });
      activeJobId = result.jobId;
    } catch (err) {
      captureError = err instanceof Error ? err.message : String(err);
    }
  }

  function onCaptureComplete() {
    activeJobId = null;
    galleryRefreshToken++;
  }

  // Also poll manifest during capture for live gallery updates
  let manifestPollTimer: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (activeJobId) {
      manifestPollTimer = setInterval(() => {
        galleryRefreshToken++;
      }, 3000);
    } else {
      if (manifestPollTimer) {
        clearInterval(manifestPollTimer);
        manifestPollTimer = null;
      }
    }

    return () => {
      if (manifestPollTimer) {
        clearInterval(manifestPollTimer);
        manifestPollTimer = null;
      }
    };
  });
</script>

<div class="screenshot-lab">
  <!-- Capture Controls Panel -->
  <div class="controls-panel">
    <h2 class="panel-title">Screenshot Capture</h2>

    <div class="controls-body">
      <RouteTreePicker
        {moduleGroups}
        {selectedRoutes}
        onchange={(routes) => (selectedRoutes = routes)}
      />

      <div class="divider"></div>

      <DeviceSelector
        {devices}
        {selectedDevices}
        onchange={(devs) => (selectedDevices = devs)}
      />
    </div>

    <!-- Floating capture action bar -->
    <div class="floating-bar-container" class:visible={hasSelection || activeJobId}>
      <div class="floating-bar">
        <button
          bind:this={captureButtonEl}
          class="capture-btn"
          disabled={!canCapture}
          onclick={startCapture}
        >
          <i class="fas fa-camera"></i>
          {#if activeJobId}
            Capturing...
          {:else}
            Capture
            {#if expectedTotal > 0}
              <span class="capture-count">({expectedTotal})</span>
            {/if}
          {/if}
        </button>

        {#if captureError}
          <p class="capture-error">{captureError}</p>
        {/if}

        <CaptureProgress
          jobId={activeJobId}
          {orchestrator}
          onComplete={onCaptureComplete}
        />
      </div>
    </div>
  </div>

  <!-- Gallery Panel -->
  <div class="gallery-panel">
    <ScreenshotGallery refreshToken={galleryRefreshToken} />
  </div>
</div>

<style>
  .screenshot-lab {
    display: flex;
    height: 100%;
    overflow: hidden;
    gap: 0;
  }

  /* Controls panel — left side on desktop, top on mobile */
  .controls-panel {
    display: flex;
    flex-direction: column;
    width: 320px;
    min-width: 280px;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    flex-shrink: 0;
    position: relative;
  }

  .panel-title {
    margin: 0;
    padding: 16px 16px 12px;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .controls-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 16px 80px; /* Extra bottom padding for floating bar */
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* Floating capture action bar */
  .floating-bar-container {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 12px;
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity var(--duration-emphasis, 280ms) var(--ease-out, ease-out),
      transform var(--duration-emphasis, 280ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    pointer-events: none;
    z-index: 10;
  }

  .floating-bar-container.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .floating-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(18, 18, 28, 0.95));
    backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow:
      0 -4px 16px rgba(0, 0, 0, 0.3),
      0 -1px 4px rgba(0, 0, 0, 0.2);
  }

  .capture-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #3b82f6);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      opacity var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .capture-btn:hover:not(:disabled) {
    transform: scale(var(--hover-scale-md, 1.02));
  }

  .capture-btn:active:not(:disabled) {
    transform: scale(var(--active-scale, 0.98));
  }

  .capture-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .capture-count {
    display: inline-block;
    animation: popIn var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  .capture-error {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
  }

  /* Gallery panel — right side on desktop, bottom on mobile */
  .gallery-panel {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Mobile: stack vertically */
  @media (max-width: 900px) {
    .screenshot-lab {
      flex-direction: column;
    }

    .controls-panel {
      width: 100%;
      min-width: unset;
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
      max-height: 40vh;
    }

    .gallery-panel {
      min-height: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-bar-container {
      transition: none;
    }

    .capture-btn {
      transition: none;
    }

    .capture-btn:hover:not(:disabled),
    .capture-btn:active:not(:disabled) {
      transform: none;
    }

    .capture-count {
      animation: none;
    }
  }
</style>
