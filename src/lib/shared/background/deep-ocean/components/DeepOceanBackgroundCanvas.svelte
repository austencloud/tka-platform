<!--
  Deep Ocean Background Component
  
  Thin presentation wrapper that delegates all logic to the orchestrator service.
  This component only handles DOM binding and lifecycle events.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    Dimensions,
    QualityLevel,
  } from "$lib/shared/background/shared/domain/types/background-types";
  import { container } from "$lib/shared/di";
  import type { DeepOceanBackgroundOrchestrator } from "../services/DeepOceanBackgroundOrchestrator";

  // Props
  interface Props {
    dimensions: Dimensions;
    quality?: QualityLevel;
    paused?: boolean;
  }

  const { dimensions, quality = "medium", paused = false }: Props = $props();

  // Canvas element
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  // Service (resolved via DI)
  let backgroundSystem: DeepOceanBackgroundOrchestrator | null = null;

  // Animation frame tracking
  let animationFrame: number | null = null;
  let lastFrameTime = 0;

  onMount(async () => {
    try {
      // Get orchestrator from ITI container
      backgroundSystem = container.items.deepOceanBackgroundSystem;

      // Initialize canvas context
      ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas 2D context");
        return;
      }

      // Initialize the background system
      await backgroundSystem.initialize(dimensions, quality);

      // Start animation loop
      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Deep Ocean background:", error);
    }
  });

  onDestroy(() => {
    stopAnimation();
    backgroundSystem?.cleanup();
  });

  // Maximum delta time cap - prevents teleporting after HMR/tab switch
  const MAX_DELTA_MS = 100;

  function startAnimation() {
    if (!backgroundSystem || !ctx || paused) return;

    const animate = (currentTime: number) => {
      if (!backgroundSystem || !ctx) return;

      // Calculate delta time with proper first-frame handling
      // First frame has no reference point, use ideal 60fps frame time
      const rawDelta = lastFrameTime === 0 ? 16.67 : currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Clamp to prevent teleporting after tab visibility change or HMR
      const deltaTime = Math.min(rawDelta, MAX_DELTA_MS);
      const frameMultiplier = deltaTime / 16.67; // Normalize to 60fps

      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Update and draw
      backgroundSystem.update(dimensions, frameMultiplier);
      backgroundSystem.draw(ctx, dimensions);

      // Continue animation
      if (!paused) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  // Reactive updates
  $effect(() => {
    if (backgroundSystem) {
      backgroundSystem.setQuality(quality);
    }
  });

  $effect(() => {
    if (paused) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  $effect(() => {
    // Handle dimension changes
    if (backgroundSystem && canvas) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      backgroundSystem.handleResize?.(dimensions, dimensions);
    }
  });
</script>

<canvas
  bind:this={canvas}
  width={dimensions.width}
  height={dimensions.height}
  style:width="{dimensions.width}px"
  style:height="{dimensions.height}px"
>
  <!-- Fallback content for browsers without canvas support -->
  <div
    class="fallback-gradient"
    style:width="{dimensions.width}px"
    style:height="{dimensions.height}px"
  >
    <div class="gradient-ocean"></div>
  </div>
</canvas>

<style>
  canvas {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
  }

  .fallback-gradient {
    background: linear-gradient(
      to bottom,
      #0d2d47 0%,
      #1a3a4a 30%,
      #0f2535 70%,
      #091a2b 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
  }

  .gradient-ocean {
    color: rgba(135, 206, 250, 0.3);
    font-size: 1.2em;
    text-align: center;
  }

  .gradient-ocean::before {
    content: "🌊 Deep Ocean Environment";
  }
</style>
