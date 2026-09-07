<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";

  import { registerInteractiveCanvasFrameProvider } from "../rendering/interactive-canvas-frame";

  const { canvas, renderer, scene, camera } = useThrelte();
  const unregister = registerInteractiveCanvasFrameProvider(canvas, () => {
    renderer.render(scene, camera.current);
  });

  onDestroy(unregister);
</script>
