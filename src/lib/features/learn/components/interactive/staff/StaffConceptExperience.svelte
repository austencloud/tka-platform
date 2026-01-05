<!--
StaffConceptExperience - Coordinator for staff positions & rotations learning flow

Manages navigation through 5 pages:
1. Staff Positions Introduction
2. Thumb Orientations
3. Prospin Rotation
4. Antispin Rotation
5. Quiz
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import StaffIntroPage from "./pages/StaffIntroPage.svelte";
  import ThumbOrientationsPage from "./pages/ThumbOrientationsPage.svelte";
  import ProspinPage from "./pages/ProspinPage.svelte";
  import AntispinPage from "./pages/AntispinPage.svelte";
  import StaffQuizPage from "./pages/StaffQuizPage.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";

  let { onComplete } = $props<{
    onComplete?: () => void;
  }>();

  const hapticServiceRaw = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

  // Wrap the haptic service to match the simpler interface expected by child components
  const hapticService = hapticServiceRaw
    ? {
        trigger: (type: string) => hapticServiceRaw.trigger(type as any),
      }
    : undefined;

  // Persistence for HMR/refresh survival
  const persistence = getExperiencePersistence("staff");

  let currentPage = $state(persistence.load().step || 1);
  const totalPages = 5;

  function handleNext() {
    hapticServiceRaw?.trigger("selection");
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
    hapticServiceRaw?.trigger("success");
    handleComplete();
  }
</script>

<div class="staff-experience">
  {#if currentPage === 1}
    <StaffIntroPage onNext={handleNext} />
  {:else if currentPage === 2}
    <ThumbOrientationsPage onNext={handleNext} {hapticService} />
  {:else if currentPage === 3}
    <ProspinPage onNext={handleNext} {hapticService} />
  {:else if currentPage === 4}
    <AntispinPage onNext={handleNext} {hapticService} />
  {:else if currentPage === 5}
    <StaffQuizPage onComplete={handleQuizComplete} />
  {/if}

  <ExperienceProgressIndicator currentStep={currentPage} totalSteps={totalPages} />
</div>

<style>
  .staff-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  @media (max-width: 600px) {
    .staff-experience {
      padding: 1rem;
    }
  }
</style>
