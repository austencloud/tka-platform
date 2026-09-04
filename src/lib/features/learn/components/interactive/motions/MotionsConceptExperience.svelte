<!--
  Hand Motions keeps the first three paths one at a time, then places all six
  time-and-direction relationships on one comparison board. The board is the
  final lesson step and the review destination, so focusing a relationship
  never sends the learner backward through the lesson carousel.
-->
<script lang="ts">
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
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
  import TimingDirectionBoard from "./TimingDirectionBoard.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
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
  const comparisonIndex = HAND_PATH_STEPS.length;
  const totalStages = comparisonIndex + 1;

  const levelOnePlaces = getConceptPlacesByLevel(1);
  const curriculumIndex = levelOnePlaces.findIndex(
    (place) => place.id === "1.3"
  );
  const curriculumLabel = `Level 1 · ${curriculumIndex + 1} of ${levelOnePlaces.length}`;

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("hand-motions-intro");
  const saved = persistence.load();
  let stepIndex = $state(
    viewMode === "scroll"
      ? comparisonIndex
      : Math.min(comparisonIndex, Math.max(0, (saved.step || 1) - 1))
  );
  let comparisonBoard: TimingDirectionBoard | null = $state(null);

  const activeMotion = $derived(
    stepIndex < HAND_PATH_STEPS.length ? HAND_PATH_STEPS[stepIndex] : undefined
  );
  const isComparison = $derived(stepIndex === comparisonIndex);
  const headingTitle = $derived(activeMotion?.name ?? "Time + Direction");
  const headingEyebrow = $derived(
    activeMotion
      ? `Hand motion ${stepIndex + 1} of ${HAND_PATH_STEPS.length}`
      : "Two hands"
  );
  const headingDescription = $derived(
    activeMotion?.guideCaption ??
      "Time compares the hands: together, split, or quarter. Direction compares their travel: same or opposite."
  );

  function goToStep(next: number): void {
    const clamped = Math.min(comparisonIndex, Math.max(0, next));
    if (clamped === stepIndex) return;
    stepIndex = clamped;
    persistence.saveStep(stepIndex + 1);
    haptic?.trigger("selection");
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handlePrimaryAction(): void {
    if (isComparison) {
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
    if (comparisonBoard?.collapseFocus()) return;
    if (viewMode === "scroll") {
      onBack?.();
      return;
    }
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="motions-experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Hand motions lesson, use arrow keys to navigate"
>
  <LessonStageFrame artifactLayout={activeMotion ? "square" : "wide"}>
    {#snippet heading()}
      <LessonStageHeading
        key={stepIndex}
        title={headingTitle}
        eyebrow={headingEyebrow}
      >
        <p>{headingDescription}</p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <Crossfade key={stepIndex} fill>
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
          <div class="artifact-state comparison-state">
            <TimingDirectionBoard
              bind:this={comparisonBoard}
              modes={ELEMENTAL_MODES}
            />
          </div>
        {/if}
      </Crossfade>
    {/snippet}

    {#snippet controls()}
      <LessonStageControls
        label={isComparison
          ? viewMode === "scroll"
            ? "Done"
            : "Finish lesson"
          : "Next"}
        currentStep={stepIndex + 1}
        totalSteps={totalStages}
        onAction={handlePrimaryAction}
        onPrevious={handleBack}
        previousLabel={viewMode === "scroll" ? "Close review" : "Previous"}
        previousDisabled={viewMode !== "scroll" && stepIndex === 0}
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

  @media (max-width: 640px), (max-height: 540px) {
    .comparison-state {
      min-height: 0;
    }
  }
</style>
