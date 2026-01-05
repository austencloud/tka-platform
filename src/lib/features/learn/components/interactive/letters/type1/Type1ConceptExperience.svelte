<!--
Type1ConceptExperience - Multi-page lesson introducing Type 1 (Dual-Shift) letters
Orchestrator component that manages navigation between 5 lesson pages:
- Page 1: Introduction to Type 1 Letters & Dual-Shift concept
- Page 2: Prospin Letters (A, D, G, J, M, P, S)
- Page 3: Antispin Letters (B, E, H, K, N, Q, T)
- Page 4: Hybrid Letters (C, F, I, L, O, R, U, V)
- Page 5: Quiz
-->
<script lang="ts">
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { createType1ConceptState } from "./state/type1-concept-state.svelte";
  import Type1IntroPage from "./pages/Type1IntroPage.svelte";
  import Type1ProspinPage from "./pages/Type1ProspinPage.svelte";
  import Type1AntispinPage from "./pages/Type1AntispinPage.svelte";
  import Type1HybridPage from "./pages/Type1HybridPage.svelte";
  import Type1QuizPage from "./pages/Type1QuizPage.svelte";
  import ExperienceProgressIndicator from "../../ExperienceProgressIndicator.svelte";

  let { onComplete }: { onComplete?: () => void } = $props();

  const hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

  const state = createType1ConceptState({
    hapticService,
    getOnComplete: () => onComplete,
  });
</script>

<div class="type1-experience">
  {#if state.currentPage === 1}
    <Type1IntroPage onNext={state.nextPage} />
  {:else if state.currentPage === 2}
    <Type1ProspinPage
      currentLetter={state.currentProspin}
      letterIndex={state.prospinIndex}
      onCycle={state.cycleProspin}
      onSelectLetter={state.selectProspinLetter}
      onNext={state.nextPage}
      onPrevious={state.previousPage}
    />
  {:else if state.currentPage === 3}
    <Type1AntispinPage
      currentLetter={state.currentAntispin}
      letterIndex={state.antispinIndex}
      onCycle={state.cycleAntispin}
      onSelectLetter={state.selectAntispinLetter}
      onNext={state.nextPage}
      onPrevious={state.previousPage}
    />
  {:else if state.currentPage === 4}
    <Type1HybridPage
      currentLetter={state.currentHybrid}
      letterIndex={state.hybridIndex}
      onCycle={state.cycleHybrid}
      onSelectLetter={state.selectHybridLetter}
      onNext={state.nextPage}
      onPrevious={state.previousPage}
    />
  {:else if state.currentPage === 5}
    <Type1QuizPage
      onComplete={state.complete}
      onPrevious={state.previousPage}
    />
  {/if}

  <ExperienceProgressIndicator currentStep={state.currentPage} totalSteps={state.totalPages} />
</div>

<style>
  .type1-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  @media (max-width: 600px) {
    .type1-experience {
      padding: 1rem;
    }
  }
</style>
