<!--
GridConceptExperience - Fluid grid learning experience
Content animates in/out on a single page as user progresses.
Uses CSS animations with staggered delays for smooth, layout-stable animations.
-->
<script lang="ts">
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import LessonGridDisplay from "./LessonGridDisplay.svelte";
  import GridIdentificationQuiz from "./GridIdentificationQuiz.svelte";
  import GridMergeAnimation from "./GridMergeAnimation.svelte";
  import ExperienceProgressIndicator from "./ExperienceProgressIndicator.svelte";
  import { getExperiencePersistence } from "../../state/experience-persistence.svelte";

  let { onComplete, onBack } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
  }>();

  const hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

  // Persistence for HMR/refresh survival
  const persistence = getExperiencePersistence("grid");
  const initialState = persistence.load();

  // Current step in the experience (persisted)
  let step = $state(initialState.step);
  const totalSteps = 4; // intro, modes, points, quiz

  // Animation state - triggers CSS animations
  let animateIn = $state(false);

  // Step 1 internal phase: "diamond" → "both" → "merged" (persisted)
  // diamond: Only diamond grid shown, centered
  // both: Diamond slides left, Box appears on right with point animation
  // merged: Both grids animate to center and overlay
  let mergePhase = $state<"diamond" | "both" | "merged">(
    (initialState.phaseData?.mergePhase as "diamond" | "both" | "merged") ?? "diamond"
  );

  // Handle completion - reset experience state and call parent callback
  function handleComplete() {
    persistence.reset();
    onComplete?.();
  }

  // Point types from PDF page 7
  const pointTypes = [
    { name: "Center Point", description: "The hub of all movement" },
    {
      name: "Hand Points",
      description: "4 points halfway between center and outer",
    },
    {
      name: "Outer Points",
      description: "4 points at the outer edges of the grid",
    },
  ];

  onMount(() => {
    // Trigger entrance animations after mount
    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  function handleNext() {
    hapticService?.trigger("selection");

    // Special handling for step 1 merge phases
    if (step === 1) {
      if (mergePhase === "diamond") {
        // Show box grid alongside diamond
        mergePhase = "both";
        persistence.savePhaseData("mergePhase", "both");
        return;
      } else if (mergePhase === "both") {
        // Merge the grids together
        mergePhase = "merged";
        persistence.savePhaseData("mergePhase", "merged");
        return;
      } else if (mergePhase === "merged") {
        // Reset merge phase for next time and proceed to next step
        mergePhase = "diamond";
        persistence.savePhaseData("mergePhase", "diamond");
      }
    }

    // Reset animation state, change step, then re-animate
    animateIn = false;
    requestAnimationFrame(() => {
      step++;
      persistence.saveStep(step);
      requestAnimationFrame(() => {
        animateIn = true;
      });
    });
  }

  function handleBack() {
    hapticService?.trigger("selection");

    // Special handling for step 1 merge phases
    if (step === 1) {
      if (mergePhase === "merged") {
        // Go back to both grids side-by-side
        mergePhase = "both";
        persistence.savePhaseData("mergePhase", "both");
        return;
      } else if (mergePhase === "both") {
        // Go back to diamond only
        mergePhase = "diamond";
        persistence.savePhaseData("mergePhase", "diamond");
        return;
      }
      // If in diamond phase, continue to go back to step 0
    }

    if (step > 0) {
      animateIn = false;
      requestAnimationFrame(() => {
        step--;
        persistence.saveStep(step);
        // Reset merge phase when returning to step 1
        if (step === 1) {
          mergePhase = "diamond";
          persistence.savePhaseData("mergePhase", "diamond");
        }
        requestAnimationFrame(() => {
          animateIn = true;
        });
      });
    } else {
      onBack?.();
    }
  }

  // Expose handleBack for parent to call
  export { handleBack };
</script>

<div class="grid-experience" class:animate-in={animateIn}>
  {#if step === 0}
    <!-- Step 0: Introduction - 4-point grid -->
    <div class="step-content step-intro">
      <h1 class="title anim-item" style="--anim-order: 0">The Grid</h1>

      <p class="description anim-item" style="--anim-order: 1">
        The Kinetic Alphabet is based on a <strong>4-point grid</strong>.
      </p>

      <div class="grid-container anim-item" style="--anim-order: 2">
        <LessonGridDisplay type="diamond" size="large" animateEntrance={true} />
      </div>

      <button
        class="next-button anim-item"
        style="--anim-order: 3"
        onclick={handleNext}
      >
        Next
      </button>
    </div>
  {:else if step === 1}
    <!-- Step 1: Diamond → Box → Merge (three phases) -->
    <div class="step-content step-modes">
      <!-- Title transitions based on merge phase -->
      <h1 class="title anim-item" style="--anim-order: 0">
        {#if mergePhase === "diamond"}
          Diamond Mode
        {:else if mergePhase === "both"}
          Box Mode
        {:else}
          The 8-Point Grid
        {/if}
      </h1>

      <!-- Description transitions based on merge phase -->
      <p class="description anim-item" style="--anim-order: 1">
        {#if mergePhase === "diamond"}
          In <strong>diamond mode</strong>, the outer points are the cardinal directions - N, E, S, W. 
        {:else if mergePhase === "both"}
          In <strong>box mode</strong>, the outer points are the intercardinal directions.
        {:else}
          <strong>Diamond + Box</strong> creates the full 8-point grid.
        {/if}
      </p>

      <!-- Custom merge animation component -->
      <div class="merge-animation-container anim-item" style="--anim-order: 2">
        <GridMergeAnimation phase={mergePhase} />
      </div>

      <!-- Secondary text -->
      <p class="description secondary anim-item" style="--anim-order: 3">
        {#if mergePhase === "diamond"}
          North, East, South, and West
        {:else if mergePhase === "both"}
          Northeast, Southeast, Southwest, and Northwest
        {:else}
          We'll use diamond mode to learn each concept.
        {/if}
      </p>

      <button
        class="next-button anim-item"
        style="--anim-order: 4"
        onclick={handleNext}
      >
        Next
      </button>
    </div>
  {:else if step === 2}
    <!-- Step 2: Point Types -->
    <div class="step-content step-points">
      <h1 class="title anim-item" style="--anim-order: 0">Point Types</h1>

      <div class="split-layout">
        <!-- Left side: Text content -->
        <div class="points-explanation">
          <p class="description anim-item" style="--anim-order: 1">
            The grid has <strong>three types of points</strong>:
          </p>

          <ul class="point-types-list">
            {#each pointTypes as point, i}
              <li
                class="point-type-item anim-item"
                style="--anim-order: {2 + i}"
              >
                <span class="point-name">{point.name}</span>
                <span class="point-desc">{point.description}</span>
              </li>
            {/each}
          </ul>

          <button
            class="next-button anim-item"
            style="--anim-order: 5"
            onclick={handleNext}
          >
            Next
          </button>
        </div>

        <!-- Right side: Grid -->
        <div
          class="grid-container grid-side anim-item anim-slide-right"
          style="--anim-order: 0"
        >
          <LessonGridDisplay type="diamond" size="large" />
        </div>
      </div>
    </div>
  {:else if step === 3}
    <!-- Step 3: Quiz -->
    <div class="step-content step-quiz">
      <h1 class="title anim-item" style="--anim-order: 0">
        Test Your Knowledge
      </h1>
      <div class="quiz-container anim-item" style="--anim-order: 1">
        <GridIdentificationQuiz onComplete={handleComplete} />
      </div>
    </div>
  {/if}

  <ExperienceProgressIndicator currentStep={step + 1} {totalSteps} />
</div>

<style>
  .grid-experience {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    height: 100%;
    padding: var(--spacing-xl, 2rem);
    padding-top: var(--spacing-2xl, 3rem);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ============================================
     CSS Animation System
     Uses --anim-order custom property for staggered delays
     ============================================ */

  /* Animation items - start invisible */
  .anim-item {
    opacity: 0;
    transform: translateY(20px);
  }

  /* Slide from right variant */
  .anim-slide-right {
    transform: translateX(30px);
  }

  /* When animate-in class is on parent, animate children */
  .animate-in .anim-item {
    animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--anim-order, 0) * 120ms);
  }

  .animate-in .anim-slide-right {
    animation: fadeSlideLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
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

  @keyframes fadeSlideLeft {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* ============================================
     Layout
     ============================================ */

  /* Title */
  .title {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--theme-text);
    margin: 0 0 var(--spacing-lg, 1.5rem) 0;
    text-align: center;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  /* Step content containers */
  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xl, 2rem);
    width: 100%;
    flex: 1;
  }

  /* Step 0: Centered intro layout */
  .step-intro {
    max-width: 500px;
    justify-content: center;
  }

  /* Step 1: Has title + split layout below */
  .step-points {
    max-width: 900px;
    width: 100%;
  }

  /* Step 2: Quiz layout */
  .step-quiz {
    max-width: 700px;
    width: 100%;
  }

  .step-quiz .quiz-container {
    width: 100%;
    max-width: none;
  }

  /* Step 1: Grid modes layout */
  .step-modes {
    max-width: 900px;
    width: 100%;
    justify-content: center;
  }

  /* Container for the merge animation component */
  .merge-animation-container {
    width: 100%;
    max-width: 700px;
  }

  /* Split layout for side-by-side content */
  .split-layout {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: var(--spacing-2xl, 3rem);
    width: 100%;
  }

  /* Left side explanation panel */
  .points-explanation {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 1.5rem);
    flex: 1;
    max-width: 400px;
  }

  .points-explanation .description {
    text-align: left;
  }

  /* Point types list */
  .point-types-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 1rem);
  }

  .point-type-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: var(--spacing-md, 1rem);
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
  }

  .point-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--theme-text);
  }

  .point-desc {
    font-size: 0.9rem;
    color: var(--theme-text-dim);
  }

  /* Description text */
  .description {
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
  }

  .description strong {
    color: var(--theme-text);
    font-weight: 700;
  }

  .description.secondary {
    font-size: 1.1rem;
    color: var(--theme-text-dim);
    font-style: italic;
  }

  /* Grid container - base */
  .grid-container {
    width: 100%;
    max-width: 320px;
    flex-shrink: 0;
  }

  /* Grid on side (step 1) - larger */
  .grid-side {
    max-width: 340px;
    flex: 0 0 auto;
  }

  /* Next button */
  .next-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 3rem;
    background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border: 2px solid color-mix(in srgb, var(--theme-accent) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    min-width: 160px;
  }

  .next-button:hover {
    background: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 80%, transparent);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .next-button:active {
    transform: scale(0.98);
  }

  /* ============================================
     Responsive
     ============================================ */
  @media (max-width: 768px) {
    .grid-experience {
      padding: var(--spacing-lg, 1.5rem);
      padding-top: var(--spacing-xl, 2rem);
    }

    .title {
      font-size: 2rem;
    }

    .description {
      font-size: 1.1rem;
    }

    .split-layout {
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-lg, 1.5rem);
    }

    .points-explanation {
      max-width: 100%;
      order: 2;
    }

    .points-explanation .description {
      text-align: center;
    }

    .grid-side {
      max-width: 260px;
      order: 1;
    }

    .grid-container {
      max-width: 280px;
    }

    .next-button {
      padding: 0.875rem 2.5rem;
      font-size: 1rem;
    }

    /* Merge animation responsive */
    .merge-animation-container {
      max-width: 100%;
    }
  }

  /* ============================================
     Reduced Motion
     ============================================ */
  @media (prefers-reduced-motion: reduce) {
    .anim-item {
      opacity: 1;
      transform: none;
    }

    .animate-in .anim-item,
    .animate-in .anim-slide-right {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .next-button {
      transition: none;
    }

  }
</style>
