<!--
  CanvasLifecycle

  Threlte's own teardown calls renderer.dispose() but never
  forceContextLoss(), so a <Canvas> that unmounts strands a live WebGL
  context. Browsers cap those (Chrome evicts the oldest at ~16), which means
  a canvas that mounts and unmounts repeatedly — a modal preview, a lab
  viewport — eventually kills the main sequence viewer's context instead of
  its own. Drop this inside any <Canvas> that does not live for the whole
  session.
-->
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
