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
  import { WebGLRenderer } from "three";
  import type { RenderingBackend } from "../state/gallery-settings.svelte";
  import { isWebGPUSupported } from "$lib/shared/3d-core/rendering/create-renderer";

  interface Props {
    /** Rendering backend preference */
    renderingBackend: RenderingBackend;
    /** Whether to enable auto-rendering */
    autoRender?: boolean;
    /** Tone mapping setting */
    toneMapping?: number;
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

      // Initialize WebGPU async - Three.js queues renders until ready
      renderer.init().then(() => {
        console.info("[GalleryCanvas] WebGPU renderer initialized");
      }).catch((error: Error) => {
        console.error("[GalleryCanvas] WebGPU init failed:", error);
      });

      return renderer as unknown as WebGLRenderer;
    }

    // Standard WebGL renderer
    return new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  }
</script>

{#if isReady}
  <Canvas {autoRender} {toneMapping} {createRenderer}>
    {@render children()}
  </Canvas>
{:else}
  <!-- Loading state while checking WebGPU support -->
  <div class="canvas-loading">
    <div class="spinner"></div>
    <span>Initializing renderer...</span>
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

  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
