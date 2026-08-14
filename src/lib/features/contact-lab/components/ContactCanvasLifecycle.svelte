<script lang="ts">
  import { onDestroy } from "svelte";
  import { useThrelte } from "@threlte/core";
  import type { WebGLRenderer } from "three";

  const threlte = useThrelte() as unknown as {
    renderer: WebGLRenderer | { current: WebGLRenderer };
  };

  function getRenderer(): WebGLRenderer | null {
    const renderer = threlte.renderer;
    if ("current" in renderer) return renderer.current ?? null;
    return renderer;
  }

  onDestroy(() => {
    const renderer = getRenderer();
    if (!renderer) return;
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.forceContextLoss();
  });
</script>
