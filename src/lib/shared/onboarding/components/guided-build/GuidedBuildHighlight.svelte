<!--
  GuidedBuildHighlight.svelte

  Renders a subtle highlight ring around the target element.
  pointer-events: none so user can interact through it.
  Repositions on window resize.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  let {
    targetElement = null,
  } = $props<{
    targetElement: HTMLElement | null;
  }>();

  let ringX = $state(0);
  let ringY = $state(0);
  let ringWidth = $state(0);
  let ringHeight = $state(0);
  let visible = $state(false);

  function updatePosition() {
    if (!targetElement) {
      visible = false;
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const PAD = 6;

    ringX = rect.left - PAD;
    ringY = rect.top - PAD;
    ringWidth = rect.width + PAD * 2;
    ringHeight = rect.height + PAD * 2;
    visible = true;
  }

  $effect(() => {
    if (targetElement) {
      updatePosition();
    } else {
      visible = false;
    }
  });

  onMount(() => {
    updatePosition();

    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });
</script>

{#if visible}
  <div
    class="guided-highlight"
    style="
      left: {ringX}px;
      top: {ringY}px;
      width: {ringWidth}px;
      height: {ringHeight}px;
    "
    transition:fade={{ duration: 200 }}
    aria-hidden="true"
  ></div>
{/if}

<style>
  .guided-highlight {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    border: 2px solid var(--theme-accent, #818cf8);
    border-radius: 12px;
    box-shadow: 0 0 16px color-mix(in srgb, var(--theme-accent, #818cf8) 30%, transparent);
    animation: highlight-pulse 2s ease-in-out infinite;
  }

  @keyframes highlight-pulse {
    0%, 100% {
      box-shadow: 0 0 16px color-mix(in srgb, var(--theme-accent, #818cf8) 30%, transparent);
    }
    50% {
      box-shadow: 0 0 24px color-mix(in srgb, var(--theme-accent, #818cf8) 50%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guided-highlight {
      animation: none;
    }
  }
</style>
