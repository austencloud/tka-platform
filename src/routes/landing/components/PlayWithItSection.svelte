<!--
  PlayWithItSection.svelte

  Interactive effects showcase for the landing page. Lazy-loads the animation
  engine when scrolled into view, then renders an endless spinner with effect
  chips (Clean, Trails, Fire, LEDs) and a prop switcher. Desktop shows a
  beat-grid side panel; mobile shows a horizontal beat strip below the canvas.
-->
<script lang="ts">
  import type { Component } from "svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  // Lazy-loaded heavy component
  let sectionEl: HTMLElement | undefined = $state();
  let InnerComponent = $state<Component<{ onEffectChange?: (effect: string) => void; onPropChange?: (propType: PropType) => void }> | null>(null);
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
  <h2>Play with it</h2>
  <p class="subtitle">Toggle effects, swap props, watch the notation update in real time.</p>

  {#if InnerComponent}
    <InnerComponent />
  {:else if loadFailed}
    <div class="placeholder">
      <div class="placeholder-icon">🌀</div>
      <span>Animation preview unavailable</span>
    </div>
  {:else}
    <div class="placeholder">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <span>Loading animation...</span>
    </div>
  {/if}
</section>

<style>
  .play-section {
    max-width: 1100px;
    margin: 0 auto;
    padding: 80px 24px;
    text-align: center;
  }

  h2 {
    font-family: "Instrument Serif", Georgia, serif;
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

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    width: clamp(340px, 60vw, 560px);
    height: clamp(340px, 60vw, 560px);
    margin: 0 auto;
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
    .play-section {
      padding: 48px 16px;
    }

    .placeholder {
      width: min(340px, 90vw);
      height: min(340px, 90vw);
    }
  }
</style>
