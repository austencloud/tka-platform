<script lang="ts">
  /**
   * One notation surface progresses from grid to playback. The public sequence
   * loading and domain transformations are unchanged from the previous card row.
   */
  import { onMount } from "svelte";
  import { ToggleGroup } from "bits-ui";
  import { doc, getDoc } from "firebase/firestore";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import { getPublicSequencesPath } from "$lib/shared/library/data/firestore-paths";
  import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/public-sequence-index";
  import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import HowTkaAnimationCard from "./HowTkaAnimationCard.svelte";
  import {
    ASSEMBLY_STEPS,
    getInitialAssemblyStep,
    getNextAssemblyStep,
    type AssemblyStep,
  } from "./how-tka-assembly-model";

  interface Props {
    propType?: PropType;
  }

  let { propType = PropType.STAFF }: Props = $props();

  let sequence = $state<SequenceData | null>(null);
  let startPos = $state<StartPositionData | null>(null);
  let firstStep = $state<StepData | null>(null);
  let emptyGridData = $state<PictographData | null>(null);
  let gridOnlyData = $state<PictographData | null>(null);
  let propsData = $state<PictographData | null>(null);
  let motionData = $state<PictographData | null>(null);
  let loaded = $state(false);

  let activeStep = $state<AssemblyStep>("grid");
  let userEngaged = $state(false);
  let sectionVisible = $state(false);
  let sectionEl: HTMLElement | undefined = $state();
  let railOrientation = $state<"horizontal" | "vertical">("vertical");
  let reducedMotion = $state(false);
  let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  const activeDefinition = $derived(
    ASSEMBLY_STEPS.find((step) => step.value === activeStep) ??
      ASSEMBLY_STEPS[0]
  );
  const pictographStep = $derived(
    activeStep === "sequence" || activeStep === "playback"
      ? "motion"
      : activeStep
  );
  const activePictographData = $derived.by(() => {
    if (pictographStep === "grid") return emptyGridData;
    if (pictographStep === "hands") return gridOnlyData;
    if (pictographStep === "props") return propsData;
    return motionData;
  });

  const LANDING_SEQUENCE_ID = "3b7882d6-a87d-4b57-bbfe-8eacb9e39f04";

  function forceProps(
    motion: MotionData | undefined | null
  ): MotionData | undefined {
    if (!motion) return undefined;
    return { ...motion, propType };
  }

  function setupFromSequence(full: SequenceData) {
    sequence = full;
    firstStep = full.steps[0] ?? null;

    const derived = startPositionDeriver.getOrDeriveStartPosition(full);
    startPos = derived as StartPositionData | null;

    emptyGridData = {
      id: "how-empty-grid",
      letter: undefined,
      startPosition: null,
      endPosition: null,
      motions: {},
    };

    if (startPos) {
      gridOnlyData = {
        id: "how-hands",
        letter: Letter.ALPHA,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: startPos.motions?.blue
            ? { ...startPos.motions.blue, propType: PropType.HAND }
            : undefined,
          red: startPos.motions?.red
            ? { ...startPos.motions.red, propType: PropType.HAND }
            : undefined,
        },
      };

      propsData = {
        id: startPos.id ?? "how-props",
        letter: Letter.ALPHA,
        stepNumber: 0,
        startPosition: startPos.startPosition,
        endPosition: startPos.endPosition,
        motions: {
          blue: forceProps(startPos.motions?.blue),
          red: forceProps(startPos.motions?.red),
        },
      } as PictographData;
    }

    if (firstStep) {
      motionData = {
        id: firstStep.id ?? "how-motion",
        letter: (firstStep.letter || undefined) as Letter | undefined,
        stepNumber: 1,
        startPosition: firstStep.startPosition,
        endPosition: firstStep.endPosition,
        motions: {
          blue: forceProps(firstStep.motions?.blue),
          red: forceProps(firstStep.motions?.red),
        },
      } as PictographData;
    }
  }

  function clearAutoAdvance() {
    if (!autoAdvanceTimer) return;
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  function engage() {
    userEngaged = true;
    clearAutoAdvance();
  }

  function selectStep(value: string) {
    const stepExists = ASSEMBLY_STEPS.some((step) => step.value === value);
    if (!value || !stepExists) return;
    engage();
    activeStep = value as AssemblyStep;
  }

  onMount(() => {
    if (!sectionEl) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 640px)");
    const syncMedia = () => {
      reducedMotion = motionQuery.matches;
      railOrientation = compactQuery.matches ? "horizontal" : "vertical";
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        sectionVisible = entry?.isIntersecting ?? false;
      },
      { rootMargin: "100px", threshold: 0.2 }
    );

    syncMedia();
    activeStep = getInitialAssemblyStep(reducedMotion);
    motionQuery.addEventListener("change", syncMedia);
    compactQuery.addEventListener("change", syncMedia);
    observer.observe(sectionEl);

    return () => {
      clearAutoAdvance();
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMedia);
      compactQuery.removeEventListener("change", syncMedia);
    };
  });

  onMount(async () => {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(
        firestore,
        getPublicSequencesPath(),
        LANDING_SEQUENCE_ID
      );
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        console.warn(
          "[HowTkaWorks] Landing sequence not found in publicSequences"
        );
        return;
      }

      const data = snap.data() as PublicSequenceIndex;
      const seq: SequenceData = {
        id: snap.id,
        name: data.name,
        word: data.word,
        steps: [],
        thumbnails: [...data.thumbnails],
        sequenceLength: data.sequenceLength,
        level: data.level,
        isFavorite: false,
        isCircular: !!data.loopType,
        loopType: (data.loopType as LOOPType) ?? null,
        tags: [...data.tags],
        metadata: {},
        ownerId: data.ownerId,
        blueSoloProp: data.blueSoloProp,
        redSoloProp: data.redSoloProp,
        stepPairings: data.stepPairings,
        bluePathHash: data.bluePathHash,
        redPathHash: data.redPathHash,
        blueSoloHash: data.blueSoloHash,
        redSoloHash: data.redSoloHash,
      };

      if (data.blueSoloProp && data.redSoloProp && data.stepPairings) {
        const hydrated = hydrate(seq);
        if (hydrated.steps && hydrated.steps.length > 0) {
          setupFromSequence({
            ...hydrated,
            sequenceLength: hydrated.steps.length,
          });
          return;
        }
      }

      console.warn(
        "[HowTkaWorks] Landing sequence has no compositional data to hydrate"
      );
    } catch (error) {
      console.error("[HowTkaWorks] Failed to load landing sequence:", error);
    } finally {
      loaded = true;
    }
  });

  $effect(() => {
    clearAutoAdvance();
    if (!loaded || !sequence || !sectionVisible || reducedMotion || userEngaged)
      return;

    const next = getNextAssemblyStep(activeStep);
    if (!next) return;

    autoAdvanceTimer = setTimeout(() => {
      activeStep = next;
      autoAdvanceTimer = null;
    }, activeDefinition.delayMs);

    return clearAutoAdvance;
  });
</script>

<section class="how-tka-works" bind:this={sectionEl}>
  <div class="section-intro">
    <p class="section-kicker">How TKA works</p>
    <h2>How it works</h2>
    <p class="section-subtitle">
      Start with the grid. Add hands, props, and motion. String the steps
      together, then press play.
    </p>
  </div>

  {#if loaded && sequence}
    <div class="assembly-table">
      <p class="sr-only" aria-live="polite">
        {userEngaged ? activeDefinition.stageLabel : ""}
      </p>

      <div
        class="assembly-stage"
        data-step={activeStep}
        aria-label={activeDefinition.stageLabel}
        onpointerdown={engage}
      >
        <div
          class="stage-layer pictograph-layer"
          class:is-active={activeStep !== "sequence" &&
            activeStep !== "playback"}
          hidden={activeStep === "sequence" || activeStep === "playback"}
          aria-hidden={activeStep === "sequence" || activeStep === "playback"}
        >
          {#if activePictographData}
            <div class="pictograph-stage">
              <PictographContainer
                pictographData={activePictographData}
                gridMode={GridMode.DIAMOND}
                bluePropTypeOverride={pictographStep === "hands"
                  ? PropType.HAND
                  : propType}
                redPropTypeOverride={pictographStep === "hands"
                  ? PropType.HAND
                  : propType}
                showGrid={true}
                showTKA={pictographStep !== "grid"}
                showReversals={false}
                showPositions={pictographStep === "motion"}
                showHandPoints={pictographStep !== "grid"}
                showBlueMotion={pictographStep === "motion"}
                showRedMotion={pictographStep === "motion"}
                darkMode={false}
                disableTransitions={false}
              />
            </div>
          {/if}
        </div>

        <div
          class="stage-layer sequence-layer"
          class:is-active={activeStep === "sequence"}
          hidden={activeStep !== "sequence"}
          aria-hidden={activeStep !== "sequence"}
        >
          <div class="sequence-stage">
            <ChoreoCard
              {sequence}
              darkMode={false}
              columnCount={2}
              bluePropType={propType}
              redPropType={propType}
              startPositionLayoutOverride="column"
              showMandala={true}
              showCreatorName={false}
              showNotes={false}
              showBirthday={false}
            />
          </div>
        </div>

        <div
          class="stage-layer animation-layer"
          class:is-active={activeStep === "playback"}
          hidden={activeStep !== "playback"}
          aria-hidden={activeStep !== "playback"}
        >
          <div class="animation-stage">
            <HowTkaAnimationCard
              {sequence}
              {propType}
              active={activeStep === "playback"}
            />
          </div>
        </div>
      </div>

      <ToggleGroup.Root
        type="single"
        value={activeStep}
        onValueChange={selectStep}
        orientation={railOrientation}
        rovingFocus={true}
        class="step-rail"
        aria-label="Notation assembly stages"
        onfocusin={engage}
      >
        {#each ASSEMBLY_STEPS as step}
          <ToggleGroup.Item value={step.value} class="step-control">
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  {:else if loaded}
    <div class="assembly-table assembly-error">
      <div class="assembly-stage error-stage" role="status">
        <p>Couldn't load the notation example.</p>
      </div>
      <ToggleGroup.Root
        type="single"
        value={activeStep}
        onValueChange={selectStep}
        orientation={railOrientation}
        rovingFocus={true}
        class="step-rail"
        aria-label="Notation assembly stages"
        onfocusin={engage}
      >
        {#each ASSEMBLY_STEPS as step}
          <ToggleGroup.Item value={step.value} class="step-control">
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  {:else}
    <div class="assembly-table section-loading" aria-hidden="true">
      <div class="assembly-stage loading-stage"></div>
      <div class="step-rail loading-rail">
        {#each ASSEMBLY_STEPS as step}
          <div class="loading-control">
            <span>{step.number}</span>
            <i></i>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .how-tka-works {
    --assembly-paper: var(--theme-background, #f3f0e8);
    --assembly-ink: var(--theme-text, #171821);
    --assembly-void: var(--landing-void, #070910);
    --assembly-navy: var(--landing-cosmic-navy, #111735);
    --assembly-blue: var(--prop-blue, #4c8dff);
    --assembly-red: var(--prop-red, #ff4c5e);
    --assembly-copy: rgba(255, 255, 255, 0.64);
    --assembly-line: rgba(255, 255, 255, 0.17);
    --assembly-line-strong: rgba(255, 255, 255, 0.38);
    --assembly-stage-border: rgba(255, 255, 255, 0.7);
    --assembly-stage-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
    --assembly-skeleton: rgba(255, 255, 255, 0.08);

    box-sizing: border-box;
    width: min(calc(100% - 48px), 1480px);
    margin: 0 auto;
    padding: 88px 0 96px;
    container-type: inline-size;
  }

  .section-intro {
    max-width: 720px;
    margin-bottom: clamp(36px, 5vw, 60px);
  }

  .section-kicker {
    margin: 0 0 12px;
    color: var(--assembly-blue);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: #f5f5f5;
    font-family: var(
      --landing-heading-font,
      "Playfair Display",
      Georgia,
      serif
    );
    font-size: clamp(2.35rem, 5vw, 4.2rem);
    font-weight: 400;
    line-height: 0.98;
  }

  .section-subtitle {
    max-width: 660px;
    margin: 20px 0 0;
    color: var(--assembly-copy);
    font-size: clamp(var(--font-size-min, 14px), 1.5vw, 1.1rem);
    line-height: 1.65;
  }

  .assembly-table {
    display: grid;
    grid-template-columns: minmax(0, 1.58fr) minmax(320px, 0.62fr);
    align-items: stretch;
    gap: clamp(30px, 4.2vw, 64px);
  }

  .assembly-stage {
    position: relative;
    min-width: 0;
    min-height: clamp(500px, 44vw, 700px);
    overflow: hidden;
    border: 1px solid var(--assembly-stage-border);
    border-radius: clamp(18px, 2vw, 30px);
    background: var(--assembly-paper);
    box-shadow: var(--assembly-stage-shadow);
    isolation: isolate;
  }

  .assembly-stage::after {
    position: absolute;
    right: 22px;
    bottom: 18px;
    width: 42px;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--assembly-blue) 0 50%,
      var(--assembly-red) 50%
    );
    content: "";
    opacity: 0.9;
    z-index: 3;
  }

  .stage-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 4vw, 64px);
  }

  .stage-layer[hidden] {
    display: none;
  }

  .pictograph-stage,
  .animation-stage {
    width: min(72%, 620px);
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 14px;
  }

  .animation-stage {
    background: var(--assembly-void);
    box-shadow: 0 18px 44px rgba(7, 9, 16, 0.3);
  }

  .sequence-stage {
    display: flex;
    width: min(76%, 760px);
    height: min(88%, 620px);
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 14px;
  }

  .step-rail {
    position: relative;
    display: grid;
    align-content: center;
    min-width: 0;
    padding: 22px 0;
  }

  .step-rail::before {
    position: absolute;
    top: 10%;
    bottom: 10%;
    left: 24px;
    width: 1px;
    background: var(--assembly-line);
    content: "";
  }

  .step-control {
    position: relative;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: center;
    width: 100%;
    min-height: 66px;
    padding: 10px 10px 10px 0;
    border: 0;
    border-bottom: 1px solid var(--assembly-line);
    background: transparent;
    color: var(--assembly-copy);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .step-control:first-of-type {
    border-top: 1px solid var(--assembly-line);
  }

  .step-control:hover {
    color: #fff;
  }

  .step-control:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 5px;
    border-radius: 4px;
  }

  .step-control[data-state="on"] {
    border-color: var(--assembly-line-strong);
    color: #fff;
    font-weight: 650;
  }

  .step-number {
    position: relative;
    z-index: 1;
    display: inline-flex;
    width: 48px;
    height: 44px;
    align-items: center;
    justify-content: flex-start;
    color: rgba(255, 255, 255, 0.48);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
  }

  .step-number::before {
    position: absolute;
    left: 20px;
    width: 9px;
    height: 9px;
    border: 1px solid var(--assembly-line-strong);
    border-radius: 50%;
    background: var(--assembly-void);
    content: "";
    transform: translateX(-50%);
  }

  .step-control[data-state="on"] .step-number {
    color: #fff;
  }

  .step-control[data-state="on"] .step-number::before {
    width: 13px;
    height: 13px;
    border-color: var(--assembly-blue);
    background: var(--assembly-blue);
    box-shadow: 0 0 0 4px
      color-mix(in srgb, var(--assembly-blue) 18%, transparent);
  }

  .step-label {
    padding-left: 12px;
    font-family: var(
      --landing-heading-font,
      "Playfair Display",
      Georgia,
      serif
    );
    font-size: clamp(1.05rem, 1.8vw, 1.42rem);
    line-height: 1.2;
  }

  .error-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--assembly-ink);
    text-align: center;
  }

  .error-stage p {
    margin: 0;
    font-size: 1rem;
  }

  .loading-stage,
  .loading-control i {
    background: var(--assembly-skeleton);
  }

  .loading-stage {
    border-color: var(--assembly-line);
    box-shadow: none;
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

  .loading-stage::after {
    display: none;
  }

  .loading-rail {
    pointer-events: none;
  }

  .loading-control {
    display: grid;
    grid-template-columns: 48px 1fr;
    min-height: 66px;
    align-items: center;
    border-bottom: 1px solid var(--assembly-line);
    color: rgba(255, 255, 255, 0.35);
    font-size: 0.72rem;
  }

  .loading-control i {
    width: 68%;
    height: 13px;
    border-radius: 4px;
    animation: skeleton-pulse 1.8s ease-in-out infinite;
  }

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

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.9;
    }
  }

  @container (max-width: 1050px) and (min-width: 720px) {
    .assembly-table {
      grid-template-columns: minmax(0, 1.48fr) minmax(280px, 0.72fr);
      gap: 28px;
    }

    .step-label {
      font-size: 1.02rem;
    }
  }

  @media (max-width: 919px) {
    .how-tka-works {
      width: min(calc(100% - 40px), 900px);
      padding: 72px 0 80px;
    }

    .assembly-table {
      grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.75fr);
      gap: 28px;
    }

    .assembly-stage {
      min-height: 470px;
    }

    .step-control {
      min-height: 62px;
    }
  }

  @media (max-width: 760px) {
    .how-tka-works {
      width: min(calc(100% - 32px), 680px);
      padding: 56px 0 64px;
    }

    .section-intro {
      margin-bottom: 32px;
    }

    h2 {
      font-size: clamp(2.35rem, 12vw, 3.2rem);
    }

    .section-subtitle {
      font-size: var(--font-size-min, 14px);
    }

    .assembly-table {
      grid-template-columns: 1fr;
      gap: 22px;
    }

    .assembly-stage {
      min-height: 0;
      aspect-ratio: 1;
      border-radius: 20px;
    }

    .stage-layer {
      padding: clamp(20px, 7vw, 42px);
    }

    .pictograph-stage,
    .animation-stage {
      width: min(80%, 430px);
    }

    .sequence-stage {
      width: min(88%, 470px);
      height: 90%;
    }

    .step-rail {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 0;
      border-top: 1px solid var(--assembly-line);
      border-left: 1px solid var(--assembly-line);
    }

    .step-rail::before {
      display: none;
    }

    .step-control {
      grid-template-columns: 36px minmax(0, 1fr);
      min-height: 64px;
      padding: 7px 8px;
      border: 0;
      border-right: 1px solid var(--assembly-line);
      border-bottom: 1px solid var(--assembly-line);
    }

    .step-control:first-of-type {
      border-top: 0;
    }

    .step-number {
      width: 36px;
    }

    .step-number::before {
      display: none;
    }

    .step-label {
      padding-left: 0;
      font-size: clamp(0.9rem, 4.2vw, 1.02rem);
    }

    .loading-rail {
      display: grid;
    }

    .loading-control {
      grid-template-columns: 36px 1fr;
      min-height: 64px;
      padding: 7px 8px;
      border-right: 1px solid var(--assembly-line);
      border-bottom: 1px solid var(--assembly-line);
    }
  }

  @media (min-width: 2200px) {
    .how-tka-works {
      width: min(74vw, 2840px);
      max-width: none;
      padding: 120px 0 132px;
    }

    .section-intro {
      max-width: 920px;
      margin-bottom: 72px;
    }

    .section-kicker {
      font-size: 0.9rem;
    }

    h2 {
      font-size: 4.5rem;
    }

    .section-subtitle {
      max-width: 840px;
      font-size: 1.25rem;
    }

    .assembly-table {
      grid-template-columns: minmax(0, 1250px) minmax(460px, 660px);
      justify-content: center;
      column-gap: clamp(72px, 7vw, 280px);
    }

    .assembly-stage {
      min-height: 780px;
    }

    .pictograph-stage,
    .animation-stage {
      width: min(72%, 760px);
    }

    .sequence-stage {
      width: min(78%, 900px);
      height: min(90%, 700px);
    }

    .step-control {
      min-height: 82px;
    }

    .step-label {
      font-size: 1.55rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-stage,
    .loading-control i {
      animation: none;
    }
  }
</style>
