<script lang="ts">
  /**
   * GalleryCanvas
   *
   * Threlte Canvas wrapper that enables WebGPU rendering when available.
   * Checks WebGPU support before mounting Canvas, then passes the appropriate
   * renderer factory.
   */

  import { Canvas } from "@threlte/core";
  import { type Snippet } from "svelte";
  import { WebGLRenderer, PCFSoftShadowMap, type ToneMapping } from "three";
  import type { RenderingBackend } from "../state/gallery-settings.svelte";
  import { isWebGPUSupported } from "$lib/shared/3d/rendering/create-renderer";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    /** Rendering backend preference */
    renderingBackend: RenderingBackend;
    /** Whether to enable auto-rendering */
    autoRender?: boolean;
    /** Tone mapping setting (Three.js constant) */
    toneMapping?: ToneMapping;
    /** Children snippet */
    children: Snippet;
  }

  let { renderingBackend, autoRender = true, toneMapping, children }: Props = $props();

  // Resolved state after async WebGPU check
  let isReady = $state(false);
  let shouldUseWebGPU = $state(false);
  let activeRenderer = $state<"WebGL" | "WebGPU">("WebGL");

  // Pre-loaded WebGPU module (if available)
  let WebGPURendererClass: typeof import("three/webgpu").WebGPURenderer | null = null;

  // Check WebGPU support and pre-load the module
  async function initializeRendererSupport() {
    if (renderingBackend !== "webgpu-auto") {
      isReady = true;
      return;
    }

    const hasWebGPU = await isWebGPUSupported();
    if (!hasWebGPU) {
      console.info("[GalleryCanvas] WebGPU not available, using WebGL");
      isReady = true;
      return;
    }

    try {
      // Pre-load WebGPU module before mounting Canvas
      const module = await import("three/webgpu");
      WebGPURendererClass = module.WebGPURenderer;
      shouldUseWebGPU = true;
      activeRenderer = "WebGPU";
      console.info("[GalleryCanvas] WebGPU available and loaded");
    } catch (error) {
      console.warn("[GalleryCanvas] Failed to load WebGPU module:", error);
    }

    isReady = true;
  }

  // Start initialization immediately
  initializeRendererSupport();

  /**
   * Synchronous renderer factory for Threlte.
   * Creates WebGPU renderer if supported and pre-loaded, otherwise WebGL.
   */
  function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    if (shouldUseWebGPU && WebGPURendererClass) {
      const renderer = new WebGPURendererClass({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance" as GPUPowerPreference,
      });

      // Enable shadow maps
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;

      // Initialize WebGPU async - Three.js queues renders until ready
      renderer.init().then(() => {
        console.info("[GalleryCanvas] WebGPU renderer initialized");
      }).catch((error: Error) => {
        console.error("[GalleryCanvas] WebGPU init failed:", error);
      });

      return renderer as unknown as WebGLRenderer;
    }

    // Standard WebGL renderer
    const glRenderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    // Enable shadow maps
    glRenderer.shadowMap.enabled = true;
    glRenderer.shadowMap.type = PCFSoftShadowMap;

    return glRenderer;
  }
</script>

{#if isReady}
  <Canvas {autoRender} {toneMapping} {createRenderer}>
    {@render children()}
  </Canvas>
{:else}
  <!-- Loading state while checking WebGPU support -->
  <div class="canvas-loading">
    <ProgressRing percent={-1} size={32} strokeWidth={3} />
    <span>{t("gallery_initializing_renderer")}</span>
  </div>
{/if}

<style>
  .canvas-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #0a0a1a;
    color: rgba(255, 255, 255, 0.7);
    gap: 12px;
  }

</style>
