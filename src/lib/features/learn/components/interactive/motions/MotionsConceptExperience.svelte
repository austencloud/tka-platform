<!--
MotionsConceptExperience - Coordinator for 8-page hand motions learning flow
Pages 1: Intro, Pages 2-7: Motion types, Page 8: Quiz
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    TYPE_EXAMPLES,
    MOTION_INFO,
  } from "../../../domain/constants/motion-experience-data";
  import MotionsIntroPage from "./motions-experience/MotionsIntroPage.svelte";
  import MotionTypePage from "./motions-experience/MotionTypePage.svelte";
  import MotionsQuizPage from "./motions-experience/MotionsQuizPage.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";

  import type { ExperienceViewMode } from "../../../domain/types";

  let { onComplete, viewMode = "step" } = $props<{
    onComplete?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  // Note: Scroll mode not yet implemented for this experience
  // When viewMode === "scroll", falls back to step mode

  const hapticService = getHapticFeedback();

  // Persistence for HMR/refresh survival
  const persistence = getExperiencePersistence("motions");
  const initialState = persistence.load();

  let currentPage = $state(initialState.step || 1);
  const totalPages = 8;

  // Example indices for each type (persisted)
  let exampleIndices = $state<Record<number, number>>(
    (initialState.phaseData?.exampleIndices as Record<number, number>) ?? {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    }
  );

  function getCurrentExample(type: number) {
    return TYPE_EXAMPLES[type]![exampleIndices[type]!]!;
  }

  function cycleExample(type: number) {
    const examples = TYPE_EXAMPLES[type]!;
    exampleIndices[type] = (exampleIndices[type]! + 1) % examples.length;
    persistence.savePhaseData("exampleIndices", exampleIndices);
    hapticService?.trigger("selection");
  }

  function handleNext() {
    hapticService?.trigger("selection");
    if (currentPage < totalPages) {
      currentPage++;
      persistence.saveStep(currentPage);
    } else {
      handleComplete();
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
</script>

<div class="motions-experience">
  {#if currentPage === 1}
    <MotionsIntroPage onNext={handleNext} />
  {:else if currentPage >= 2 && currentPage <= 7}
    {@const typeNum = currentPage - 1}
    {@const info = MOTION_INFO[typeNum]}
    {@const example = getCurrentExample(typeNum)}

    {#if info}
      <MotionTypePage
        {typeNum}
        {info}
        {example}
        showSummary={currentPage === 7}
        onCycleExample={() => cycleExample(typeNum)}
        onNext={handleNext}
        isLastType={currentPage === 7}
      />
    {/if}
  {:else if currentPage === 8}
    <MotionsQuizPage onComplete={handleQuizComplete} />
  {/if}

  <ExperienceProgressIndicator currentStep={currentPage} totalSteps={totalPages} />
</div>

<style>
  .motions-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  @media (max-width: 600px) {
    .motions-experience {
      padding: 1rem;
    }
  }
</style>
