<script lang="ts">
  /**
   * LazyLandingDemo
   *
   * IntersectionObserver wrapper that defers loading of LandingAnimationDemo
   * until the section scrolls into the viewport. This keeps the DI container,
   * Firebase, animation engine, and Three.js out of the landing page's initial
   * bundle. A lightweight placeholder is shown until the real component loads.
   */
  import type { Component } from "svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    onPropTypeChange?: (propType: PropType) => void;
  }

  let { onPropTypeChange }: Props = $props();

  let containerEl: HTMLElement | undefined = $state();
  let DemoComponent = $state<Component | null>(null);
  let loadFailed = $state(false);

  $effect(() => {
    if (!containerEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          import("./LandingAnimationDemo.svelte")
            .then((mod) => {
              DemoComponent = mod.default;
            })
            .catch((err) => {
              console.error("[LazyLandingDemo] Failed to load:", err);
              loadFailed = true;
            });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(containerEl);

    return () => observer.disconnect();
  });
</script>

<div bind:this={containerEl} class="lazy-demo-container">
  {#if DemoComponent}
    <DemoComponent {onPropTypeChange} />
  {:else if loadFailed}
    <div class="demo-placeholder">
      <div class="placeholder-icon">🌀</div>
      <span>Animation preview unavailable</span>
    </div>
  {:else}
    <div class="demo-placeholder">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <span>Loading animation...</span>
    </div>
  {/if}
</div>

<style>
  .lazy-demo-container {
    display: flex;
    justify-content: center;
    width: 100%;
    min-height: 480px;
  }

  .demo-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    width: clamp(380px, 60vw, 600px);
    height: clamp(380px, 60vw, 600px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .placeholder-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  @media (max-width: 600px) {
    .lazy-demo-container {
      min-height: min(380px, 90vw);
    }

    .demo-placeholder {
      width: min(380px, 90vw);
      height: min(380px, 90vw);
    }
  }

</style>
