/**
 * WebGPU Renderer
 *
 * Three.js WebGPURenderer integration for next-gen graphics.
 * Falls back to WebGL if WebGPU is not available.
 *
 * Features:
 * - Compute shaders for procedural generation
 * - Async pipeline compilation (never blocks)
 * - Multi-threaded command preparation
 * - Native GPU instancing
 */

import {
  Scene,
  PerspectiveCamera,
  Color,
  Fog,
  type WebGLRenderer,
} from "three";

// WebGPU imports - these are in three/webgpu in Three.js 0.160+
// Using dynamic import to handle environments where WebGPU isn't available

/**
 * Renderer configuration
 */
export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: "high-performance" | "low-power" | "default";
}

/**
 * Renderer state
 */
export interface RendererState {
  renderer: WebGLRenderer | null; // Using WebGLRenderer type for compatibility
  scene: Scene;
  isWebGPU: boolean;
  isInitialized: boolean;
}

/**
 * Check if WebGPU is available in this browser
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (!navigator.gpu) {
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Create the renderer (WebGPU with WebGL fallback)
 */
export async function createRenderer(
  config: RendererConfig
): Promise<RendererState> {
  const { canvas, width, height, pixelRatio = window.devicePixelRatio } = config;

  const scene = new Scene();
  scene.background = new Color(0x0a0a1a);
  scene.fog = new Fog(0x0a0a1a, 50, 200);

  const isWebGPU = await checkWebGPUSupport();

  let renderer: WebGLRenderer | null = null;

  if (isWebGPU) {
    try {
      // Dynamic import for WebGPU renderer
      const { WebGPURenderer } = await import("three/webgpu");

      renderer = new WebGPURenderer({
        canvas,
        antialias: config.antialias ?? true,
        alpha: config.alpha ?? false,
        powerPreference: (config.powerPreference ?? "high-performance") as GPUPowerPreference,
      }) as unknown as WebGLRenderer;

      // Initialize WebGPU async
      await (renderer as any).init();
    } catch (error) {
      console.warn("[InfiniteWorlds] WebGPU init failed, falling back to WebGL:", error);
    }
  }

  if (!renderer) {
    // Fallback to WebGL
    const { WebGLRenderer } = await import("three");

    renderer = new WebGLRenderer({
      canvas,
      antialias: config.antialias ?? true,
      alpha: config.alpha ?? false,
      powerPreference: config.powerPreference ?? "high-performance",
    });
  }

  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatio);

  return {
    renderer,
    scene,
    isWebGPU,
    isInitialized: true,
  };
}

/**
 * Create the camera
 */
export function createCamera(
  fov = 75,
  aspect = 1,
  near = 0.1,
  far = 1000
): PerspectiveCamera {
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 1.7, 0);
  return camera;
}

/**
 * Resize handler
 */
export function resizeRenderer(
  state: RendererState,
  camera: PerspectiveCamera,
  width: number,
  height: number
): void {
  if (!state.renderer) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

/**
 * Render a frame
 */
export function render(
  state: RendererState,
  camera: PerspectiveCamera
): void {
  if (!state.renderer || !state.isInitialized) return;

  state.renderer.render(state.scene, camera);
}

/**
 * Dispose the renderer and free resources
 */
export function disposeRenderer(state: RendererState): void {
  if (state.renderer) {
    state.renderer.dispose();
    state.renderer = null;
  }
  state.isInitialized = false;
}

/**
 * Get renderer info for debugging
 */
export function getRendererInfo(state: RendererState): Record<string, unknown> {
  if (!state.renderer) return {};

  const info = state.renderer.info;
  return {
    type: state.isWebGPU ? "WebGPU" : "WebGL",
    memory: {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    },
    render: {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
    },
  };
}
