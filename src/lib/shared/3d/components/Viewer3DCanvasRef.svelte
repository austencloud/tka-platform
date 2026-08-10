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
  import { onDestroy, onMount } from "svelte";
  import type { WebGLRenderer } from "three";
  import { getViewer3DContext } from "../context/viewer-3d-context";

  interface Props {
    onRendererReady?: (renderer: WebGLRenderer | null) => void;
  }

  let { onRendererReady }: Props = $props();

  // Use `canvas` from useThrelte() directly, not `renderer.current?.domElement`.
  // The prior code relied on `renderer.current` which is populated asynchronously
  // (and doesn't reliably exist at runtime), so it silently failed to capture
  // the canvas and left video export stuck on "Preparing export…" forever.
  // `canvas` is the HTMLCanvasElement threlte uses to construct the
  // WebGLRenderer - it exists before any child component inside <Canvas>
  // mounts, so no timing dance is required. Cast through `unknown` because
  // the threlte 8.3.1 ThrelteContext .d.ts in this repo's types resolution
  // doesn't surface the `canvas` field even though it exists at runtime.
  const threlte = useThrelte() as unknown as {
    canvas: HTMLCanvasElement;
    renderer: WebGLRenderer | { current: WebGLRenderer };
  };
  const viewer3DState = getViewer3DContext();

  function getRenderer(): WebGLRenderer | null {
    const renderer = threlte.renderer;
    if ("current" in renderer) return renderer.current ?? null;
    return renderer;
  }

  viewer3DState.setWebglCanvas(threlte.canvas);

  onMount(() => {
    onRendererReady?.(getRenderer());
  });

  // Aggressively tear down WebGL on page unload to prevent Chrome navigation hang.
  // The fish GPUComputationRenderer creates a framebuffer feedback loop
  // (GL_INVALID_OPERATION) that hangs Chrome's GPU process. When the user
  // presses F5, Chrome waits for GPU teardown that never completes.
  // Fix: dispose the renderer (stops animation loop + frees GPU), then
  // force context loss as a belt-and-suspenders measure.
  function teardownWebGLOnUnload() {
    try {
      const r = getRenderer();
      if (r) {
        r.dispose();
        r.forceContextLoss();
      }
    } catch {
      // Last resort: raw context loss
      const gl =
        threlte.canvas?.getContext("webgl2") ||
        threlte.canvas?.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", teardownWebGLOnUnload);
    window.addEventListener("pagehide", teardownWebGLOnUnload);
  }

  onDestroy(() => {
    onRendererReady?.(null);
    viewer3DState.setWebglCanvas(null);
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", teardownWebGLOnUnload);
      window.removeEventListener("pagehide", teardownWebGLOnUnload);
    }
  });
</script>
