<!--
  PlayWithItSection.svelte

  Infinite spinner showcase for the landing page. Lazy-loads the animation
  engine when scrolled into view, then renders an endless spinner driven by
  the app's real AnimationPanel (effects, props, effort, display, tempo).
-->
<script lang="ts">
  import type { Component } from "svelte";
  import PlayWithItSkeleton from "./PlayWithItSkeleton.svelte";

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
    <!-- Structural skeleton — same footprint as PlayWithItInner at every
         breakpoint (shared with the /composer host so both stay in sync).
         Stops pulsing if the lazy import failed (nothing is coming). -->
    <PlayWithItSkeleton failed={loadFailed} />
  {/if}
</section>

<style>
  .play-section {
    max-width: 1600px;
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

  /* 4K / ultrawide: heading scale to match the rest of the scaled page. */
  @media (min-width: 2200px) {
    h2 {
      font-size: 3.6rem;
    }

    .subtitle {
      font-size: 1.1rem;
      max-width: 560px;
      margin-bottom: 48px;
    }
  }

  @media (max-width: 600px) {
    /* On phones the spinner is a full-viewport "moment": heading + spinner +
       progress foot + beat strip + control dock all fit on screen at once, no
       scrolling within the section. The section fills the small-viewport height;
       the top padding clears the fixed 57px site header. The canvas (in
       PlayWithItInner) flexes to consume whatever the fixed-height strip + dock
       leave. */
    .play-section {
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      padding: calc(env(safe-area-inset-top, 0px) + 69px) 16px
        calc(env(safe-area-inset-bottom, 0px) + 14px);
      gap: 10px;
    }

    h2 {
      font-size: clamp(1.5rem, 7vw, 2rem);
      margin: 0;
    }

    .subtitle {
      margin: 0;
    }
  }
</style>
