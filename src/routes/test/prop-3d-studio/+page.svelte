<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import type { CameraStateSnapshot } from "@austencloud/scene-3d";
  import { replaceState } from "$app/navigation";
  import { onDestroy, onMount } from "svelte";

  import Viewer3DCanvas from "$lib/shared/3d/components/Viewer3DCanvas.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/orientation-cycle-extender";
  import { getGenerationOrchestrator } from "$lib/features/create/generate/shared/get-generation-orchestrator";
  import {
    LOOPType,
    Period,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import {
    DifficultyLevel,
    GenerationMode,
    PropContinuity,
  } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { isEffectPreviewLoop } from "$lib/shared/effects/domain/effect-preview-loop-policy";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  type ReviewAngle =
    | "front"
    | "three-quarter"
    | "profile"
    | "back"
    | "top"
    | "detail";

  interface ReviewCamera {
    id: ReviewAngle;
    label: string;
    position: CameraStateSnapshot["position"];
    target: CameraStateSnapshot["target"];
  }

  const REVIEW_PROPS = [
    PropType.CLUB,
    PropType.FAN,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.TRIGENG,
    PropType.TRIQUETRA,
    PropType.TRIQUETRA2,
    PropType.CHICKEN,
    PropType.DOUBLESTAR,
    PropType.EIGHTRINGS,
    PropType.TORCH,
    PropType.DOUBLECONTACTBALL,
    PropType.SWORD,
    PropType.QUIAD,
    PropType.POI,
    PropType.GUITAR,
  ] as const;

  const REVIEW_CAMERAS: readonly ReviewCamera[] = [
    {
      id: "front",
      label: "Front",
      position: { x: 0, y: 0.3, z: -3.75 },
      target: { x: 0, y: 0.15, z: 0.1 },
    },
    {
      id: "three-quarter",
      label: "Three-quarter",
      position: { x: 2.65, y: 0.45, z: -2.65 },
      target: { x: 0, y: 0.15, z: 0.1 },
    },
    {
      id: "profile",
      label: "Profile",
      position: { x: 3.75, y: 0.3, z: 0 },
      target: { x: 0, y: 0.15, z: 0.1 },
    },
    {
      id: "back",
      label: "Back",
      position: { x: 0, y: 0.3, z: 3.75 },
      target: { x: 0, y: 0.15, z: 0.1 },
    },
    {
      id: "top",
      label: "Top",
      position: { x: 0, y: 4.65, z: -0.2 },
      target: { x: 0, y: -0.25, z: 0.15 },
    },
    {
      id: "detail",
      label: "Grip detail",
      position: { x: 1.35, y: 0.75, z: -1.85 },
      target: { x: 0, y: 0.6, z: 0.05 },
    },
  ];

  const DEFAULT_CAMERA: CameraStateSnapshot = {
    position: REVIEW_CAMERAS[1].position,
    rotation: { x: 0, y: 0, z: 0 },
    target: REVIEW_CAMERAS[1].target,
    fov: 48,
    timestamp: 0,
  };

  const viewer = createViewer3DState({
    renderMode: "3d",
    backgroundType: BackgroundType.BLOSSOM,
    camera: DEFAULT_CAMERA,
    performers: [],
    selectedPerformerIndex: 0,
    activeFormation: "line",
    defaultProp: PropType.CHICKEN,
    visiblePlanes: [],
    effectToggles: {},
    sceneFeatures: {
      environment: true,
      stage: false,
      audience: false,
      campfire: false,
      tent: false,
    },
  });
  viewer.hideAllPlanes();
  setViewer3DContext(viewer);

  const effectsConfig = createEffectsConfigState(undefined, { persist: false });
  effectsConfig.setActiveEffect(null);
  setEffectsConfigContext(effectsConfig);
  setScene3DRenderContext(createScene3DRenderState());

  let selectedProp = $state<PropType>(PropType.CHICKEN);
  let activeAngle = $state<ReviewAngle>("three-quarter");
  let sequence = $state.raw<SequenceData | null>(null);
  let preloadedSequence = $state.raw<SequenceData | null>(null);
  let currentStep = $state(0);
  let bpm = $state(76);
  let playing = $state(true);
  let sceneReady = $state(false);
  let loading = $state(true);
  let preloading = $state(false);
  let swapping = $state(false);
  let error = $state("");
  let loopNumber = $state(0);
  let viewportWidth = $state(1600);
  let viewportHeight = $state(900);
  let generationToken = 0;
  let raf = 0;

  const selectedLabel = $derived(getPropTypeDisplayInfo(selectedProp).label);
  const currentLoopLabel = $derived(
    sequence
      ? `${sequence.steps.length}-count rotated LOOP`
      : "Generating rotated LOOP"
  );

  function isReviewProp(value: string | null): value is PropType {
    return REVIEW_PROPS.some((prop) => prop === value);
  }

  function isReviewAngle(value: string | null): value is ReviewAngle {
    return REVIEW_CAMERAS.some((camera) => camera.id === value);
  }

  function syncUrl(): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("prop", selectedProp);
    url.searchParams.set("angle", activeAngle);
    replaceState(url, {});
  }

  function applyCamera(): void {
    if (!sceneReady) return;
    const camera = REVIEW_CAMERAS.find(
      (candidate) => candidate.id === activeAngle
    );
    if (!camera) return;

    const compact = viewportWidth < 760 || viewportHeight < 560;
    const distanceScale = compact ? 1.3 : 1;
    viewer.snapCameraTo(
      {
        x: camera.position.x * distanceScale,
        y: camera.position.y * distanceScale,
        z: camera.position.z * distanceScale,
      },
      camera.target,
      undefined,
      false
    );
  }

  function chooseAngle(angle: ReviewAngle): void {
    activeAngle = angle;
    syncUrl();
    applyCamera();
  }

  function chooseProp(prop: PropType): void {
    selectedProp = prop;
    syncUrl();
  }

  async function generateRotatedLoop(): Promise<SequenceData> {
    const generated = await getGenerationOrchestrator().generateSequence({
      mode: GenerationMode.CIRCULAR,
      length: 16,
      gridMode: GridMode.DIAMOND,
      propType: PropType.STAFF,
      difficulty: DifficultyLevel.INTERMEDIATE,
      propContinuity: PropContinuity.CONTINUOUS,
      turnIntensity: 1,
      loopType: LOOPType.ROTATED,
      period: Period.QUARTERED,
    });
    const extended = orientationCycleExtender.extendIfNeeded(generated);
    if (!isEffectPreviewLoop(extended)) {
      throw new Error("The generated motion did not close cleanly.");
    }
    return extended;
  }

  async function preloadNextLoop(): Promise<void> {
    if (preloading || preloadedSequence) return;
    preloading = true;
    try {
      preloadedSequence = await generateRotatedLoop();
    } catch (cause: unknown) {
      error =
        cause instanceof Error
          ? cause.message
          : "The next LOOP could not be generated.";
    } finally {
      preloading = false;
    }
  }

  function installSequence(next: SequenceData): void {
    sequence = next;
    currentStep = 0;
    loopNumber += 1;
    viewer.enter3D(next);
    viewer.hideAllPlanes();
    applyCamera();
  }

  async function advanceLoop(): Promise<void> {
    if (swapping) return;
    swapping = true;
    try {
      const next = preloadedSequence ?? (await generateRotatedLoop());
      preloadedSequence = null;
      installSequence(next);
      error = "";
      void preloadNextLoop();
    } catch (cause: unknown) {
      error =
        cause instanceof Error
          ? cause.message
          : "A new LOOP could not be generated.";
    } finally {
      swapping = false;
      loading = false;
    }
  }

  function handleSceneReady(ready: boolean): void {
    sceneReady = ready;
    applyCamera();
  }

  $effect(() => {
    void viewportWidth;
    void viewportHeight;
    applyCamera();
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProp = params.get("prop");
    const requestedAngle = params.get("angle");
    if (isReviewProp(requestedProp)) selectedProp = requestedProp;
    if (isReviewAngle(requestedAngle)) activeAngle = requestedAngle;

    const token = ++generationToken;
    void generateRotatedLoop()
      .then((initial) => {
        if (token !== generationToken) return;
        installSequence(initial);
        loading = false;
        void preloadNextLoop();
      })
      .catch((cause: unknown) => {
        if (token !== generationToken) return;
        loading = false;
        error =
          cause instanceof Error
            ? cause.message
            : "The first LOOP could not be generated.";
      });

    let previous = performance.now();
    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (playing && sequence && !swapping) {
        currentStep += deltaSeconds * (bpm / 60);
        if (
          currentStep >= sequence.steps.length / 2 &&
          !preloadedSequence &&
          !preloading
        ) {
          void preloadNextLoop();
        }
        if (currentStep >= sequence.steps.length) {
          currentStep %= sequence.steps.length;
          void advanceLoop();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    generationToken += 1;
    if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
    viewer.dispose();
  });
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<svelte:head>
  <title>3D prop studio</title>
  <meta
    name="description"
    content="Inspect a prop from six camera angles while a performer cycles through generated rotated LOOPs."
  />
</svelte:head>

<main
  class="studio"
  data-prop-studio-ready={sceneReady && sequence ? "true" : "false"}
  data-prop-studio-prop={selectedProp}
  data-prop-studio-angle={activeAngle}
  data-prop-studio-loop={loopNumber}
>
  <section class="stage" aria-label="Live 3D prop review">
    {#if sequence}
      <Viewer3DCanvas
        sequenceData={sequence}
        {currentStep}
        isPlaying={playing}
        {bpm}
        bluePropType={selectedProp}
        redPropType={selectedProp}
        hideOverlays
        hideSceneMarkers
        hidePerformerBadges
        onSceneReadyChange={handleSceneReady}
      />
    {/if}

    <div class="stage-shade" aria-hidden="true"></div>

    <header class="title-block">
      <p class="eyebrow"><span class:ready={sceneReady}></span>Prop workshop</p>
      <h1>{selectedLabel}</h1>
      <p>{currentLoopLabel}. LOOP #{loopNumber || 1}.</p>
    </header>

    {#if loading}
      <div class="status-card" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <strong>Generating the first LOOP</strong>
      </div>
    {:else if error}
      <div class="status-card error" role="alert">
        <strong>Motion generation stopped</strong>
        <span>{error}</span>
        <button type="button" onclick={() => void advanceLoop()}
          >Try again</button
        >
      </div>
    {/if}

    <aside class="review-deck" aria-label="Prop review controls">
      <div class="control-group">
        <span class="control-label">Camera</span>
        <div class="button-row">
          {#each REVIEW_CAMERAS as camera}
            <button
              type="button"
              class:active={activeAngle === camera.id}
              aria-pressed={activeAngle === camera.id}
              onclick={() => chooseAngle(camera.id)}
            >
              {camera.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-group prop-group">
        <span class="control-label">Audit prop</span>
        <div class="button-row prop-row themed-scrollbar">
          {#each REVIEW_PROPS as prop}
            <button
              type="button"
              class:active={selectedProp === prop}
              aria-pressed={selectedProp === prop}
              onclick={() => chooseProp(prop)}
            >
              {getPropTypeDisplayInfo(prop).label}
            </button>
          {/each}
        </div>
      </div>

      <div class="transport-row">
        <button
          type="button"
          class="transport"
          aria-pressed={!playing}
          onclick={() => (playing = !playing)}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <label>
          <span>Tempo</span>
          <input type="range" min="35" max="110" step="1" bind:value={bpm} />
          <strong>{bpm} BPM</strong>
        </label>
        <button type="button" class="next" onclick={() => void advanceLoop()}>
          New rotated LOOP
        </button>
        <span class="preload-state" aria-live="polite">
          {preloading
            ? "Preparing next LOOP"
            : preloadedSequence
              ? "Next LOOP ready"
              : "Waiting for first LOOP"}
        </span>
      </div>
    </aside>
  </section>
</main>

<style>
  .studio {
    --studio-panel: var(--theme-panel-bg, rgba(12, 15, 24, 0.96));
    --studio-card: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    --studio-stroke: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    --studio-accent: var(--theme-accent, #67a8ff);
    position: fixed;
    inset: 0;
    min-width: 0;
    min-height: 0;
    background: #070911;
    color: var(--theme-text, #f6f7fb);
    container-type: size;
  }

  .stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .stage-shade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(4, 6, 12, 0.3), transparent 20%),
      linear-gradient(0deg, rgba(4, 6, 12, 0.72), transparent 32%);
  }

  .title-block {
    position: absolute;
    top: clamp(18px, 3cqh, 34px);
    left: clamp(18px, 3cqw, 42px);
    pointer-events: none;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    color: rgba(255, 255, 255, 0.58);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .eyebrow span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--semantic-warning, #f6bb42);
    box-shadow: 0 0 10px currentColor;
  }

  .eyebrow span.ready {
    background: var(--semantic-success, #4fd79d);
  }

  h1 {
    margin: 0;
    font-size: clamp(34px, 5cqw, 72px);
    line-height: 0.94;
    letter-spacing: -0.045em;
  }

  .title-block > p:last-child {
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.68);
    font-size: var(--font-size-min, 14px);
  }

  .review-deck {
    position: absolute;
    right: clamp(12px, 2.2cqw, 30px);
    bottom: clamp(12px, 2.4cqh, 28px);
    left: clamp(12px, 2.2cqw, 30px);
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.5fr);
    gap: 12px 16px;
    padding: 14px;
    border: 1px solid var(--studio-stroke);
    border-radius: var(--settings-border-radius-lg, 16px);
    background: var(--studio-panel);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.36);
  }

  .control-group {
    min-width: 0;
  }

  .control-label {
    display: block;
    margin-bottom: 7px;
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .button-row {
    display: flex;
    gap: 7px;
  }

  .prop-row {
    max-width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  button {
    min-height: 44px;
    padding: 9px 13px;
    border: 1px solid var(--studio-stroke);
    border-radius: var(--settings-border-radius-md, 10px);
    background: var(--studio-card);
    color: rgba(255, 255, 255, 0.78);
    font: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    white-space: nowrap;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: #fff;
  }

  button.active {
    border-color: var(--studio-accent);
    background: color-mix(
      in srgb,
      var(--studio-accent) 20%,
      var(--studio-card)
    );
    color: #fff;
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--studio-accent) 38%, transparent);
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--studio-accent);
    outline-offset: 2px;
  }

  .transport-row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--studio-stroke);
  }

  .transport {
    min-width: 76px;
  }

  label {
    display: grid;
    grid-template-columns: auto minmax(120px, 260px) auto;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.65);
    font-size: var(--font-size-min, 14px);
  }

  input[type="range"] {
    accent-color: var(--studio-accent);
  }

  .next {
    margin-left: auto;
    border-color: color-mix(in srgb, var(--studio-accent) 60%, transparent);
  }

  .preload-state {
    min-width: 130px;
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
  }

  .status-card {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(430px, calc(100vw - 32px));
    padding: 16px 18px;
    border: 1px solid var(--studio-stroke);
    border-radius: var(--settings-border-radius-lg, 16px);
    background: var(--studio-panel);
    transform: translate(-50%, -50%);
    font-size: var(--font-size-min, 14px);
  }

  .status-card.error {
    flex-wrap: wrap;
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef596f) 60%,
      transparent
    );
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.18);
    border-top-color: var(--studio-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @container (max-width: 760px), (max-height: 620px) {
    .title-block {
      max-width: calc(100% - 36px);
    }

    h1 {
      font-size: clamp(30px, 9cqw, 48px);
    }

    .review-deck {
      grid-template-columns: minmax(0, 1fr);
      max-height: 47cqh;
      overflow-y: auto;
    }

    .button-row {
      overflow-x: auto;
    }

    .transport-row {
      flex-wrap: wrap;
    }

    label {
      flex: 1 1 260px;
    }

    .next {
      margin-left: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
