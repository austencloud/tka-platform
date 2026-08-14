<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { onMount } from "svelte";
  import type { WebGLRenderer } from "three";
  import { tryGetAdaptiveQualityContext } from "../context/adaptive-quality-context";

  interface RendererPerformanceSample {
    fps: number;
    peakFrameMs: number;
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
    programs: number;
  }

  interface Props {
    visible?: boolean;
    adaptive?: boolean;
    active?: boolean;
    onSample?: (sample: RendererPerformanceSample) => void;
  }

  let {
    visible = false,
    adaptive = false,
    active = false,
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
  let drawCalls = $state(0);
  let triangles = $state(0);
  let geometries = $state(0);
  let textures = $state(0);
  let programs = $state(0);

  let frameCount = 0;
  let lastTime = performance.now();
  let lastFrameTime = lastTime;
  let observedPeakFrameMs = 0;
  let wasVisible = false;

  $effect(() => {
    if (visible && !wasVisible) {
      peakFrameMs = 0;
      observedPeakFrameMs = 0;
      frameCount = 0;
      lastTime = performance.now();
      lastFrameTime = lastTime;
    }
    wasVisible = visible;
  });

  useTask((delta) => {
    adaptiveQuality?.observeFrame(
      delta,
      adaptive &&
        (typeof document === "undefined" ||
          document.visibilityState === "visible")
    );

    if (!visible && !active) return;

    const now = performance.now();
    const frameGapMs = now - lastFrameTime;
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
      frameCount = 0;
      lastTime = now;

      const info = renderer.info;
      drawCalls = info.render.calls;
      triangles = info.render.triangles;
      geometries = info.memory.geometries;
      textures = info.memory.textures;
      programs = info.programs?.length ?? 0;
      onSample?.({
        fps,
        peakFrameMs,
        drawCalls,
        triangles,
        geometries,
        textures,
        programs,
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
      <span class="perf-label">Peak</span>
      <span class="perf-value" class:perf-warn={peakFrameMs > 32}
        >{peakFrameMs.toFixed(1)} ms</span
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
