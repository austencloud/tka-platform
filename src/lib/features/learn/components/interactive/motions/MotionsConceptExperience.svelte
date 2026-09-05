<!--
  Hand Motions keeps the first three paths one at a time, introduces Timing and
  Direction as a system, then places all six relationships on one comparison
  board. The board stays the review destination, so focusing a relationship
  never sends the learner backward through the lesson carousel.
-->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import DualSourceCrossfade from "$lib/shared/components/DualSourceCrossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { getConceptPlacesByLevel } from "../../../domain/concept-place-registry";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import LessonStageControls from "../LessonStageControls.svelte";
  import LessonStageFrame from "../LessonStageFrame.svelte";
  import LessonStageHeading from "../LessonStageHeading.svelte";
  import HandMotionPlayer from "../foundations/HandMotionPlayer.svelte";
  import {
    ALPHA_BETA_MODES,
    GAMMA_MODES,
    HAND_PATH_STEPS,
    type TimingDirectionMode,
  } from "../foundations/pictograph-foundation-content";
  import {
    HAND_MOTIONS_STAGE_SCHEMA_VERSION,
    migrateHandMotionsSavedStep,
  } from "./hand-motions-stage";
  import TimingDirectionBoard from "./TimingDirectionBoard.svelte";
  import TimingDirectionIntro from "./TimingDirectionIntro.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
    timingDirectionOnly = false,
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
    timingDirectionOnly?: boolean;
  }>();

  const allModes: readonly TimingDirectionMode[] = [
    ...ALPHA_BETA_MODES,
    ...GAMMA_MODES,
  ];
  const modeByFamily = new Map(
    allModes.map((mode) => [mode.element.familyId, mode])
  );

  function requireMode(familyId: string): TimingDirectionMode {
    const mode = modeByFamily.get(familyId);
    if (!mode) throw new Error(`Missing hand-motion lesson mode ${familyId}`);
    return mode;
  }

  const ELEMENTAL_MODES = TND_ELEMENTS.map((element) =>
    requireMode(element.familyId)
  );
  const timingDirectionIndex = HAND_PATH_STEPS.length;
  const comparisonIndex = timingDirectionIndex + 1;
  const firstStage = timingDirectionOnly ? timingDirectionIndex : 0;
  const totalStages = comparisonIndex - firstStage + 1;

  const levelOnePlaces = getConceptPlacesByLevel(1);
  const curriculumIndex = levelOnePlaces.findIndex(
    (place) => place.id === "1.3"
  );
  const curriculumLabel = `Level 1 · ${curriculumIndex + 1} of ${levelOnePlaces.length}`;

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence(
    timingDirectionOnly ? "timing-and-direction" : "hand-motions-intro"
  );
  const saved = persistence.load();
  const savedSchemaVersion = persistence.getPhaseData("stageSchemaVersion", 1);
  const savedStep = timingDirectionOnly
    ? saved.step
    : migrateHandMotionsSavedStep(
        saved.step,
        savedSchemaVersion,
        HAND_PATH_STEPS.length
      );
  const initialStepIndex =
    viewMode === "scroll"
      ? comparisonIndex
      : Math.min(comparisonIndex, Math.max(firstStage, savedStep - 1));
  let stepIndex = $state(
    initialStepIndex === comparisonIndex
      ? timingDirectionIndex
      : initialStepIndex
  );
  let comparisonMounted = $state(initialStepIndex >= timingDirectionIndex);
  let comparisonReady = $state(false);
  let comparisonRequested = $state(initialStepIndex === comparisonIndex);
  let comparisonPresented = $state(false);
  let comparisonBoard: TimingDirectionBoard | null = $state(null);
  let comparisonFocused = $state(false);
  let experienceElement: HTMLDivElement;
  let layoutRevision = 0;
  const stageMotion = createLayoutMotion({
    getRoot: () => experienceElement,
    groups: [
      { selector: ".stage-artifact", datasetKey: "stageArtifact" },
      { selector: ".stage-controls", datasetKey: "stageControls" },
    ],
    getDuration: () => motionDuration(DURATION.emphasis),
  });
  onDestroy(() => {
    ++layoutRevision;
    stageMotion.cancel();
  });

  if (viewMode !== "scroll" && savedStep !== (saved.step || 1)) {
    persistence.saveStep(savedStep);
    persistence.savePhaseData(
      "stageSchemaVersion",
      HAND_MOTIONS_STAGE_SCHEMA_VERSION
    );
  }

  const activeMotion = $derived(
    stepIndex < HAND_PATH_STEPS.length ? HAND_PATH_STEPS[stepIndex] : undefined
  );
  const isComparison = $derived(stepIndex === comparisonIndex);
  const headingTitle = $derived(activeMotion?.name ?? "Timing and Direction");
  const headingEyebrow = $derived(
    activeMotion
      ? `Hand motion ${stepIndex + 1} of ${HAND_PATH_STEPS.length}`
      : "Two hands"
  );

  function goToStep(next: number): void {
    const clamped = Math.min(comparisonIndex, Math.max(firstStage, next));
    comparisonRequested = false;
    if (clamped >= timingDirectionIndex) comparisonMounted = true;
    if (clamped === comparisonIndex && !comparisonReady) {
      comparisonRequested = true;
      return;
    }
    if (clamped === stepIndex) return;
    const revision = ++layoutRevision;
    const captured = stageMotion.capture();
    comparisonPresented = false;
    stepIndex = clamped;
    if (captured) {
      void tick().then(() => {
        if (revision === layoutRevision) stageMotion.play();
      });
    }
    persistence.saveStep(stepIndex + 1);
    persistence.savePhaseData(
      "stageSchemaVersion",
      HAND_MOTIONS_STAGE_SCHEMA_VERSION
    );
    haptic?.trigger("selection");
  }

  function comparisonPrepared(): void {
    comparisonReady = true;
    if (comparisonRequested) goToStep(comparisonIndex);
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handlePrimaryAction(): void {
    if (isComparison) {
      // A double-click on Next must not finish a board that is still arriving.
      if (!comparisonPresented) return;
      complete();
      return;
    }
    goToStep(stepIndex + 1);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handlePrimaryAction();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  export function handleBack(): void {
    comparisonRequested = false;
    if (isComparison && comparisonBoard?.collapseFocus()) return;
    if (viewMode === "scroll") {
      onBack?.();
      return;
    }
    if (stepIndex > firstStage) {
      goToStep(stepIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={experienceElement}
  class="motions-experience"
  class:is-intro={!activeMotion && !isComparison}
  class:has-focused-comparison={comparisonFocused}
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label={`${timingDirectionOnly ? "Timing and direction" : "Hand motions"} lesson, use arrow keys to navigate`}
>
  <LessonStageFrame artifactLayout={activeMotion ? "square" : "wide"}>
    {#snippet heading()}
      <LessonStageHeading
        key={headingTitle}
        title={headingTitle}
        eyebrow={headingEyebrow}
      >
        <p class="motion-description">
          {#if activeMotion}
            {activeMotion.guideCaption}
          {:else}
            <span class="description-phrase"
              >When the hands reach the downbeat.</span
            >
            <span class="description-phrase">Which way they rotate.</span>
          {/if}
        </p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <DualSourceCrossfade
        active={isComparison ? "second" : "first"}
        duration={DURATION.emphasis}
        clip={false}
        onsettled={(source) => {
          comparisonPresented = source === "second" && isComparison;
        }}
      >
        {#snippet first()}
          <Crossfade key={activeMotion?.name ?? "timing-intro"} fill>
            {#if activeMotion}
              <div class="artifact-state motion-state">
                <div class="player-frame">
                  <HandMotionPlayer
                    sequence={activeMotion.sequence}
                    ariaLabel={`${activeMotion.name}: ${activeMotion.guideCaption}`}
                  />
                </div>
                <div class="hand-key" aria-label="Left hand is blue">
                  <span aria-hidden="true"></span>
                  <strong>Left hand</strong>
                </div>
              </div>
            {:else}
              <div class="artifact-state timing-direction-state">
                <TimingDirectionIntro />
              </div>
            {/if}
          </Crossfade>
        {/snippet}
        {#snippet second()}
          {#if comparisonMounted}
            <div class="artifact-state comparison-state">
              <TimingDirectionBoard
                bind:this={comparisonBoard}
                modes={ELEMENTAL_MODES}
                active={isComparison && comparisonPresented}
                onReady={comparisonPrepared}
                onFocusChange={(focused) => (comparisonFocused = focused)}
              />
            </div>
          {/if}
        {/snippet}
      </DualSourceCrossfade>
    {/snippet}

    {#snippet controls()}
      <LessonStageControls
        label={isComparison
          ? viewMode === "scroll"
            ? "Done"
            : "Finish lesson"
          : comparisonRequested
            ? "Preparing…"
            : "Next"}
        currentStep={stepIndex - firstStage + 1}
        totalSteps={totalStages}
        onAction={handlePrimaryAction}
        onPrevious={handleBack}
        previousLabel={viewMode === "scroll" ? "Close review" : "Previous"}
        previousDisabled={viewMode !== "scroll" && stepIndex === firstStage}
        actionIcon={isComparison ? "check" : "arrow"}
        {curriculumLabel}
      />
    {/snippet}
  </LessonStageFrame>
</div>

<style>
  .motions-experience {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--theme-text);
    outline: none;
  }

  .motions-experience :global(.lesson-stage-frame) {
    --lesson-artifact-wide-max: var(--shell-w, 96rem);
  }

  .motions-experience.is-intro {
    flex-shrink: 0;
    height: clamp(44rem, 80dvh, 50rem);
    overflow: visible;
  }

  @media (max-width: 640px) {
    .motions-experience.is-intro {
      height: 46rem;
    }
  }

  .motion-description {
    max-width: 60ch;
    text-wrap: balance;
  }

  .description-phrase {
    display: inline-block;
    max-width: 100%;
  }

  .artifact-state {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .motion-state {
    position: relative;
    display: grid;
    place-items: center;
  }

  .player-frame {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .hand-key {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.25rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    background: var(--theme-panel-bg);
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
  }

  .hand-key span {
    width: 0.8rem;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--prop-blue, #3d44b8);
  }

  .hand-key strong {
    color: var(--theme-text);
  }

  .comparison-state {
    min-height: 22rem;
  }

  .timing-direction-state {
    display: grid;
    place-items: center;
  }

  @media (max-width: 800px), (max-height: 540px) {
    .comparison-state {
      min-height: 0;
    }
  }

  @media (max-width: 800px) {
    .motions-experience.has-focused-comparison,
    .motions-experience.has-focused-comparison :global(.lesson-stage-frame) {
      height: auto;
      min-height: 60rem;
    }

    .motions-experience.has-focused-comparison {
      overflow: visible;
    }
  }

  @media (max-height: 540px) and (min-width: 801px) {
    .motions-experience.has-focused-comparison,
    .motions-experience.has-focused-comparison :global(.lesson-stage-frame) {
      height: auto;
      min-height: 36rem;
    }

    .motions-experience.has-focused-comparison {
      overflow: visible;
    }

    .timing-direction-state {
      place-items: start center;
    }
  }
</style>
