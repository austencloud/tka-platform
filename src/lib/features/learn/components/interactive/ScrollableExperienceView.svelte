<!--
ScrollableExperienceView - Renders all experience pages in a scrollable vertical layout
Used for "review mode" after completing a concept - allows users to scroll through
all content at once instead of stepping through one page at a time.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    totalPages,
    children,
    onBack,
  }: {
    title: string;
    totalPages: number;
    children: Snippet;
    onBack?: () => void;
  } = $props();
</script>

<div class="scrollable-experience">
  <!-- Header with title and back button -->
  <header class="scroll-header">
    {#if onBack}
      <button class="back-button" onclick={onBack} aria-label="Go back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      </button>
    {/if}
    <h1 class="scroll-title">{title}</h1>
    <span class="page-count">{totalPages} sections</span>
  </header>

  <!-- Scrollable content area -->
  <div class="scroll-content">
    {@render children()}
  </div>

  <!-- Scroll progress indicator -->
  <div class="scroll-hint">
    <i class="fa-solid fa-angles-down" aria-hidden="true"></i>
    <span>Scroll to review</span>
  </div>
</div>

<style>
  .scrollable-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .scroll-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .scroll-title {
    flex: 1;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
  }

  .page-count {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    padding: 0.25rem 0.75rem;
    background: var(--theme-card-bg);
    border-radius: 12px;
  }

  .scroll-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .scroll-hint {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    color: var(--theme-text-dim);
    font-size: 0.75rem;
    pointer-events: none;
    opacity: 0.8;
    animation: pulse 2s ease-in-out infinite;
  }

  .scroll-hint i {
    animation: bounce 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.8;
    }
    50% {
      opacity: 0.4;
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(3px);
    }
  }

  /* Hide scroll hint after user starts scrolling */
  .scroll-content:has(:hover) ~ .scroll-hint,
  .scroll-content:focus-within ~ .scroll-hint {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  @media (max-width: 768px) {
    .scroll-header {
      padding: 0.75rem 1rem;
    }

    .scroll-title {
      font-size: 1.125rem;
    }

    .scroll-content {
      padding: 1.5rem 1rem;
      gap: 2.5rem;
    }

    .scroll-hint {
      bottom: calc(env(safe-area-inset-bottom, 0px) + 70px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-hint,
    .scroll-hint i {
      animation: none;
    }
  }
</style>
