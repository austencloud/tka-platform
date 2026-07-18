<!--
  Lazy wrapper around HowTkaWorksSection. The placeholder reserves the same
  intro, stage, and rail geometry as the loaded Assembly Table.
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
      .catch((error) => {
        console.error("[LazyHowTkaWorksSection] Failed to load:", error);
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
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        revealed = true;
        loadComponent();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<!-- The anchor remains available before the inner component is imported. -->
<div
  bind:this={sectionEl}
  class="lazy-section"
  class:revealed
  id="how-it-works"
>
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
    <div class="how-section-skeleton skeleton-pulse" aria-hidden="true">
      <div class="sk-intro">
        <div class="sk-kicker"></div>
        <div class="sk-heading"></div>
        <div class="sk-copy"></div>
      </div>
      <div class="sk-assembly">
        <div class="sk-stage"></div>
        <div class="sk-rail">
          {#each { length: 6 } as _}
            <div class="sk-step">
              <i></i>
              <span></span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .lazy-section {
    opacity: 0;
    transform: translateY(32px);
    transition:
      opacity 0.7s ease,
      transform 0.7s ease;
  }

  .lazy-section.revealed {
    opacity: 1;
    transform: translateY(0);
  }

  .how-section-skeleton {
    --sk-line: rgba(255, 255, 255, 0.17);
    --sk-surface: rgba(255, 255, 255, 0.08);
    --sk-surface-strong: rgba(255, 255, 255, 0.12);

    box-sizing: border-box;
    width: min(calc(100% - 48px), 1480px);
    margin: 0 auto;
    padding: 88px 0 96px;
  }

  .sk-intro {
    max-width: 720px;
    margin-bottom: clamp(36px, 5vw, 60px);
  }

  .sk-kicker,
  .sk-heading,
  .sk-copy,
  .sk-stage,
  .sk-step span {
    background: var(--sk-surface);
  }

  .sk-kicker {
    width: 116px;
    height: 11px;
    margin-bottom: 16px;
    border-radius: 3px;
  }

  .sk-heading {
    width: min(390px, 64%);
    height: clamp(46px, 5vw, 68px);
    border-radius: 8px;
  }

  .sk-copy {
    width: min(620px, 86%);
    height: 18px;
    margin-top: 22px;
    border-radius: 4px;
  }

  .sk-assembly {
    display: grid;
    grid-template-columns: minmax(0, 1.58fr) minmax(320px, 0.62fr);
    align-items: stretch;
    gap: clamp(30px, 4.2vw, 64px);
  }

  .sk-stage {
    min-height: clamp(500px, 44vw, 700px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: clamp(18px, 2vw, 30px);
  }

  .sk-rail {
    position: relative;
    display: grid;
    align-content: center;
    min-width: 0;
    padding: 22px 0;
  }

  .sk-rail::before {
    position: absolute;
    top: 10%;
    bottom: 10%;
    left: 24px;
    width: 1px;
    background: var(--sk-line);
    content: "";
  }

  .sk-step {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    min-height: 66px;
    align-items: center;
    border-bottom: 1px solid var(--sk-line);
  }

  .sk-step:first-child {
    border-top: 1px solid var(--sk-line);
  }

  .sk-step i {
    position: relative;
    z-index: 1;
    width: 9px;
    height: 9px;
    margin-left: 16px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 50%;
    background: #070910;
  }

  .sk-step span {
    width: 62%;
    height: 14px;
    margin-left: 12px;
    border-radius: 4px;
  }

  .skeleton-pulse .sk-kicker,
  .skeleton-pulse .sk-heading,
  .skeleton-pulse .sk-copy,
  .skeleton-pulse .sk-stage,
  .skeleton-pulse .sk-step span {
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

  .how-section-placeholder {
    display: flex;
    min-height: 540px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    text-align: center;
  }

  .placeholder-message {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-min, 14px);
  }

  .retry-btn {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
  }

  .retry-btn:hover {
    border-color: #fff;
  }

  .retry-btn:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 4px;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (max-width: 919px) {
    .how-section-skeleton {
      width: min(calc(100% - 40px), 900px);
      padding: 72px 0 80px;
    }

    .sk-assembly {
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.75fr);
      gap: 28px;
    }

    .sk-stage {
      min-height: 470px;
    }

    .sk-step {
      min-height: 62px;
    }
  }

  @media (max-width: 760px) {
    .how-section-skeleton {
      width: min(calc(100% - 32px), 680px);
      padding: 56px 0 64px;
    }

    .sk-intro {
      margin-bottom: 32px;
    }

    .sk-heading {
      width: min(310px, 72%);
      height: 50px;
    }

    .sk-copy {
      width: 92%;
      height: 34px;
    }

    .sk-assembly {
      grid-template-columns: 1fr;
      gap: 22px;
    }

    .sk-stage {
      min-height: 0;
      aspect-ratio: 1;
      border-radius: 20px;
    }

    .sk-rail {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 0;
      border-top: 1px solid var(--sk-line);
      border-left: 1px solid var(--sk-line);
    }

    .sk-rail::before {
      display: none;
    }

    .sk-step,
    .sk-step:first-child {
      grid-template-columns: 36px minmax(0, 1fr);
      min-height: 64px;
      padding: 7px 8px;
      border-top: 0;
      border-right: 1px solid var(--sk-line);
      border-bottom: 1px solid var(--sk-line);
    }

    .sk-step i {
      margin-left: 10px;
    }

    .sk-step span {
      margin-left: 4px;
    }

    .how-section-placeholder {
      min-height: 480px;
      padding: 56px 16px;
    }
  }

  @media (min-width: 2200px) {
    .how-section-skeleton {
      width: min(74vw, 2840px);
      max-width: none;
      padding: 120px 0 132px;
    }

    .sk-intro {
      max-width: 920px;
      margin-bottom: 72px;
    }

    .sk-heading {
      width: 470px;
      height: 76px;
    }

    .sk-copy {
      width: 760px;
      height: 20px;
    }

    .sk-assembly {
      grid-template-columns: minmax(0, 1250px) minmax(460px, 660px);
      justify-content: center;
      column-gap: clamp(72px, 7vw, 280px);
    }

    .sk-stage {
      min-height: 780px;
    }

    .sk-step {
      min-height: 82px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lazy-section {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .skeleton-pulse .sk-kicker,
    .skeleton-pulse .sk-heading,
    .skeleton-pulse .sk-copy,
    .skeleton-pulse .sk-stage,
    .skeleton-pulse .sk-step span {
      animation: none;
    }
  }
</style>
