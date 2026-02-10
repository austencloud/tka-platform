<!--
  ScreenshotCaptureLab — Two-panel layout for on-demand screenshot capture.

  Left/Top: Capture Controls (route tree, device picker, capture button, progress)
  Right/Bottom: Gallery (module-organized, filterable, lightbox)
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IScreenshotOrchestrator } from "../services/contracts/IScreenshotOrchestrator";
  import RouteTreePicker from "../components/screenshots/RouteTreePicker.svelte";
  import DeviceSelector from "../components/screenshots/DeviceSelector.svelte";
  import CaptureProgress from "../components/screenshots/CaptureProgress.svelte";
  import ScreenshotGallery from "../components/screenshots/ScreenshotGallery.svelte";

  const orchestrator: IScreenshotOrchestrator = container.items.screenshotOrchestrator;

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

  const expectedTotal = $derived(selectedRoutes.length * selectedDevices.length);

  async function startCapture() {
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
    // Trigger gallery refresh
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

      <div class="divider"></div>

      <!-- Capture action -->
      <div class="capture-section">
        <button
          class="capture-btn"
          disabled={!canCapture}
          onclick={startCapture}
        >
          <i class="fas fa-camera"></i>
          {#if activeJobId}
            Capturing...
          {:else}
            Capture {expectedTotal > 0 ? `(${expectedTotal})` : ""}
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
    padding: 0 16px 16px;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* Gallery panel — right side on desktop, bottom on mobile */
  .gallery-panel {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Capture section */
  .capture-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .capture-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: var(--theme-accent, #3b82f6);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s ease;
    width: 100%;
  }

  .capture-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .capture-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .capture-error {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
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
    .capture-btn {
      transition: none;
    }
  }
</style>
