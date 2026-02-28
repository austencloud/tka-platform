<!--
PositionsConceptExperience - 4-page hand positions learning flow
Page 1: Alpha position (hands at opposite points)
Page 2: Beta position (hands at same point)
Page 3: Gamma position (hands at right angles)
Page 4: Interactive quiz

Supports keyboard navigation (arrow keys) and accessibility features
matching the Grid lesson's polish level.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import {
    ALPHA_EXAMPLES,
    BETA_EXAMPLES,
    GAMMA_EXAMPLES,
    type PositionExample,
  } from "../../../domain/constants/positions-experience-data";
  import PositionPage from "./positions-experience/PositionPage.svelte";
  import PositionsQuizPage from "./positions-experience/PositionsQuizPage.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";

  import type { ExperienceViewMode } from "../../../domain/types";

  let { onComplete, viewMode = "step" } = $props<{
    onComplete?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const hapticService = container.items.hapticFeedback;
  const persistence = getExperiencePersistence("positions");

  let currentPage = $state(persistence.load().step || 1);
  const totalPages = 4;

  const PAGES: { type: "alpha" | "beta" | "gamma"; examples: readonly PositionExample[] }[] = [
    { type: "alpha", examples: ALPHA_EXAMPLES },
    { type: "beta", examples: BETA_EXAMPLES },
    { type: "gamma", examples: GAMMA_EXAMPLES },
  ];

  const currentPageData = $derived(PAGES[currentPage - 1]);

  // Staggered entrance animation state
  let animateIn = $state(false);

  // Accessibility: live region announcement
  let announcement = $state("");

  // Container ref for focus management
  let containerRef = $state<HTMLDivElement | null>(null);

  const PAGE_LABELS = ["Alpha Position", "Beta Position", "Gamma Position", "Quiz"];

  onMount(() => {
    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  function handleKeydown(event: KeyboardEvent) {
    if (viewMode !== "step") return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handleNext();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  function transitionToPage(page: number) {
    animateIn = false;
    requestAnimationFrame(() => {
      currentPage = page;
      persistence.saveStep(currentPage);
      requestAnimationFrame(() => {
        animateIn = true;
        announcement = `Page ${currentPage} of ${totalPages}: ${PAGE_LABELS[currentPage - 1]}`;
      });
    });
  }

  function handleNext() {
    hapticService?.trigger("selection");
    if (currentPage < totalPages) {
      transitionToPage(currentPage + 1);
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    hapticService?.trigger("selection");
    if (currentPage > 1) {
      transitionToPage(currentPage - 1);
    }
  }

  function handleComplete() {
    persistence.reset();
    onComplete?.();
  }

  function handleQuizComplete() {
    hapticService?.trigger("success");
    handleComplete();
  }

  function handleSkipToQuiz() {
    hapticService?.trigger("selection");
    currentPage = 4;
    persistence.saveStep(currentPage);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="positions-experience"
  class:animate-in={animateIn}
  bind:this={containerRef}
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Positions lesson, use arrow keys to navigate"
>
  <!-- Accessibility: Live region for announcements -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {announcement}
  </div>

  <!-- Accessibility: Skip link -->
  {#if currentPage < 4}
    <button class="skip-link" onclick={handleSkipToQuiz}>Skip to quiz</button>
  {/if}

  {#if currentPageData}
    <PositionPage
      type={currentPageData.type}
      examples={currentPageData.examples}
      isFirst={currentPage === 1}
      isLast={currentPage === 3}
      onNext={handleNext}
      onBack={handleBack}
    />
  {:else}
    <PositionsQuizPage onComplete={handleQuizComplete} />
  {/if}

  <ExperienceProgressIndicator currentStep={currentPage} totalSteps={totalPages} />
</div>

<style>
  .positions-experience {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: var(--spacing-xl, 2rem);
    padding-top: var(--spacing-2xl, 3rem);
    overflow-y: auto;
    overflow-x: hidden;
    outline: none;
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Skip link - visible on focus */
  .skip-link {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #22d3ee);
    color: var(--theme-on-accent, #000);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    z-index: 1000;
    transition: top var(--duration-normal, 200ms) ease;
  }

  .skip-link:focus {
    top: 1rem;
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Staggered entrance animation system */
  :global(.positions-experience .anim-item) {
    opacity: 0;
    transform: translateY(20px);
  }

  :global(.positions-experience.animate-in .anim-item) {
    animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--anim-order, 0) * 120ms);
  }

  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 600px) {
    .positions-experience {
      padding: 1rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.positions-experience .anim-item) {
      opacity: 1;
      transform: none;
    }

    :global(.positions-experience.animate-in .anim-item) {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
