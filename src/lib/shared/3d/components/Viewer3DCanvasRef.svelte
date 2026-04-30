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
  import { onDestroy } from "svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  // Use `canvas` from useThrelte() directly, not `renderer.current?.domElement`.
  // The prior code relied on `renderer.current` which is populated asynchronously
  // (and doesn't reliably exist at runtime), so it silently failed to capture
  // the canvas and left video export stuck on "Preparing export…" forever.
  // `canvas` is the HTMLCanvasElement threlte uses to construct the
  // WebGLRenderer - it exists before any child component inside <Canvas>
  // mounts, so no timing dance is required. Cast through `unknown` because
  // the threlte 8.3.1 ThrelteContext .d.ts in this repo's types resolution
  // doesn't surface the `canvas` field even though it exists at runtime.
  const threlte = useThrelte() as unknown as { canvas: HTMLCanvasElement };
  const viewer3DState = getViewer3DContext();

  viewer3DState.setWebglCanvas(threlte.canvas);

  onDestroy(() => {
    viewer3DState.setWebglCanvas(null);
  });
</script>
