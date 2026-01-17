<!--
Background Canvas with True Crossfade

Uses two canvas layers to achieve a real crossfade effect where both
backgrounds are visible simultaneously during the transition.
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import type {
    BackgroundSystem,
    PerformanceMetrics,
  } from "../domain/models/background-models";
  import { BackgroundType } from "../domain/enums/background-enums";
  import type { QualityLevel } from "../domain/types/background-types";
  import { BackgroundFactory } from "../services/implementations/BackgroundFactory";

  // Props
  const {
    backgroundType = "solidColor" as BackgroundType,
    quality = "medium" as QualityLevel,
    backgroundColor = "#000000",
    gradientColors,
    gradientDirection,
    thumbnailMode = false,
    onReady,
    onPerformanceReport,
  } = $props<{
    backgroundType?: BackgroundType;
    quality?: QualityLevel;
    backgroundColor?: string;
    gradientColors?: string[];
    gradientDirection?: number;
    thumbnailMode?: boolean;
    onReady?: () => void;
    onPerformanceReport?: (metrics: PerformanceMetrics) => void;
  }>();

  // Dual canvas system for true crossfade
  let canvasA: HTMLCanvasElement;
  let canvasB: HTMLCanvasElement;
  let activeCanvas = $state<"A" | "B">("A");

  // Background systems for each canvas
  let systemA: BackgroundSystem | null = null;
  let systemB: BackgroundSystem | null = null;
  let animationIdA: number | null = null;
  let animationIdB: number | null = null;

  // State
  let isInitialized = $state(false);
  let isTransitioning = $state(false);
  let resizeObserver: ResizeObserver | null = null;

  // Track background types
  let currentBackgroundType: BackgroundType | null = null;
  let targetBackgroundType: BackgroundType | null = null;

  // Some backgrounds use fixed positioning (they look awkward when stretched)
  // All other backgrounds scroll with content (looks better for gradients, particles)
  let isFixedPosition = $derived(
    backgroundType === BackgroundType.FIREFLY_FOREST ||
    backgroundType === BackgroundType.PRIDE
  );

  // Create background system when props change
  $effect(() => {
    if (!browser || !canvasA || !canvasB) {
      return;
    }

    const isFirstLoad = currentBackgroundType === null;
    const typeChanged = currentBackgroundType !== backgroundType;
    const alreadyTransitioningToThis = targetBackgroundType === backgroundType;

    // Skip if we're already transitioning to this type or same type
    if (alreadyTransitioningToThis || !typeChanged) {
      return;
    }

    // If currently transitioning, update target but don't interrupt
    if (isTransitioning) {
      targetBackgroundType = backgroundType;
      return;
    }

    // First load - initialize directly on canvas A
    if (isFirstLoad) {
      initializeFirstBackground(backgroundType, quality);
      return;
    }

    // Type changed - do a true crossfade
    targetBackgroundType = backgroundType;
    performCrossfade(backgroundType, quality);
  });

  // Initialize the first background (no transition needed)
  async function initializeFirstBackground(
    type: BackgroundType,
    bgQuality: QualityLevel
  ) {
    const canvas = canvasA;
    const system = await BackgroundFactory.createBackgroundSystem({
      type,
      quality: bgQuality,
      initialQuality: bgQuality,
      thumbnailMode,
      backgroundColor,
      gradientColors,
      gradientDirection,
    });

    systemA = system;
    currentBackgroundType = type;
    activeCanvas = "A";

    setupCanvasDimensions(canvas);
    system.initialize(
      { width: canvas.width, height: canvas.height },
      bgQuality
    );
    startAnimation("A");
  }

  // True crossfade: new background fades in on top of old
  async function performCrossfade(
    newType: BackgroundType,
    bgQuality: QualityLevel
  ) {
    isTransitioning = true;

    // Determine which canvas to use for the new background
    const incomingCanvas = activeCanvas === "A" ? "B" : "A";
    const canvas = incomingCanvas === "A" ? canvasA : canvasB;

    // Create new background system on the inactive canvas
    const newSystem = await BackgroundFactory.createBackgroundSystem({
      type: newType,
      quality: bgQuality,
      initialQuality: bgQuality,
      thumbnailMode,
      backgroundColor,
      gradientColors,
      gradientDirection,
    });

    // Set up the new canvas and initialize the system
    setupCanvasDimensions(canvas);
    newSystem.initialize(
      { width: canvas.width, height: canvas.height },
      bgQuality
    );

    // Store the new system
    if (incomingCanvas === "A") {
      systemA = newSystem;
    } else {
      systemB = newSystem;
    }

    // Start the animation on the new canvas
    startAnimation(incomingCanvas);

    // CRITICAL: Wait for the new background to render at least one frame
    // before starting the crossfade. This ensures both backgrounds are
    // fully visible during the transition.
    await new Promise((resolve) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      })
    );

    // NOW trigger the crossfade (both canvases animating simultaneously)
    activeCanvas = incomingCanvas;

    // Wait for CSS transition to complete (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Cleanup the old system
    if (incomingCanvas === "A") {
      // We're now on A, so cleanup B
      stopAnimation("B");
      if (systemB) {
        systemB.cleanup();
        systemB = null;
      }
    } else {
      // We're now on B, so cleanup A
      stopAnimation("A");
      if (systemA) {
        systemA.cleanup();
        systemA = null;
      }
    }

    currentBackgroundType = newType;
    isTransitioning = false;

    // Check if target changed during transition
    if (targetBackgroundType && targetBackgroundType !== newType) {
      const nextType = targetBackgroundType;
      targetBackgroundType = null;
      performCrossfade(nextType, bgQuality);
    } else {
      targetBackgroundType = null;
    }
  }

  // Animation loop for a specific canvas
  function startAnimation(which: "A" | "B") {
    const canvas = which === "A" ? canvasA : canvasB;
    const system = which === "A" ? systemA : systemB;

    if (!canvas || !system) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // OPTIMIZATION: Skip animation loop for static backgrounds (solid color/gradient)
    // These backgrounds don't animate, so we just render once and exit
    const isStaticBackground =
      backgroundType === "solid-color" || backgroundType === "linear-gradient";
    if (isStaticBackground) {
      // Render once and skip the animation loop
      const dimensions = { width: canvas.width, height: canvas.height };
      system.draw(ctx, dimensions);
      return;
    }

    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      const currentSystem = which === "A" ? systemA : systemB;
      if (!currentSystem || !canvas) return;

      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const targetFrameTime = 1000 / 60;
      const frameMultiplier = deltaTime > 0 ? deltaTime / targetFrameTime : 1.0;

      const dimensions = { width: canvas.width, height: canvas.height };

      currentSystem.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      currentSystem.draw(ctx, dimensions);

      if (onPerformanceReport && which === activeCanvas) {
        const actualFPS = deltaTime > 0 ? Math.round(1000 / deltaTime) : 60;
        onPerformanceReport({ fps: actualFPS, warnings: [] });
      }

      if (which === "A") {
        animationIdA = requestAnimationFrame(animate);
      } else {
        animationIdB = requestAnimationFrame(animate);
      }
    };

    if (which === "A") {
      animationIdA = requestAnimationFrame(animate);
    } else {
      animationIdB = requestAnimationFrame(animate);
    }
  }

  function stopAnimation(which: "A" | "B") {
    if (which === "A" && animationIdA) {
      cancelAnimationFrame(animationIdA);
      animationIdA = null;
    } else if (which === "B" && animationIdB) {
      cancelAnimationFrame(animationIdB);
      animationIdB = null;
    }
  }

  // Mount lifecycle
  onMount(() => {
    if (!browser || !canvasA || !canvasB) return;

    // Set up ResizeObserver
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvasA);
    }

    isInitialized = true;
    onReady?.();
  });

  // Cleanup
  onDestroy(() => {
    stopAnimation("A");
    stopAnimation("B");
    systemA?.cleanup();
    systemB?.cleanup();
    resizeObserver?.disconnect();
  });

  // Set up canvas dimensions
  function setupCanvasDimensions(canvas: HTMLCanvasElement) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // Handle resize for both canvases
  function handleResize() {
    if (canvasA) {
      const rect = canvasA.getBoundingClientRect();
      const newDimensions = { width: rect.width, height: rect.height };

      if (
        canvasA.width !== newDimensions.width ||
        canvasA.height !== newDimensions.height
      ) {
        canvasA.width = newDimensions.width;
        canvasA.height = newDimensions.height;
        canvasB.width = newDimensions.width;
        canvasB.height = newDimensions.height;

        if (systemA) {
          systemA.handleResize?.({ width: 0, height: 0 }, newDimensions);
        }
        if (systemB) {
          systemB.handleResize?.({ width: 0, height: 0 }, newDimensions);
        }
      }
    }
  }
</script>

<div class="background-container" class:initialized={isInitialized} class:fixed={isFixedPosition}>
  <canvas
    bind:this={canvasA}
    class="background-canvas canvas-a"
    class:active={activeCanvas === "A"}
    aria-hidden="true"
  ></canvas>
  <canvas
    bind:this={canvasB}
    class="background-canvas canvas-b"
    class:active={activeCanvas === "B"}
    aria-hidden="true"
  ></canvas>
</div>

<style>
  .background-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    opacity: 0;
    transition: opacity var(--duration-emphasis) ease-in-out;
  }

  .background-container.initialized {
    opacity: 1;
  }

  /* Fixed positioning for backgrounds that don't look good stretched (e.g., Firefly Forest) */
  .background-container.fixed {
    position: fixed;
  }

  .background-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
  }

  .background-canvas.active {
    opacity: 1;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .background-container,
    .background-canvas {
      transition: none;
    }
  }
</style>
