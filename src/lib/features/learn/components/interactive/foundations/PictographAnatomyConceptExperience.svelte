<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getCodexLetterMappingRepo } from "$lib/features/learn/codex/get-codex-letter-mapping-repo";
  import ArtifactRegionSpotlight from "$lib/shared/components/ArtifactRegionSpotlight.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { derivePropElementalType } from "$lib/shared/shape-matrix/domain/prop-relationship";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  type Region = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  const STEPS = [
    {
      text: "A pictograph shows one step of motion.",
      label: "Whole pictograph",
      region: null,
    },
    {
      text: "Top left: the step number.",
      label: "Step number",
      region: { x: 0, y: 0, width: 25, height: 24 },
    },
    {
      text: "Top center: where the hands start and end.",
      label: "Start and end",
      region: { x: 27, y: 0, width: 46, height: 24 },
    },
    {
      text: "Bottom left: the TKA letter and its turns.",
      label: "Letter and turns",
      region: { x: 0, y: 68, width: 38, height: 32 },
    },
    {
      text: "Bottom right: the hands’ timing and direction.",
      label: "Hand timing and direction",
      region: { x: 67, y: 68, width: 33, height: 32 },
    },
    {
      text: "Top right: the props’ timing and direction.",
      label: "Prop timing and direction",
      region: { x: 68, y: 0, width: 32, height: 28 },
    },
    {
      text: "In the middle: the props and the paths your hands follow.",
      label: "Props and hand paths",
      region: { x: 16, y: 18, width: 68, height: 66 },
    },
  ] as const satisfies readonly {
    text: string;
    label: string;
    region: Region | null;
  }[];

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("letter-codex-intro");
  const saved = persistence.load();
  let stepIndex = $state(
    Math.min(STEPS.length - 1, Math.max(0, (saved.step || 1) - 1))
  );
  let direction = $state<-1 | 1>(1);
  let pictograph = $state<PictographData | null>(null);
  let loading = $state(true);
  let error = $state(false);
  const current = $derived(STEPS[stepIndex]!);
  const anatomyStep = $derived(
    pictograph ? createStepData({ ...pictograph, stepNumber: 1 }) : null
  );
  const propElementalType = $derived.by(() => {
    if (!anatomyStep) return null;
    return derivePropElementalType(
      createSequenceData({
        id: "learn-pictograph-anatomy",
        name: "Pictograph anatomy",
        word: "A",
        steps: [anatomyStep],
        gridMode: GridMode.DIAMOND,
      })
    );
  });

  onMount(async () => {
    loading = true;
    error = false;
    try {
      getCodexLetterMappingRepo();
      pictograph = await letterQueryHandler.getPictographByLetter(
        Letter.A,
        GridMode.DIAMOND
      );
      error = pictograph === null;
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  });

  function goToStep(next: number): void {
    const clamped = Math.min(STEPS.length - 1, Math.max(0, next));
    if (clamped === stepIndex) return;
    direction = clamped > stepIndex ? 1 : -1;
    stepIndex = clamped;
    persistence.saveStep(stepIndex + 1);
    haptic?.trigger("selection");
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      if (stepIndex === STEPS.length - 1) complete();
      else goToStep(stepIndex + 1);
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
  class="experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Pictograph anatomy lesson, use arrow keys to navigate"
>
  <main class="lesson-shell">
    <section class="anatomy-step" aria-labelledby="anatomy-title">
      <div class="instruction-rail">
        <p class="eyebrow">Read a pictograph</p>
        <h1 id="anatomy-title">{current.label}</h1>
        <div class="instruction-copy">
          <Crossfade
            key={stepIndex}
            mode="swap"
            motion="step"
            {direction}
            animateHeight
          >
            <p>{current.text}</p>
          </Crossfade>
        </div>
      </div>

      <div class="artifact-column">
        <div class="pictograph-frame">
          {#if loading}
            <div class="load-state" role="status">
              <ProgressRing percent={-1} size={40} strokeWidth={3} />
              <span>Loading pictograph…</span>
            </div>
          {:else if error || !anatomyStep}
            <div class="load-state" role="alert">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"
              ></i>
              <span>Pictograph unavailable</span>
            </div>
          {:else}
            <PictographContainer
              pictographData={anatomyStep}
              gridMode={GridMode.DIAMOND}
              leftPropTypeOverride={PropType.STAFF}
              rightPropTypeOverride={PropType.STAFF}
              showGrid
              showTKA
              showPositions
              showElemental
              showTnD={false}
              showReversals={false}
              showNonRadialPoints={false}
              showHandPoints
              stepNumberOverride
              {propElementalType}
            />
            {#if current.region}
              <ArtifactRegionSpotlight
                x={current.region.x}
                y={current.region.y}
                width={current.region.width}
                height={current.region.height}
              />
            {/if}
          {/if}
        </div>
      </div>
    </section>

    <footer class="lesson-actions">
      <PanelButton
        variant="secondary"
        onclick={handleBack}
        disabled={stepIndex === 0}
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        <span>Previous</span>
      </PanelButton>
      <ExperienceProgressIndicator
        currentStep={stepIndex + 1}
        totalSteps={STEPS.length}
      />
      {#if stepIndex === STEPS.length - 1}
        <PanelButton variant="primary" onclick={complete}>
          <span>Finish lesson</span>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
        </PanelButton>
      {:else}
        <PanelButton variant="primary" onclick={() => goToStep(stepIndex + 1)}>
          <span>Next</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </PanelButton>
      {/if}
    </footer>
  </main>
</div>

<style>
  .experience {
    container: pictograph-anatomy / inline-size;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    color: var(--theme-text);
    outline: none;
    scrollbar-gutter: stable;
  }
  .lesson-shell {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1rem;
    width: min(100%, 96rem);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(4.5rem, 5cqw, 5.5rem) clamp(0.75rem, 2.5cqw, 2.5rem)
      clamp(0.75rem, 1.5cqw, 1.5rem);
  }
  .anatomy-step {
    display: grid;
    grid-template-columns: minmax(16rem, 23rem) minmax(0, 1fr);
    align-items: center;
    gap: clamp(1rem, 3cqw, 3.5rem);
    min-height: 0;
  }
  .instruction-rail {
    display: grid;
    align-content: center;
    gap: 0.85rem;
    min-height: 12rem;
    padding: clamp(1rem, 1.6cqw, 1.6rem);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-panel-bg);
  }
  .eyebrow {
    margin: 0;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 !important;
    font-size: clamp(1.65rem, 2.7cqw, 2.8rem);
    line-height: 1.05;
    text-wrap: balance;
  }
  .instruction-copy {
    min-height: 4.8rem;
    color: var(--theme-text-dim);
    font-size: clamp(1rem, 1.25cqw, 1.15rem);
    line-height: 1.55;
  }
  .instruction-copy p {
    margin: 0;
  }
  .artifact-column {
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
  }
  .pictograph-frame {
    position: relative;
    width: min(100%, 46rem, 70dvh);
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }
  .load-state {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.8rem;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
  }
  .load-state i {
    color: var(--semantic-error);
    font-size: 1.5rem;
  }
  .lesson-actions {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .lesson-actions > :global(:first-child) {
    justify-self: start;
  }
  .lesson-actions > :global(:last-child) {
    justify-self: end;
  }
  @container pictograph-anatomy (max-width: 760px) {
    .lesson-shell {
      gap: 0.65rem;
      padding-top: 3.9rem;
    }
    .anatomy-step {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      align-content: start;
      gap: 0.65rem;
    }
    .instruction-rail {
      gap: 0.4rem;
      min-height: 7.25rem;
      padding: 0.65rem 0.75rem;
    }
    .instruction-copy {
      min-height: 3.2rem;
      line-height: 1.4;
    }
    .pictograph-frame {
      width: min(100%, 19rem, 42dvh);
    }
    .lesson-actions {
      grid-template-columns: 1fr 1fr;
    }
    .lesson-actions :global(.progress-indicator) {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: center;
    }
    .lesson-actions :global(.panel-btn) {
      width: 100%;
    }
  }
  @container pictograph-anatomy (min-width: 1680px) {
    .lesson-shell {
      width: min(100%, 124rem);
    }
    .anatomy-step {
      grid-template-columns: minmax(20rem, 27rem) minmax(0, 1fr);
    }
    .pictograph-frame {
      width: min(100%, 54rem, 70dvh);
    }
  }
  @container pictograph-anatomy (min-width: 2600px) {
    .lesson-shell {
      width: min(100%, 158rem);
    }
    .anatomy-step {
      grid-template-columns: minmax(24rem, 34rem) minmax(0, 1fr);
    }
    .instruction-rail {
      min-height: 16rem;
    }
    .instruction-copy {
      font-size: 1.45rem;
    }
    .pictograph-frame {
      width: min(100%, 70rem, 70dvh);
    }
  }
  @media (max-height: 620px) and (min-width: 761px) {
    .lesson-shell {
      padding-top: 4rem;
    }
    .anatomy-step {
      grid-template-columns: minmax(15rem, 21rem) minmax(0, 1fr);
    }
    .instruction-rail {
      min-height: 10rem;
      padding: 0.75rem;
    }
    .pictograph-frame {
      width: min(100%, 28rem, 55dvh);
    }
  }
</style>
