<script lang="ts">
  /**
   * Exposes the renderer's per-frame cost on `window.__gridPerf` so a capture
   * script can read hard numbers instead of guessing from how the page feels.
   *
   * Harness-only. Draw calls are the number that matters here: a particle
   * system rendered as one mesh per particle submits one draw call per
   * particle, and this is what makes that visible.
   */
  import { useThrelte, useTask } from "@threlte/core";

  const { renderer } = useThrelte();

  let frames = 0;
  let windowStart = 0;
  let fps = 0;

  useTask(() => {
    frames++;
    const now = performance.now();
    if (windowStart === 0) windowStart = now;
    if (now - windowStart >= 1000) {
      fps = (frames * 1000) / (now - windowStart);
      frames = 0;
      windowStart = now;
    }
    const info = renderer.info;
    (window as unknown as Record<string, unknown>).__gridPerf = {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      fps: Math.round(fps),
    };
  });
</script>
