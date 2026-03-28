<!--
  LazyHowTkaWorksSection.svelte

  Lazy wrapper around HowTkaWorksSection. Shows a 3+3 grid skeleton matching
  the real section layout while waiting for the component to enter the viewport,
  then dynamically imports and mounts it.
-->
<script lang="ts">
  import type { Component } from "svelte";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let InnerComponent: Component<any> | null = $state(null);
  let loadFailed = $state(false);
  let sectionEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          import("./HowTkaWorksSection.svelte")
            .then((mod) => {
              InnerComponent = mod.default;
            })
            .catch((err) => {
              console.error("[LazyHowTkaWorksSection] Failed to load:", err);
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

<div bind:this={sectionEl}>
  {#if InnerComponent}
    <InnerComponent />
  {:else if loadFailed}
    <!-- Fallback: keep skeleton visible rather than a blank gap -->
    <div class="how-section-skeleton" aria-hidden="true">
      <div class="sk-heading"></div>
      <div class="sk-grid">
        {#each { length: 6 } as _}
          <div class="sk-card"></div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Structural skeleton — 3+3 card grid matching HowTkaWorksSection layout -->
    <div class="how-section-skeleton skeleton-pulse" aria-hidden="true">
      <div class="sk-heading"></div>
      <div class="sk-grid">
        {#each { length: 6 } as _}
          <div class="sk-card"></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .how-section-skeleton {
    max-width: 1100px;
    margin: 0 auto;
    padding: 80px 24px;
  }

  /* Heading placeholder — matches "How TKA works" h2 height */
  .sk-heading {
    height: 48px;
    width: 300px;
    max-width: 80%;
    margin: 0 auto 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
  }

  /* 3-column grid matching the real card layout */
  .sk-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 48px;
  }

  /* Each card: square-ish ratio to match pictograph cards */
  .sk-card {
    aspect-ratio: 0.85;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skeleton-pulse {
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

  @media (max-width: 768px) {
    .how-section-skeleton {
      padding: 48px 16px;
    }

    .sk-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .sk-heading {
      height: 36px;
    }
  }

  @media (max-width: 480px) {
    .sk-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-pulse {
      animation: none;
    }
  }
</style>
