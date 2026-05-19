<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";

  interface Props {
    visible?: boolean;
  }

  let { visible = false }: Props = $props();

  const { renderer } = useThrelte();

  let fps = $state(0);
  let drawCalls = $state(0);
  let triangles = $state(0);
  let geometries = $state(0);
  let textures = $state(0);
  let programs = $state(0);

  let frameCount = 0;
  let lastTime = performance.now();

  useTask(() => {
    if (!visible) return;

    frameCount++;
    const now = performance.now();
    const elapsed = now - lastTime;

    if (elapsed >= 500) {
      fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      lastTime = now;

      const r = renderer.current;
      if (!r) return;
      const info = r.info;
      drawCalls = info.render.calls;
      triangles = info.render.triangles;
      geometries = info.memory.geometries;
      textures = info.memory.textures;
      programs = info.programs?.length ?? 0;
    }
  });
</script>

{#if visible}
  <div class="perf-monitor">
    <div class="perf-row">
      <span class="perf-label">FPS</span>
      <span class="perf-value" class:perf-warn={fps < 30} class:perf-good={fps >= 55}>{fps}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Draw</span>
      <span class="perf-value" class:perf-warn={drawCalls > 200}>{drawCalls}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Tris</span>
      <span class="perf-value">{(triangles / 1000).toFixed(1)}k</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Geo</span>
      <span class="perf-value" class:perf-warn={geometries > 100}>{geometries}</span>
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
    z-index: 1000;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 10px;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
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
