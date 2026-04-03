<script lang="ts">
  /**
   * Viewer3DCanvasRef
   *
   * Bridge component that lives inside Threlte's <Canvas> where useThrelte()
   * is available. Captures the WebGL canvas DOM element from the renderer and
   * stores it in shared viewer-3d state so external systems (e.g. video export)
   * can read pixels from the canvas without coupling to Three.js internals.
   */

  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const { renderer } = useThrelte();
  const viewer3DState = getViewer3DContext();

  onMount(() => {
    const canvas = renderer.current.domElement;
    if (canvas) {
      viewer3DState.setWebglCanvas(canvas);
    }
    return () => viewer3DState.setWebglCanvas(null);
  });
</script>
