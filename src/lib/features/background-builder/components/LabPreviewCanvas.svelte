<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  /**
   * Shared canvas preview component for Background Builder Labs.
   * Handles canvas lifecycle, animation loop, resize, and loading state.
   */

  interface BackgroundSystem {
    update(dimensions: { width: number; height: number }, frameMultiplier: number): void;
    draw(ctx: CanvasRenderingContext2D, dimensions: { width: number; height: number }): void;
    cleanup?(): void;
    handleResize?(oldDimensions: { width: number; height: number }, newDimensions: { width: number; height: number }): void;
  }

  interface Props {
    /** The background system instance to animate */
    system: BackgroundSystem | null;
    /** Whether the system is still loading/initializing */
    isLoading?: boolean;
    /** Accent color for the loading spinner (CSS color value) */
    accentColor?: string;
    /** Background color for the canvas container */
    backgroundColor?: string;
    /** Optional callback for mouse move events */
    onMouseMove?: (event: MouseEvent) => void;
    /** Optional callback for mouse leave events */
    onMouseLeave?: () => void;
    /** Optional callback for click/activation events (pointer or keyboard) */
    onClick?: (event: MouseEvent | KeyboardEvent) => void;
    /** Optional callback called each frame with current stats */
    onFrame?: () => void;
    /** Optional callback when canvas is ready with dimensions */
    onCanvasReady?: (dimensions: { width: number; height: number }) => void;
  }

  let {
    system,
    isLoading = false,
    accentColor = "#a78bfa",
    backgroundColor = "rgba(15, 15, 25, 0.9)",
    onMouseMove,
    onMouseLeave,
    onClick,
    onFrame,
    onCanvasReady,
  }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;
  let initialized = false;

  function startAnimation() {
    if (!canvas || !system) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      // Guard against destroyed component or missing system
      if (!canvas || !system) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };
      system.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      system.draw(ctx, dimensions);

      // Notify parent for stats updates
      onFrame?.();

      animationFrame = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function handleResize() {
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };
      system?.handleResize?.(oldDimensions, newDimensions);
    }
  }

  function initializeCanvas() {
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
  }

  // Watch for system changes to start/stop animation
  $effect(() => {
    if (system && canvas && initialized) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });

  onMount(() => {
    initializeCanvas();
    initialized = true;
    window.addEventListener("resize", handleResize);

    // Notify parent that canvas is ready with dimensions
    if (canvas) {
      onCanvasReady?.({ width: canvas.width, height: canvas.height });
    }
  });

  onDestroy(() => {
    stopAnimation();
    window.removeEventListener("resize", handleResize);
  });

  // Expose canvas for parent components that need direct access
  export function getCanvas(): HTMLCanvasElement | null {
    return canvas;
  }

  export function getDimensions(): { width: number; height: number } {
    return canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 };
  }
</script>

<div
  class="preview"
  style:--accent-color={accentColor}
  style:--bg-color={backgroundColor}
  onmousemove={onMouseMove}
  onmouseleave={onMouseLeave}
  onclick={onClick}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
  role="button"
  tabindex="0"
  aria-label="Lab preview canvas"
>
  {#if isLoading}
    <div class="loading-overlay">
      <i class="fas fa-spinner fa-spin"></i>
      <span>Loading preview...</span>
    </div>
  {/if}
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-color);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    height: 100%;
    min-height: 400px;
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--bg-color);
    color: var(--accent-color);
    font-size: var(--font-size-min, 0.875rem);
    z-index: 10;
  }

  .loading-overlay i {
    font-size: 1.5rem;
  }

  /* Accessibility: High contrast */
  @media (prefers-contrast: high) {
    .preview {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
  }
</style>
