<!--
ConceptPathView - Hero + mini-map focused learning experience

Shows:
- Progress mini-map with all concepts as dots
- Hero card for current/next concept
- Previous/next context
- Expandable "View all" section
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { container } from "$lib/shared/di";
  import {
    TKA_CONCEPTS,
    CONCEPT_CATEGORIES,
    getConceptsByCategory,
    getNextConcept,
    getPreviousConcept,
  } from "../domain/concepts";
  import type { LearnConcept, ConceptCategory } from "../domain/types";
  import type { IConceptProgressTracker } from "../services/contracts/IConceptProgressTracker";
  import ProgressMiniMap from "./ProgressMiniMap.svelte";
  import HeroConceptCard from "./HeroConceptCard.svelte";
  import ConceptContext from "./ConceptContext.svelte";
  import ConceptCard from "./ConceptCard.svelte";
  import CategoryHeader from "./CategoryHeader.svelte";

  let { onConceptClick }: { onConceptClick?: (concept: LearnConcept) => void } =
    $props();

  // Resolve service via DI
  const conceptProgressService = container.items.conceptProgressTracker;

  // Progress state
  let progress = $state(conceptProgressService.getProgress());
  let showAllConcepts = $state(true); // Auto-expanded by default

  // Subscribe to progress updates
  onMount(() => {
    const unsubscribe = conceptProgressService.subscribe((newProgress) => {
      progress = newProgress;
    });
    return unsubscribe;
  });

  // Find the current concept (first non-completed, non-locked)
  // Always returns a concept since TKA_CONCEPTS is never empty
  const currentConcept = $derived((): LearnConcept => {
    // First, find any in-progress concept
    const inProgress = TKA_CONCEPTS.find(
      (c) => conceptProgressService.getConceptStatus(c.id) === "in-progress"
    );
    if (inProgress) return inProgress;

    // Otherwise, find first available concept
    const available = TKA_CONCEPTS.find(
      (c) => conceptProgressService.getConceptStatus(c.id) === "available"
    );
    if (available) return available;

    // If all completed, return last concept
    if (progress.completedConcepts.size === TKA_CONCEPTS.length) {
      return TKA_CONCEPTS[TKA_CONCEPTS.length - 1]!;
    }

    // Default to first concept (always exists)
    return TKA_CONCEPTS[0]!;
  });

  const currentConceptStatus = $derived(
    conceptProgressService.getConceptStatus(currentConcept().id)
  );

  // Previous and next for context
  const previousConcept = $derived(() => {
    const current = currentConcept();
    if (!current) return undefined;
    return getPreviousConcept(current.id);
  });

  const nextUpConcept = $derived(() => {
    const current = currentConcept();
    if (!current) return undefined;
    return getNextConcept(current.id);
  });

  // Categories for "View all" section
  const categories: ConceptCategory[] = [
    "foundation",
    "letters",
    "combinations",
    "advanced",
  ];

  function getCategoryProgress(category: ConceptCategory) {
    const concepts = getConceptsByCategory(category);
    const completed = concepts.filter((c) =>
      progress.completedConcepts.has(c.id)
    ).length;
    return { completed, total: concepts.length };
  }

  function handleConceptStart(concept: LearnConcept) {
    onConceptClick?.(concept);
  }

  function toggleShowAll() {
    showAllConcepts = !showAllConcepts;
  }

  // Check if journey is complete
  const isJourneyComplete = $derived(
    progress.completedConcepts.size === TKA_CONCEPTS.length
  );
</script>

<div class="concept-path">
  <!-- Progress Arc -->
  <ProgressMiniMap {progress} />

  <!-- Main content area -->
  <div class="main-content">
    {#if isJourneyComplete}
      <!-- Celebration state -->
      <div class="completion-celebration">
        <div class="celebration-icon">
          <i class="fa-solid fa-trophy" aria-hidden="true"></i>
        </div>
        <h2>Level 1 Complete!</h2>
        <p>You've mastered all 28 concepts of The Kinetic Alphabet.</p>
        <button class="review-button" onclick={() => (showAllConcepts = true)}>
          <i class="fa-solid fa-rotate" aria-hidden="true"></i>
          Review Concepts
        </button>
      </div>
    {:else}
      <!-- Hero Card -->
      <HeroConceptCard
        concept={currentConcept()}
        status={currentConceptStatus}
        onStart={handleConceptStart}
      />

      <!-- Journey position -->
      <ConceptContext
        previousConcept={previousConcept()}
        nextConcept={nextUpConcept()}
      />
    {/if}
  </div>

  <!-- View All Toggle -->
  <button class="view-all-toggle" onclick={toggleShowAll}>
    <span>{showAllConcepts ? "Hide learning path" : "View learning path"}</span>
    <i
      class="fa-solid {showAllConcepts ? 'fa-chevron-up' : 'fa-chevron-down'}"
      aria-hidden="true"
    ></i>
  </button>

  <!-- Expandable All Concepts Path -->
  {#if showAllConcepts}
    <div class="all-concepts" transition:slide={{ duration: 300 }}>
      {#each categories as category, categoryIndex}
        {@const categoryProgress = getCategoryProgress(category)}
        {@const concepts = getConceptsByCategory(category)}

        <section class="category-section">
          <CategoryHeader
            {category}
            completedCount={categoryProgress.completed}
            totalCount={categoryProgress.total}
          />
          <div class="concept-list">
            {#each concepts as concept (concept.id)}
              {@const status = conceptProgressService.getConceptStatus(
                concept.id
              )}
              <ConceptCard {concept} {status} onClick={onConceptClick} />
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .concept-path {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    padding-bottom: 5rem;
    min-height: 100%;
    overflow-y: auto;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;

    /* Elegant thin scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Webkit scrollbar styling */
  .concept-path::-webkit-scrollbar {
    width: 6px;
  }

  .concept-path::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .concept-path::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
    transition: background var(--duration-normal) ease;
  }

  .concept-path::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  .main-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  /* Completion celebration */
  .completion-celebration {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(255, 215, 0, 0.1) 0%,
      rgba(255, 215, 0, 0.02) 100%
    );
    border: 1px solid rgba(255, 215, 0, 0.2);
    border-radius: 16px;
  }

  .celebration-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 215, 0, 0.15);
    border-radius: 50%;
    margin-bottom: 1.5rem;
  }

  .celebration-icon i {
    font-size: 2.5rem;
    color: #ffd700;
    text-shadow: 0 0 24px rgba(255, 215, 0, 0.5);
  }

  .completion-celebration h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffd700;
    margin: 0 0 0.5rem;
  }

  .completion-celebration p {
    font-size: 1rem;
    color: var(--theme-text-dim);
    margin: 0 0 1.5rem;
  }

  .review-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    min-height: var(--min-touch-target);
    background: rgba(255, 215, 0, 0.15);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: 10px;
    color: #ffd700;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .review-button:hover {
    background: rgba(255, 215, 0, 0.25);
  }

  /* View all toggle */
  .view-all-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    max-width: 300px;
    margin: 0 auto;
    width: fit-content;
  }

  .view-all-toggle:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .view-all-toggle i {
    font-size: 0.75rem;
    transition: transform var(--duration-normal) ease;
  }

  /* All concepts path */
  .all-concepts {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--theme-stroke);
  }

  /* Bento-style category container using theme system */
  .category-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    position: relative;
    overflow: hidden;
  }

  .concept-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.625rem;
    padding: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .view-all-toggle i,
    .review-button {
      transition: none;
    }
  }
</style>
