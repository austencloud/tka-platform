<script lang="ts">
  /**
   * Owns the museum render loop.
   *
   * The previous FPS path rendered the scene through full-resolution bloom,
   * vignette, and output passes. At large desktop DPRs that turned one frame
   * into several full-canvas passes and starved the Q transition. The museum
   * now keeps one renderer path for every camera mode, so switching cameras
   * changes only camera state.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { ACESFilmicToneMapping } from "three";
  import type { WebGLRenderer, Scene, Camera } from "three";
  import {
    resolveRenderer,
    resolveScene,
    resolveCamera,
  } from "../resolve-threlte-scene";
  import { getMuseumPerformanceRecorder } from "../../get-museum-performance-recorder";

  interface Props {
    geometryReady?: boolean;
    fpsActive?: boolean;
    animating?: boolean;
    spawnPosition?: { x: number; z: number };
    /** False when the keep-alive museum is mounted but hidden. */
    visible?: boolean;
  }

  const props: Props = $props();
  const ctx = useThrelte();
  const performanceRecorder = getMuseumPerformanceRecorder();

  const getRenderer = (): WebGLRenderer | null => resolveRenderer(ctx);
  const getScene = (): Scene | null => resolveScene(ctx);
  const getCamera = (): Camera | null => resolveCamera(ctx);

  let configuredRenderer: WebGLRenderer | null = null;

  useTask(() => {
    if (props.visible === false) return;

    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();
    if (!renderer || !scene || !camera) return;

    if (configuredRenderer !== renderer) {
      configuredRenderer = renderer;
      try {
        (ctx as any).autoRender?.set?.(false);
      } catch {
        /* optional across Threlte versions */
      }
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    }

    const renderStartedAt = performanceRecorder.beginPhase();
    renderer.render(scene, camera);
    performanceRecorder.endPhase("render.main", renderStartedAt);
  });
</script>
