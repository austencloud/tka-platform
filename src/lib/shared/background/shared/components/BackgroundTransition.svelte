<!--
BackgroundTransition.svelte - Smooth gradient transitions for background changes
Uses a crossfade technique with two layers to animate between gradients
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { BACKGROUND_GRADIENTS } from "../domain/constants/BackgroundGradients";
  import type { BackgroundType } from "../domain/enums/background-enums";

  let { currentBackground } = $props<{
    currentBackground: BackgroundType;
  }>();

  // Track previous and current gradients for crossfade
  let previousGradient = $state<string>("");
  let currentGradient = $state<string>("");
  let isTransitioning = $state(false);
  let transitionKey = $state(0);

  // Watch for background changes and set initial value
  $effect(() => {
    const newGradient =
      BACKGROUND_GRADIENTS[currentBackground as BackgroundType] || "";

    // First render or change - update gradient
    if (currentGradient === "" || newGradient !== currentGradient) {
      // Store previous gradient
      previousGradient = currentGradient;
      currentGradient = newGradient;
      isTransitioning = true;
      transitionKey += 1;

      // Reset transition state after animation completes
      setTimeout(() => {
        isTransitioning = false;
      }, 800);
    }
  });
</script>

<!-- Fixed background container -->
<div class="background-transition-container">
  <!-- Previous gradient layer (fades out) -->
  {#if isTransitioning && previousGradient}
    {#key transitionKey - 1}
      <div
        class="background-layer previous"
        style="background: {previousGradient};"
        transition:fade={{ duration: 800 }}
      ></div>
    {/key}
  {/if}

  <!-- Current gradient layer (always visible or fades in) -->
  {#key transitionKey}
    <div
      class="background-layer current"
      style="background: {currentGradient};"
      in:fade={{ duration: 800, delay: 0 }}
    ></div>
  {/key}
</div>

<style>
  .background-transition-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    pointer-events: none;
  }

  .background-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-attachment: fixed;
    background-size: 400% 400%;
  }

  /* Gradient shift animation - only when motion is OK */
  @media (prefers-reduced-motion: no-preference) {
    .background-layer {
      animation: gradientShift 15s ease infinite;
    }
  }

  .background-layer.previous {
    z-index: 1;
  }

  .background-layer.current {
    z-index: 2;
  }

  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .background-layer {
      animation: none;
    }
  }
</style>
