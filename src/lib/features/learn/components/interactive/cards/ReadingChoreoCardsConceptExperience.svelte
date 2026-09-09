<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getHandPathReferenceCards } from "$lib/features/choreo-card/domain/hand-path-reference-cards";
  import { HAND_PATH_REFERENCE_SCAN_URLS } from "$lib/features/choreo-card/domain/hand-path-reference-card-manifest";
  import CardAnatomyExplainer from "$lib/features/store/components/CardAnatomyExplainer.svelte";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import LessonStageControls from "../LessonStageControls.svelte";
  import LessonStageFrame from "../LessonStageFrame.svelte";
  import LessonStageHeading from "../LessonStageHeading.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: (nextConceptId?: string) => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const card = getHandPathReferenceCards(["ss"])[0]!;
  const steps = [
    {
      region: "start",
      title: "Start with the start position",
      text: "This first cell shows where both hands begin. The sequence returns here after its last step.",
    },
    {
      region: "steps",
      title: "Read the steps in order",
      text: "Each numbered picture is one hand-path step. Follow them from 1 to 4.",
    },
    {
      region: "qr",
      title: "Scan when you want to see it move",
      text: "The QR code opens this same hand path so you can watch it with the prop and speed you choose.",
    },
  ] as const;

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("reading-choreo-cards");
  const saved = persistence.load();
  let stepIndex = $state(
    Math.min(steps.length - 1, Math.max(0, (saved.step || 1) - 1))
  );
  let highlight = $state<string | null>(steps[stepIndex]!.region);
  const current = $derived(steps[stepIndex]!);

  function goToStep(next: number): void {
    const clamped = Math.min(steps.length - 1, Math.max(0, next));
    if (clamped === stepIndex) return;
    stepIndex = clamped;
    highlight = steps[clamped]!.region;
    persistence.saveStep(clamped + 1);
    haptic?.trigger("selection");
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.("rotation-direction");
  }

  function handleAction(): void {
    if (stepIndex === steps.length - 1) complete();
    else goToStep(stepIndex + 1);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step" || event.defaultPrevented) return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, input, select, textarea, [role='slider']")
    )
      return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handleAction();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  export function handleBack(): void {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="card-reading-experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Reading a Choreo Card lesson, use arrow keys to navigate"
>
  <LessonStageFrame artifactLayout="workshop">
    {#snippet heading()}
      <LessonStageHeading
        key={current.region}
        title={current.title}
        eyebrow="Reading a Choreo Card"
      >
        <p>{current.text}</p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <div class="card-study" aria-label={`${card.name} hand-path card`}>
        <CardAnatomyExplainer
          beginnerCard={{
            sequence: card.sequence,
            qrUrl: HAND_PATH_REFERENCE_SCAN_URLS[card.id],
            title: card.cardTitle,
          }}
          initialHighlight="start"
          bind:highlight
          showShuffle={false}
        />
      </div>
    {/snippet}

    {#snippet controls()}
      <LessonStageControls
        progressAppearance="steps"
        label={stepIndex === steps.length - 1 ? "Finish lesson" : "Next"}
        currentStep={stepIndex + 1}
        totalSteps={steps.length}
        onAction={handleAction}
        onPrevious={handleBack}
        previousDisabled={stepIndex === 0}
        actionIcon={stepIndex === steps.length - 1 ? "check" : "arrow"}
        curriculumLabel="Level 1 · Reading a Choreo Card"
      />
    {/snippet}
  </LessonStageFrame>
</div>

<style>
  .card-reading-experience {
    min-height: 100%;
    color: var(--theme-text);
    outline: none;
  }

  .card-reading-experience :global(.lesson-stage-frame) {
    --lesson-workshop-max: 44rem;
  }

  .card-study {
    width: min(100%, 30rem);
    margin-inline: auto;
  }
</style>
