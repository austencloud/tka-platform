<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { onDestroy, onMount } from "svelte";
  import type { WebGLRenderer } from "three";
  import { tryGetAdaptiveQualityContext } from "../context/adaptive-quality-context";
  import {
    createRendererInfoFrameSampler,
    createRendererPerformanceWindow,
    type RendererPerformanceSample,
  } from "./renderer-performance-window";
  import { createWebGlGpuTimer } from "./webgl-gpu-timer";

  interface Props {
    visible?: boolean;
    adaptive?: boolean;
    active?: boolean;
    warmupMs?: number;
    onSample?: (sample: RendererPerformanceSample) => void;
  }

  let {
    visible = false,
    adaptive = false,
    active = false,
    warmupMs = 0,
    onSample,
  }: Props = $props();

  // The installed Threlte 8 runtime exposes the renderer directly. The local
  // global.d.ts still describes the pre-v8 `.current` shape, so keep this cast
  // beside the boundary until that broader migration is done.
  const { renderer } = useThrelte() as unknown as {
    renderer: WebGLRenderer;
  };
  const adaptiveQuality = tryGetAdaptiveQualityContext();

  onMount(() => {
    if (adaptiveQuality && !adaptiveQuality.initialized) {
      adaptiveQuality.initialize(renderer);
    }
  });

  let fps = $state(0);
  let peakFrameMs = $state(0);
  let frameP95Ms = $state(0);
  let frameP99Ms = $state(0);
  let longFrameRate = $state(0);
  let thermalDrift = $state(0);
  let gpuP50Ms = $state(0);
  let gpuP95Ms = $state(0);
  let gpuP99Ms = $state(0);
  let drawCalls = $state(0);
  let triangles = $state(0);
  let geometries = $state(0);
  let textures = $state(0);
  let programs = $state(0);

  let frameCount = 0;
  let lastTime = performance.now();
  let lastFrameTime = lastTime;
  let observedPeakFrameMs = 0;
  let wasMonitoring = false;
  const frameWindow = createRendererPerformanceWindow();
  const gpuWindow = createRendererPerformanceWindow();
  const gpuTimer = createWebGlGpuTimer(renderer.getContext());
  const rendererInfoSampler = createRendererInfoFrameSampler(renderer.info);
  let frameSerial = 0;
  let monitoringStartedAt = lastTime;
  let warmupComplete = warmupMs === 0;

  onDestroy(() => {
    gpuTimer.dispose();
    rendererInfoSampler.dispose();
  });

  $effect(() => {
    const monitoring = visible || active;
    if (monitoring && !wasMonitoring) {
      peakFrameMs = 0;
      frameP95Ms = 0;
      frameP99Ms = 0;
      longFrameRate = 0;
      thermalDrift = 0;
      gpuP50Ms = 0;
      gpuP95Ms = 0;
      gpuP99Ms = 0;
      observedPeakFrameMs = 0;
      frameWindow.reset();
      gpuWindow.reset();
      frameCount = 0;
      lastTime = performance.now();
      lastFrameTime = lastTime;
      monitoringStartedAt = lastTime;
      warmupComplete = warmupMs === 0;
    }
    wasMonitoring = monitoring;
  });

  useTask((delta) => {
    const completeFrame = rendererInfoSampler.sampleAndReset();
    adaptiveQuality?.observeFrame(
      delta,
      adaptive &&
        (typeof document === "undefined" ||
          document.visibilityState === "visible")
    );

    if (!visible && !active) return;

    const now = performance.now();
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      lastFrameTime = now;
      return;
    }
    if (!warmupComplete) {
      if (now - monitoringStartedAt < warmupMs) {
        lastFrameTime = now;
        return;
      }
      warmupComplete = true;
      frameWindow.reset();
      gpuWindow.reset();
      frameCount = 0;
      observedPeakFrameMs = 0;
      lastTime = now;
      lastFrameTime = now;
      return;
    }
    const frameGapMs = now - lastFrameTime;
    frameWindow.record(frameGapMs);
    for (const elapsedGpuMs of gpuTimer.collect()) {
      gpuWindow.record(elapsedGpuMs);
    }
    frameSerial += 1;
    if (frameSerial % 4 === 0 && gpuTimer.begin()) {
      // Threlte's scheduler completes every render-stage task in this call
      // stack. Ending in a microtask therefore encloses the default render or
      // the post-processing composer without blocking on the result.
      queueMicrotask(() => gpuTimer.end());
    }
    if (frameGapMs > observedPeakFrameMs) {
      observedPeakFrameMs = frameGapMs;
      if (visible && frameGapMs > 50) {
        console.info(`[PerfMonitor] ${frameGapMs.toFixed(1)} ms frame gap`);
      }
    }
    lastFrameTime = now;
    frameCount++;
    const elapsed = now - lastTime;

    if (elapsed >= 500) {
      fps = Math.round((frameCount * 1000) / elapsed);
      peakFrameMs = observedPeakFrameMs;
      const windowSnapshot = frameWindow.snapshot();
      frameP95Ms = windowSnapshot.frameP95Ms;
      frameP99Ms = windowSnapshot.frameP99Ms;
      longFrameRate = windowSnapshot.longFrameRate;
      thermalDrift = windowSnapshot.thermalDrift;
      const gpuSnapshot = gpuWindow.snapshot();
      gpuP50Ms = gpuSnapshot.frameP50Ms;
      gpuP95Ms = gpuSnapshot.frameP95Ms;
      gpuP99Ms = gpuSnapshot.frameP99Ms;
      frameCount = 0;
      lastTime = now;

      drawCalls = completeFrame.drawCalls;
      triangles = completeFrame.triangles;
      geometries = completeFrame.geometries;
      textures = completeFrame.textures;
      programs = completeFrame.programs;
      onSample?.({
        fps,
        peakFrameMs,
        ...windowSnapshot,
        drawCalls,
        triangles,
        geometries,
        textures,
        programs,
        gpuTimingSupported: gpuTimer.supported,
        gpuSampleCount: gpuSnapshot.sampleCount,
        gpuP50Ms,
        gpuP95Ms,
        gpuP99Ms,
      });
    }
  });
</script>

{#if visible}
  <div class="perf-monitor">
    <div class="perf-row">
      <span class="perf-label">FPS</span>
      <span
        class="perf-value"
        class:perf-warn={fps < 30}
        class:perf-good={fps >= 55}>{fps}</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">P95</span>
      <span class="perf-value" class:perf-warn={frameP95Ms > 16.7}
        >{frameP95Ms.toFixed(1)} ms</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">P99</span>
      <span class="perf-value" class:perf-warn={frameP99Ms > 16.7}
        >{frameP99Ms.toFixed(1)} ms</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">GPU95</span>
      <span class="perf-value" class:perf-warn={gpuP95Ms > 11.5}
        >{gpuTimer.supported ? `${gpuP95Ms.toFixed(1)} ms` : "n/a"}</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">Long</span>
      <span class="perf-value" class:perf-warn={longFrameRate > 0.001}
        >{(longFrameRate * 100).toFixed(2)}%</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">Drift</span>
      <span class="perf-value" class:perf-warn={thermalDrift > 0.1}
        >{(thermalDrift * 100).toFixed(1)}%</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">Draw</span>
      <span class="perf-value" class:perf-warn={drawCalls > 200}
        >{drawCalls}</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">Tris</span>
      <span class="perf-value">{(triangles / 1000).toFixed(1)}k</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Geo</span>
      <span class="perf-value" class:perf-warn={geometries > 100}
        >{geometries}</span
      >
    </div>
    <div class="perf-row">
      <span class="perf-label">Tex</span>
      <span class="perf-value">{textures}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Prog</span>
      <span class="perf-value">{programs}</span>
    </div>
  </div>
{/if}

<style>
  .perf-monitor {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: var(--z-debug);
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 10px;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: #ccc;
    pointer-events: none;
    user-select: none;
    min-width: 100px;
  }

  .perf-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    line-height: 1.6;
  }

  .perf-label {
    color: #888;
  }

  .perf-value {
    color: #aef;
    font-variant-numeric: tabular-nums;
  }

  .perf-warn {
    color: #fa4;
  }

  .perf-good {
    color: #4f8;
  }
</style>
