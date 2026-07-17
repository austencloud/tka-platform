<!--
  LazyHowTkaWorksSection.svelte

  Lazy wrapper around HowTkaWorksSection. Shows a visible skeleton while loading,
  then dynamically imports and mounts the real section. Handles its own reveal
  animation (not gated behind scroll-reveal) to avoid double-observer issues on iOS.
-->
<script lang="ts">
  import type { Component } from "svelte";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let InnerComponent: Component<any> | null = $state(null);
  let loadFailed = $state(false);
  let isLoading = $state(false);
  let revealed = $state(false);
  let sectionEl: HTMLElement | undefined = $state();

  function loadComponent() {
    if (isLoading || InnerComponent) return;
    isLoading = true;
    loadFailed = false;

    import("./HowTkaWorksSection.svelte")
      .then((mod) => {
        InnerComponent = mod.default;
      })
      .catch((err) => {
        console.error("[LazyHowTkaWorksSection] Failed to load:", err);
        loadFailed = true;
      })
      .finally(() => {
        isLoading = false;
      });
  }

  $effect(() => {
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          revealed = true;
          loadComponent();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sectionEl);

    return () => observer.disconnect();
  });
</script>

<!-- id anchors the FAQ's "Watch a sequence build" CTA (/#how-it-works); it lives
     on this always-present wrapper, not the lazily-mounted inner section, so the
     anchor resolves even before the section loads. -->
<div bind:this={sectionEl} class="lazy-section" class:revealed id="how-it-works">
  {#if InnerComponent}
    <InnerComponent />
  {:else if loadFailed}
    <div class="how-section-placeholder" aria-label="Failed to load section">
      <p class="placeholder-message">Couldn't load this section.</p>
      <button class="retry-btn" onclick={loadComponent}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        Try again
      </button>
    </div>
  {:else}
    <!-- Structural skeleton - visible pulsing cards while loading -->
    <div class="how-section-skeleton skeleton-pulse" aria-hidden="true">
      <div class="sk-grid">
        {#each { length: 6 } as _}
          <div class="sk-card"></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .lazy-section {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  .lazy-section.revealed {
    opacity: 1;
    transform: translateY(0);
  }

  .how-section-skeleton {
    max-width: 1400px;
    margin: 0 auto;
    padding: 80px 24px;
  }

  /* Single 6-column row matching the real card layout (gap clamp mirrors
     HowTkaWorksSection so the skeleton doesn't jump on swap) */
  .sk-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: clamp(10px, 1.3vw, 16px);
  }

  /* Each card: visible enough that users know content is loading */
  .sk-card {
    aspect-ratio: 0.85;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skeleton-pulse {
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

  /* Error / retry state */
  .how-section-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    text-align: center;
  }

  .placeholder-message {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    margin: 0;
  }

  .retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 919px) {
    .sk-grid {
      display: flex;
      overflow: hidden;
      gap: 14px;
    }

    .sk-card {
      flex: 0 0 220px;
    }
  }

  @media (max-width: 768px) {
    .how-section-skeleton {
      padding: 48px 16px;
    }

    .sk-card {
      flex-basis: 200px;
    }

    .how-section-placeholder {
      padding: 48px 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lazy-section {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .skeleton-pulse {
      animation: none;
    }
  }
</style>
