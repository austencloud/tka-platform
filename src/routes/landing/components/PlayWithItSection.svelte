<!--
  PlayWithItSection.svelte

  Infinite spinner showcase for the landing page. Lazy-loads the animation
  engine when scrolled into view, then renders an endless spinner driven by
  the app's real AnimationPanel (effects, props, effort, display, tempo).
-->
<script lang="ts">
  import type { Component } from "svelte";

  // Lazy-loaded heavy component - typed as Component<any> because the inner
  // component manages its own state and is rendered without props.
  let sectionEl: HTMLElement | undefined = $state();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let InnerComponent: Component<any> | null = $state(null);
  let loadFailed = $state(false);

  $effect(() => {
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          import("./PlayWithItInner.svelte")
            .then((mod) => {
              InnerComponent = mod.default;
            })
            .catch((err) => {
              console.error("[PlayWithItSection] Failed to load:", err);
              loadFailed = true;
            });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sectionEl);

    return () => observer.disconnect();
  });
</script>

<section class="play-section" bind:this={sectionEl} id="play-with-it">
  <h2>Infinite spinner</h2>
  <p class="subtitle">Switch effects, props, effort, and tempo with the same controls you get in the app.</p>

  {#if InnerComponent}
    <InnerComponent />
  {:else}
    <!-- Structural skeleton - same showcase proportions as PlayWithItInner.
         Stops pulsing if the lazy import failed (nothing is coming). -->
    <div class="showcase skeleton-showcase" class:load-failed={loadFailed} aria-hidden="true">
      <div class="sk-canvas"></div>
      <div class="sk-beat-strip">
        {#each { length: 5 } as _}
          <div class="sk-beat-cell"></div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .play-section {
    max-width: 1200px;
    margin: 0 auto;
    padding: 80px 24px;
    text-align: center;
  }

  h2 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 400;
    color: #f5f5f5;
    margin: 0 0 12px;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-min, 14px);
    margin: 0 0 40px;
    max-width: 480px;
    margin-inline: auto;
  }

  /* ── Skeleton showcase ───────────────────────────────────────────────────── */

  /*
   * Matches the .showcase container in PlayWithItInner exactly:
   * column-flex, max 800px, border-radius 16px, dark border + shadow.
   */
  .showcase {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* Canvas - square aspect-ratio matching .canvas-area */
  .sk-canvas {
    width: 100%;
    aspect-ratio: 1;
    max-height: 640px;
    background: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
  }

  /* Beat strip - same padding/height as the real strip */
  .sk-beat-strip {
    display: flex;
    gap: 6px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
    overflow: hidden;
  }

  /* Individual beat placeholder cells */
  .sk-beat-cell {
    flex: 0 0 72px;
    width: 72px;
    height: 72px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.06);
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skeleton-showcase {
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

  .skeleton-showcase.load-failed {
    animation: none;
  }

  @media (max-width: 600px) {
    .play-section {
      padding: 48px 16px;
    }

    .showcase {
      max-width: 100%;
      border-radius: 12px;
    }

    .sk-canvas {
      max-height: 400px;
    }

    .sk-beat-cell {
      flex: 0 0 56px;
      width: 56px;
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-showcase {
      animation: none;
    }
  }
</style>
