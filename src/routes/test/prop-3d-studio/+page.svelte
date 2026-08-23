<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import {
    propFinishState,
    propHasFinishVariants,
    propHasFanAppearanceOptions,
    type CameraStateSnapshot,
    type FanBuild,
    type FanCover,
    type FanFrameColor,
    type PropFinish,
  } from "@austencloud/scene-3d";
  import { replaceState } from "$app/navigation";
  import { onDestroy, onMount, tick, untrack } from "svelte";

  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import {
    clearCameraUrlPose,
    readCameraUrlPose,
    setCameraUrlPose,
  } from "$lib/shared/3d/domain/camera-url-pose";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import {
    LOOPType,
    Period,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import type {
    DifficultyLevel,
    GenerationMode,
    PropContinuity,
  } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
  import {
    findScenePropFamily,
    findScenePropFamilyByRepresentative,
    SCENE_PROP_REPRESENTATIVES,
    SCENE_PROP_TYPES,
  } from "$lib/shared/3d/domain/scene-prop-catalog";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { isEffectPreviewLoop } from "$lib/shared/effects/domain/effect-preview-loop-policy";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { growFade, motionDuration } from "$lib/shared/transitions/motion";
  import { createLayoutFlip } from "$lib/shared/transitions/layout-flip";
  import PropBuildPicker from "./PropBuildPicker.svelte";
  import {
    fanBuildPreviewOptions,
    fanCoverPreviewOptions,
    fanFramePreviewOptions,
    finishPreviewOptions,
    propBuildPreviewImage,
  } from "./prop-build-previews";

  type Viewer3DCanvasComponent =
    typeof import("$lib/shared/3d/components/Viewer3DCanvas.svelte").default;

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

  // The prop is the subject of this studio. Blossom remains enabled and loads
  // into the already-visible sky and stage, but its 14 MB grove no longer keeps
  // the performer and controls behind the loading curtain.
  const INITIAL_REVEAL_DEFERRED_FEATURES = ["environment"] as const;
  const ROTATED_LOOP_CACHE_KEY = "prop-studio:rotated-loop:v1";
  const CIRCULAR_MODE = "circular" as GenerationMode;
  const INTERMEDIATE_DIFFICULTY = "intermediate" as DifficultyLevel;
  const CONTINUOUS_PROPS = "continuous" as PropContinuity;

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

  function isReviewProp(value: string | null): value is PropType {
    return SCENE_PROP_TYPES.some((prop) => prop === value);
  }

  /**
   * Read the deep link BEFORE the viewer is constructed. Viewer3DCamera reads
   * `DEFAULT_CAMERA` when it mounts, so seeding it from the URL is what keeps
   * `?angle=top` from mounting three-quarter and then popping to the top view.
   */
  function readParam(key: string): string | null {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(key);
  }

  const requestedProp = readParam("prop");
  const requestedAngle = readParam("angle");
  const requestedCameraPose =
    typeof window === "undefined"
      ? null
      : readCameraUrlPose(new URLSearchParams(window.location.search), 48);
  const initialProp = isReviewProp(requestedProp)
    ? requestedProp
    : PropType.CHICKEN;
  const initialCamera =
    REVIEW_CAMERAS.find((camera) => camera.id === requestedAngle) ??
    REVIEW_CAMERAS[1];

  const DEFAULT_CAMERA: CameraStateSnapshot = {
    position: requestedCameraPose?.position ?? initialCamera.position,
    rotation: { x: 0, y: 0, z: 0 },
    target: requestedCameraPose?.target ?? initialCamera.target,
    fov: requestedCameraPose?.fov ?? 48,
    timestamp: 0,
  };

  const viewer = createViewer3DState({
    renderMode: "3d",
    backgroundType: BackgroundType.BLOSSOM,
    camera: DEFAULT_CAMERA,
    performers: [],
    selectedPerformerIndex: 0,
    activeFormation: "line",
    defaultProp: initialProp,
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

  setScene3DRenderContext(createScene3DRenderState());

  let selectedProp = $state<PropType>(initialProp);
  let activeAngle = $state<ReviewAngle>(initialCamera.id);
  /**
   * Set the moment the user grabs the scene. While it is set, nothing on this
   * page is allowed to move the camera — a generated LOOP runs out every ~12s
   * and the swap used to re-apply the active preset, which threw away the orbit
   * the user was in the middle of reading a prop from.
   */
  let cameraIsFree = $state(requestedCameraPose !== null);
  /**
   * The app's playback clock, not a local one. It owns the invariant this page
   * used to get wrong: step N's motion spans currentStep N to N+1, so a
   * 16-count LOOP has to reach 17 before it has actually played its closing
   * step, and a seamless LOOP skips the start-position hold on every pass after
   * the first. The hand-rolled counter that wrapped at `steps.length` from zero
   * paid a dead beat at the top and then cut the motion that returns the props
   * to where they started -- the LOOP never closed.
   *
   * `ephemeral` keeps this harness out of the global speed and loop
   * preferences, and the shared-workspace sink is off so a review LOOP cannot
   * light up the beat grid of whatever sequence Create has open behind it.
   */
  const animation = createAnimationPanelState({ ephemeral: true });
  let bpm = $state(76);
  let sceneReady = $state(false);
  let ViewerCanvasComponent = $state<Viewer3DCanvasComponent | null>(null);
  let playback = $state<AnimationPlaybackController | null>(null);
  let viewerModuleSettled = $state(false);
  let initialSequenceSettled = $state(false);
  let error = $state("");
  let loopNumber = $state(0);
  let viewportWidth = $state(1600);
  let viewportHeight = $state(900);
  let generationToken = 0;
  let playbackLoadPromise: Promise<AnimationPlaybackController> | null = null;

  const sequence = $derived(animation.sequenceData);
  const loading = $derived(!viewerModuleSettled || !initialSequenceSettled);
  const currentStep = $derived(animation.currentStep);
  const playing = $derived(animation.isPlaying);

  const selectedLabel = $derived(getPropTypeDisplayInfo(selectedProp).label);
  const selectedFamily = $derived(findScenePropFamily(selectedProp));
  const compactPlayback = $derived(viewportWidth < 1800);

  function syncUrl(): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("prop", selectedProp);
    if (cameraIsFree) {
      url.searchParams.delete("angle");
    } else {
      url.searchParams.set("angle", activeAngle);
      clearCameraUrlPose(url);
    }
    replaceState(url, {});
  }

  function syncFreeCameraToUrl(snapshot: CameraStateSnapshot): void {
    if (typeof window === "undefined" || !cameraIsFree) return;
    const url = new URL(window.location.href);
    url.searchParams.set("prop", selectedProp);
    url.searchParams.delete("angle");
    setCameraUrlPose(url, snapshot);

    // This page reads its starting camera before constructing the viewer rather
    // than reacting to every URL change, so the router-safe replacement lets the
    // URL follow the view without feeding rounded coordinates back into it.
    replaceState(url, {});
  }

  function applyCamera(): void {
    if (!sceneReady || cameraIsFree) return;
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

  /**
   * A DRAG or a wheel over the scene means the camera is the user's now — not a
   * bare click, which moves nothing and shouldn't drop the active preset.
   */
  let dragOrigin: { x: number; y: number } | null = null;

  function sceneDragStart(event: PointerEvent): void {
    dragOrigin = { x: event.clientX, y: event.clientY };
  }

  function sceneDragMove(event: PointerEvent): void {
    if (!dragOrigin) return;
    const moved = Math.hypot(
      event.clientX - dragOrigin.x,
      event.clientY - dragOrigin.y
    );
    if (moved <= 4) return;
    dragOrigin = null;
    cameraIsFree = true;
  }

  function sceneDragEnd(): void {
    dragOrigin = null;
  }

  function chooseProp(prop: PropType): void {
    selectedProp = prop;
    syncUrl();
  }

  function chooseAuditProp(prop: PropType): void {
    // Family tiles stay selected while their detail buttons change the model.
    // Clicking one again should not throw the user back to its first variant.
    if (selectedFamily?.representative === prop) return;
    chooseProp(prop);
  }

  function chooseFinish(finish: PropFinish): void {
    propFinishState.set(finish);
  }

  function chooseFanBuild(build: FanBuild): void {
    propFinishState.setFanBuild(build);
  }

  function chooseFanFrameColor(color: FanFrameColor): void {
    propFinishState.setFanFrameColor(color);
  }

  function chooseFanCover(cover: FanCover): void {
    propFinishState.setFanCover(cover);
  }

  /**
   * Offering Fire/Day beside a staff is a switch wired to nothing, so the row
   * is only here when the selected prop actually owns both builds.
   */
  const showFinishes = $derived(
    propHasFinishVariants(toScenePropType(selectedProp))
  );
  const showFanAppearance = $derived(
    propHasFanAppearanceOptions(toScenePropType(selectedProp))
  );
  const showFanFrameColors = $derived(
    showFanAppearance && propFinishState.fanBuild === "day"
  );
  const showFanCover = $derived(
    showFanAppearance && propFinishState.fanBuild !== "pictograph"
  );
  const showBuildControls = $derived(
    showFinishes || showFanAppearance || selectedFamily !== undefined
  );
  // The outer crossfade belongs to actual panel replacement: moving between
  // prop families. A subtype change keeps its family's primary picker alive so
  // LayoutFlip can carry it to its new width instead of ghosting a second copy
  // over the first one (Triad <-> Trigeng was the clearest offender).
  const buildPanelKey = $derived(
    selectedFamily?.representative ?? selectedProp
  );
  const buildLayoutSignature = $derived(
    [
      buildPanelKey,
      selectedProp,
      propFinishState.fanBuild,
      showFinishes,
      showFanFrameColors,
      showFanCover,
    ].join(":")
  );
  const fanBuildContext = $derived(
    propFinishState.fanBuild === "day" ? "Day fan" : "Fire fan"
  );
  const finishOptions = $derived(finishPreviewOptions(selectedProp));
  const fanBuildOptions = $derived(
    fanBuildPreviewOptions(
      propFinishState.fanFrameColor,
      propFinishState.fanCover
    )
  );
  const fanFrameOptions = $derived(
    fanFramePreviewOptions(propFinishState.fanCover)
  );
  const fanCoverOptions = $derived(
    fanCoverPreviewOptions(
      propFinishState.fanBuild === "day" ? "day" : "fire",
      propFinishState.fanFrameColor
    )
  );
  const familyOptions = $derived(
    selectedFamily?.variants.map((variant) => ({
      ...variant,
      image: propBuildPreviewImage(variant.id),
    })) ?? []
  );

  let buildStageElement: HTMLDivElement | null = null;
  let previousBuildPanelKey: PropType | null = null;
  let previousBuildLayoutSignature: string | null = null;
  let buildLayoutTransitionToken = 0;

  const buildLayoutFlip = createLayoutFlip({
    getRoot: () => buildStageElement,
    groups: [
      {
        selector: "[data-build-layout-key]",
        datasetKey: "buildLayoutKey",
      },
    ],
    getDuration: () => motionDuration(DURATION.emphasis),
  });

  // Capture before Svelte recomposes a family's options, then animate the
  // surviving controls from their old geometry to the new one. New/removed
  // controls own their entrance/exit separately through the shared motion
  // primitives below.
  $effect.pre(() => {
    const panelKey = buildPanelKey;
    const signature = buildLayoutSignature;
    const samePanel = previousBuildPanelKey === panelKey;
    const changed =
      previousBuildLayoutSignature !== null &&
      previousBuildLayoutSignature !== signature;

    previousBuildPanelKey = panelKey;
    previousBuildLayoutSignature = signature;
    if (!samePanel || !changed || !buildStageElement) return;

    const captured = buildLayoutFlip.capture();
    const token = ++buildLayoutTransitionToken;
    void tick().then(() => {
      if (token !== buildLayoutTransitionToken) return;
      if (captured) buildLayoutFlip.play();
    });
  });

  async function generateRotatedLoop(): Promise<SequenceData> {
    const [{ getGenerationOrchestrator }, { orientationCycleExtender }] =
      await Promise.all([
        import("$lib/features/create/generate/shared/get-generation-orchestrator"),
        import("$lib/features/create/generate/circular/services/orientation-cycle-extender"),
      ]);
    const generated = await getGenerationOrchestrator().generateSequence({
      mode: CIRCULAR_MODE,
      length: 16,
      gridMode: GridMode.DIAMOND,
      propType: PropType.STAFF,
      difficulty: INTERMEDIATE_DIFFICULTY,
      propContinuity: CONTINUOUS_PROPS,
      turnIntensity: 1,
      loopType: LOOPType.ROTATED,
      period: Period.QUARTERED,
    });
    const extended = orientationCycleExtender.extendIfNeeded(generated);
    if (!isEffectPreviewLoop(extended)) {
      throw new Error("The generated motion did not close cleanly.");
    }
    cacheRotatedLoop(extended);
    return extended;
  }

  /**
   * The production playback owner is still used here, but it does not belong
   * on the route's critical import path. Its orchestrator reaches application
   * settings, which in turn reaches persistence, auth, analytics, and presence.
   * Starting that branch beside the viewer makes refresh pay both costs once,
   * concurrently, instead of waiting for the whole app branch before the 3D
   * branch can even begin.
   */
  function loadPlaybackController(): Promise<AnimationPlaybackController> {
    playbackLoadPromise ??= Promise.all([
      import("$lib/shared/animation-engine/services/animation-playback-controller"),
      import("$lib/shared/animation-engine/services/animation-loop"),
      import("$lib/shared/animation-engine/services/animation-state-manager"),
      import("$lib/shared/animation-engine/services/sequence-animation-orchestrator"),
    ]).then(
      ([
        { AnimationPlaybackController },
        { AnimationLoop },
        { AnimationStateManager },
        { SequenceAnimationOrchestrator },
      ]) =>
        new AnimationPlaybackController(
          new SequenceAnimationOrchestrator(new AnimationStateManager()),
          new AnimationLoop(),
          { syncSharedWorkspaceState: false }
        )
    );

    return playbackLoadPromise;
  }

  /**
   * A refresh should not pay for Create's generator graph and produce a second
   * random LOOP before the studio can open. Only validated, JSON-safe preview
   * loops cross this boundary; corrupt or stale entries are discarded and the
   * normal generator path takes over.
   */
  function readCachedRotatedLoop(): SequenceData | null {
    if (typeof window === "undefined") return null;

    try {
      const serialized = sessionStorage.getItem(ROTATED_LOOP_CACHE_KEY);
      if (!serialized) return null;
      const cached = JSON.parse(serialized) as SequenceData;
      if (isEffectPreviewLoop(cached)) return cached;
      sessionStorage.removeItem(ROTATED_LOOP_CACHE_KEY);
    } catch {
      sessionStorage.removeItem(ROTATED_LOOP_CACHE_KEY);
    }

    return null;
  }

  function cacheRotatedLoop(sequence: SequenceData): void {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.setItem(ROTATED_LOOP_CACHE_KEY, JSON.stringify(sequence));
    } catch {
      // Storage can be unavailable or full. Generation still succeeded, so the
      // studio remains usable and simply regenerates on the next refresh.
    }
  }

  /** Start a LOOP from the top. The first one, and the deck's own swap button. */
  function installSequence(next: SequenceData): void {
    if (!playback?.initialize(next, animation)) {
      error = "The generated motion could not be played.";
      return;
    }
    animation.setShouldLoop(true);
    playback.setSpeed(bpm / 60);
    loopNumber += 1;
    playback.togglePlayback();
    // Deliberately does NOT touch the camera. `enter3D` leaves it alone, so the
    // view survives the swap — which is the whole point of the fix.
  }

  // A validated LOOP repeats itself. Never replace it at a playback boundary:
  // two independently closed LOOPs can still begin from different poses.
  async function advanceLoop(): Promise<void> {
    try {
      const [next, controller] = await Promise.all([
        generateRotatedLoop(),
        loadPlaybackController(),
      ]);
      playback ??= controller;
      installSequence(next);
      error = "";
    } catch (cause: unknown) {
      error =
        cause instanceof Error
          ? cause.message
          : "A new LOOP could not be generated.";
    }
  }

  /**
   * The avatar builds its own step configs, so every sequence the clock accepts
   * has to reach the viewer -- the first one, a button swap, and the ones the
   * boundary hand-off installs without this page ever calling a function.
   */
  $effect(() => {
    const next = animation.sequenceData;
    if (!next) return;
    untrack(() => {
      viewer.enter3D(next);
      viewer.hideAllPlanes();
    });
  });

  /** Tempo is the clock's, not a number this page multiplies by itself. */
  $effect(() => {
    playback?.setSpeed(bpm / 60);
  });

  function handleBpmChange(nextBpm: number): void {
    bpm = nextBpm;
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
    const token = ++generationToken;
    const cachedSequence = readCachedRotatedLoop();
    const initialSequencePromise = cachedSequence
      ? Promise.resolve(cachedSequence)
      : generateRotatedLoop();

    void import("$lib/shared/3d/components/Viewer3DCanvas.svelte")
      .then(({ default: component }) => {
        if (token !== generationToken) return;
        ViewerCanvasComponent = component;
        viewerModuleSettled = true;
      })
      .catch((cause: unknown) => {
        if (token !== generationToken) return;
        viewerModuleSettled = true;
        error =
          cause instanceof Error
            ? cause.message
            : "The 3D viewer could not be loaded.";
      });

    void Promise.all([loadPlaybackController(), initialSequencePromise])
      .then(([controller, initial]) => {
        if (token !== generationToken) return;
        playback = controller;
        installSequence(initial);
        initialSequenceSettled = true;
      })
      .catch((cause: unknown) => {
        if (token !== generationToken) return;
        initialSequenceSettled = true;
        error =
          cause instanceof Error
            ? cause.message
            : "The first LOOP could not be prepared.";
      });
  });

  onDestroy(() => {
    generationToken += 1;
    playback?.dispose(animation);
    animation.dispose();
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
    content="Inspect and configure real 3D props while a performer cycles through generated rotated LOOPs."
  />
</svelte:head>

<main
  class="studio"
  data-prop-studio-ready={sceneReady && sequence ? "true" : "false"}
  data-prop-studio-prop={selectedProp}
  data-prop-studio-angle={activeAngle}
  data-prop-studio-loop={loopNumber}
  data-prop-studio-step={currentStep.toFixed(3)}
  data-prop-studio-total={animation.totalSteps}
>
  <section class="stage" aria-label="Live 3D prop review">
    {#if sequence && ViewerCanvasComponent}
      <!--
        The wrapper exists so a drag or wheel on the SCENE marks the camera as
        the user's, while clicks on the deck overlay below do not.
      -->
      <div
        class="canvas-holder"
        onpointerdown={sceneDragStart}
        onpointermove={sceneDragMove}
        onpointerup={sceneDragEnd}
        onpointercancel={sceneDragEnd}
        onwheel={() => (cameraIsFree = true)}
      >
        <ViewerCanvasComponent
          sequenceData={sequence}
          {currentStep}
          isPlaying={playing}
          {bpm}
          bluePropType={selectedProp}
          redPropType={selectedProp}
          hideOverlays
          hideSceneMarkers
          hidePerformerBadges
          enableEffects={false}
          initialRevealDeferredFeatures={INITIAL_REVEAL_DEFERRED_FEATURES}
          onSceneReadyChange={handleSceneReady}
          onCameraStateChange={syncFreeCameraToUrl}
        />
      </div>
    {/if}

    <div class="stage-shade" aria-hidden="true"></div>

    <header class="title-block">
      <Crossfade key={selectedLabel} duration={DURATION.normal}>
        <h1>{selectedLabel}</h1>
      </Crossfade>
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
      <div class="deck-top">
        <div
          bind:this={buildStageElement}
          class="build-stage"
          aria-hidden={!showBuildControls}
          inert={!showBuildControls}
        >
          <Crossfade
            key={buildPanelKey}
            duration={DURATION.normal}
            animateHeight
          >
            {#if showFanAppearance}
              <div
                class="fan-build-layout"
                class:has-customization={showFanFrameColors || showFanCover}
              >
                <div
                  class="fan-build-primary"
                  data-build-layout-key="fan-build"
                >
                  <PropBuildPicker
                    label="Build"
                    value={propFinishState.fanBuild}
                    options={fanBuildOptions}
                    onchange={chooseFanBuild}
                  />
                </div>

                {#if showFanFrameColors || showFanCover}
                  <section
                    class="fan-customization"
                    aria-label={`${fanBuildContext} options`}
                    transition:growFade={{
                      duration: DURATION.normal,
                      axis: "y",
                    }}
                  >
                    <header class="customization-heading">
                      <span>Optional add-ons</span>
                      <Crossfade key={fanBuildContext} duration={DURATION.fast}>
                        <strong>{fanBuildContext}</strong>
                      </Crossfade>
                    </header>
                    <div
                      class="fan-modifier-grid"
                      class:has-frame-color={showFanFrameColors}
                    >
                      {#if showFanFrameColors}
                        <div
                          class="fan-modifier frame-color-modifier"
                          transition:growFade={{
                            duration: DURATION.normal,
                            axis: "y",
                          }}
                        >
                          <PropBuildPicker
                            label="Frame color"
                            value={propFinishState.fanFrameColor}
                            options={fanFrameOptions}
                            onchange={chooseFanFrameColor}
                            density="secondary"
                          />
                        </div>
                      {/if}
                      {#if showFanCover}
                        <div
                          class="fan-modifier cover-modifier"
                          data-build-layout-key="fan-cover"
                        >
                          <PropBuildPicker
                            label="Wick cover"
                            value={propFinishState.fanCover}
                            options={fanCoverOptions}
                            onchange={chooseFanCover}
                            density="secondary"
                          />
                        </div>
                      {/if}
                    </div>
                  </section>
                {/if}
              </div>
            {:else if showBuildControls}
              <div class="build-controls" class:has-finish={showFinishes}>
                {#if selectedFamily}
                  <div
                    class="build-picker primary family-picker"
                    data-build-layout-key="family-picker"
                  >
                    <PropBuildPicker
                      label={selectedFamily.controlLabel}
                      value={selectedProp}
                      options={familyOptions}
                      onchange={chooseProp}
                    />
                  </div>
                  {#if showFinishes}
                    <div
                      class="build-picker secondary finish-picker"
                      transition:growFade={{
                        duration: DURATION.normal,
                        axis: "y",
                      }}
                    >
                      <PropBuildPicker
                        label="Finish"
                        value={propFinishState.finish}
                        options={finishOptions}
                        onchange={chooseFinish}
                        density="secondary"
                      />
                    </div>
                  {/if}
                {:else if showFinishes}
                  <div
                    class="build-picker primary solo-finish-picker"
                    data-build-layout-key="solo-finish"
                  >
                    <PropBuildPicker
                      label="Finish"
                      value={propFinishState.finish}
                      options={finishOptions}
                      onchange={chooseFinish}
                    />
                  </div>
                {/if}
              </div>
            {:else}
              <div class="build-controls-empty" aria-hidden="true"></div>
            {/if}
          </Crossfade>
        </div>

        <div
          class="control-group playback-group"
          class:compact={compactPlayback}
        >
          <span class="control-label">Playback</span>
          <div class="transport-row">
            <div class="transport-cell">
              <TransportControls
                isPlaying={playing}
                onPlaybackToggle={() => playback?.togglePlayback()}
              />
            </div>
            <div class="tempo-cell">
              <TempoControl
                {bpm}
                onBpmChange={handleBpmChange}
                showPractice={false}
                presetsMode={compactPlayback ? "popover" : "inline"}
              />
            </div>
            <button
              class="new-loop-button"
              type="button"
              onclick={() => void advanceLoop()}
            >
              <i class="fas fa-rotate" aria-hidden="true"></i>
              <span>New LOOP</span>
            </button>
          </div>
        </div>
      </div>

      <!--
        A grid, not a row. Fourteen prop families in one flex line collapsed every
        button to the 44px touch floor and clipped thirteen of the labels, which
        is the opposite of what an audit surface is for. Column counts are pinned
        per tier and never leave a row of one (17 % cols != 1).
      -->
      <div class="control-group prop-group">
        <span class="control-label">Props</span>
        <div class="prop-grid" role="group" aria-label="Prop to audit">
          {#each SCENE_PROP_REPRESENTATIVES as prop}
            {@const family = findScenePropFamilyByRepresentative(prop)}
            {@const active = family
              ? selectedFamily?.representative === prop
              : selectedProp === prop}
            <button
              type="button"
              class="prop-tile"
              class:active
              aria-pressed={active}
              onclick={() => chooseAuditProp(prop)}
            >
              <span class="tile-art">
                <PropCompositionPreview
                  propType={prop}
                  size={34}
                  darkBackground
                  useSavedOverrides={false}
                />
              </span>
              <span class="tile-label"
                >{family?.tileLabel ?? getPropTypeDisplayInfo(prop).label}</span
              >
            </button>
          {/each}
        </div>
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

  .canvas-holder {
    position: absolute;
    inset: 0;
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

  h1 {
    margin: 0;
    font-size: clamp(30px, 3cqw, 52px);
    line-height: 1;
    letter-spacing: -0.035em;
  }

  .review-deck {
    --studio-control-size: 50px;
    --studio-transport-size: 68px;
    position: absolute;
    right: clamp(12px, 2.2cqw, 30px);
    bottom: clamp(12px, 2.4cqh, 28px);
    left: clamp(12px, 2.2cqw, 30px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding: 14px;
    border: 1px solid var(--studio-stroke);
    border-radius: var(--settings-border-radius-lg, 16px);
    background: var(--studio-panel);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.36);
  }

  .deck-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: end;
    gap: clamp(18px, 2cqw, 30px);
  }

  .control-group {
    min-width: 0;
  }

  .build-stage {
    min-width: 0;
    align-self: end;
  }

  .build-stage :global(.crossfade) {
    min-width: 0;
  }

  .build-controls {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: end;
    gap: 12px;
    min-width: 0;
  }

  .build-controls-empty {
    height: 0;
  }

  .build-picker {
    min-width: 0;
  }

  .family-picker,
  .solo-finish-picker {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .build-controls.has-finish .family-picker {
    grid-column: span 8;
  }

  .finish-picker {
    grid-column: 9 / -1;
    grid-row: 1;
  }

  .fan-build-layout {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: stretch;
    gap: 12px;
    min-width: 0;
  }

  .fan-build-primary {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .fan-build-layout.has-customization .fan-build-primary {
    grid-column: span 8;
  }

  .fan-customization {
    grid-column: 9 / -1;
    grid-row: 1;
  }

  .fan-build-primary,
  .fan-modifier {
    min-width: 0;
  }

  .fan-customization {
    min-width: 0;
    padding: 10px 12px 12px;
    border: 1px solid color-mix(in srgb, var(--studio-accent) 22%, transparent);
    border-radius: var(--settings-border-radius-lg, 16px);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--studio-accent) 8%, transparent),
        transparent 58%
      ),
      rgba(255, 255, 255, 0.025);
  }

  .customization-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    color: color-mix(in srgb, var(--studio-accent) 66%, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .customization-heading strong {
    color: rgba(255, 255, 255, 0.52);
    font-size: 0.92em;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .fan-modifier-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    min-width: 0;
  }

  .cover-modifier {
    grid-column: 1 / -1;
  }

  .fan-modifier-grid.has-frame-color .frame-color-modifier {
    grid-column: 1;
  }

  .fan-modifier-grid.has-frame-color .cover-modifier {
    grid-column: 2;
  }

  .playback-group {
    width: max-content;
    max-width: 100%;
    min-width: 0;
    justify-self: end;
  }

  .control-label {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 7px;
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .playback-group .control-label {
    color: color-mix(in srgb, var(--studio-accent) 78%, white);
  }

  .prop-grid {
    display: grid;
    gap: 7px;
  }

  /*
    Pinned column counts, never `auto-fill`: fourteen is a known count, and
    auto-fill would emit more and thinner tiles as the screen grew. Every count
    here satisfies 14 % cols != 1, so no tier ever strands a row of one.
    Width-only tiers — the compact block below owns what a SHORT screen drops.
  */
  .prop-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @container (min-width: 700px) {
    .prop-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  /*
    Nine from 1200 up, not from 1680: on a 1440x900 laptop six columns cost a
    third row and pushed the deck to 42% of the viewport. Nine keeps it at two
    rows — the two longest names wrap to a second line inside their own tile,
    which costs nothing because the 44px touch floor already reserves the height.
  */
  @container (min-width: 1200px) {
    .prop-grid {
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
  }

  .prop-tile {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 10px;
    text-align: left;
  }

  /*
    The icon is a luxury, the name is the requirement. Below the nine-column tier
    a tile is ~120px wide and the 34px icon leaves 56px of label — narrower than
    the word "Triquetra", which cannot wrap. So the icon only appears where the
    tile can pay for it, and short screens spend the room on rows instead.
  */
  .tile-art {
    display: none;
    flex: 0 0 auto;
    width: var(--tile-art, 34px);
    height: var(--tile-art, 34px);
  }

  @container (min-width: 1200px) and (min-height: 640px) {
    .tile-art {
      display: block;
    }
  }

  /* The preview ships explicit width/height attributes; let the tier drive it. */
  .tile-art :global(svg) {
    width: 100%;
    height: 100%;
  }

  .tile-label {
    min-width: 0;
    white-space: normal;
    line-height: 1.15;
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
    transition:
      transform var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
      color: #fff;
      transform: translateY(-1px);
    }
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

  button:focus-visible {
    outline: 2px solid var(--studio-accent);
    outline-offset: 2px;
  }

  .transport-row {
    display: grid;
    grid-template-areas: "tempo transport next";
    grid-template-columns: max-content auto max-content;
    align-items: center;
    gap: clamp(12px, 1.5cqw, 28px);
  }

  /* At laptop widths the complete BPM editor lives behind its BPM button.
     That preserves every tempo action without letting three preset chips drift
     underneath the primary play control. */
  .playback-group.compact .transport-row {
    grid-template-columns: max-content auto max-content;
  }

  @container (min-width: 761px) and (min-height: 621px) {
    .playback-group.compact .tempo-cell :global(.tempo-wrapper) {
      position: relative;
    }

    .playback-group.compact .tempo-cell :global(.bpm-popover) {
      position: absolute;
      right: 0;
      bottom: calc(100% + 12px);
      left: 0;
      z-index: 2;
      min-width: 280px;
    }
  }

  .transport-cell {
    grid-area: transport;
    justify-self: center;
    --min-touch-target: var(--studio-control-size);
  }

  .transport-cell :global(.transport-controls) {
    margin: 0;
  }

  .transport-cell :global(.play-pause-btn.large) {
    width: var(--studio-transport-size);
    height: var(--studio-transport-size);
    border: 2px solid color-mix(in srgb, var(--studio-accent) 70%, white);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--studio-accent) 92%, white),
      var(--studio-accent)
    );
    color: #06101c;
    font-size: 1.35rem;
    box-shadow:
      0 10px 28px color-mix(in srgb, var(--studio-accent) 38%, transparent),
      0 0 0 5px color-mix(in srgb, var(--studio-accent) 12%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.48);
  }

  .transport-cell :global(.play-pause-btn.large.playing) {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #4fd79d) 78%,
      white
    );
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--semantic-success, #4fd79d) 86%, white),
      var(--semantic-success, #4fd79d)
    );
    color: #06150f;
    box-shadow:
      0 10px 28px
        color-mix(in srgb, var(--semantic-success, #4fd79d) 34%, transparent),
      0 0 0 5px
        color-mix(in srgb, var(--semantic-success, #4fd79d) 12%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.48);
  }

  @media (hover: hover) and (pointer: fine) {
    .transport-cell :global(.play-pause-btn.large:hover:not(:disabled)) {
      transform: translateY(-2px) scale(1.04);
      filter: saturate(1.12) brightness(1.06);
    }
  }

  .tempo-cell {
    grid-area: tempo;
    min-width: 0;
    --min-touch-target: var(--studio-control-size);
  }

  .tempo-cell :global(.tempo-control) {
    justify-content: flex-start;
  }

  .tempo-cell :global(.adjust-btn) {
    border-color: color-mix(in srgb, var(--studio-accent) 30%, transparent);
    background: color-mix(in srgb, var(--studio-accent) 8%, var(--studio-card));
    color: rgba(255, 255, 255, 0.82);
  }

  .tempo-cell :global(.bpm-display) {
    min-width: 82px;
    min-height: calc(var(--studio-control-size) + 4px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .tempo-cell :global(.preset-btn) {
    min-height: var(--studio-control-size);
    border-color: color-mix(in srgb, var(--studio-stroke) 82%, transparent);
  }

  .new-loop-button {
    grid-area: next;
    justify-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: calc(var(--studio-control-size) + 4px);
    padding-inline: 20px;
    border-color: color-mix(in srgb, var(--studio-accent) 58%, white);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--studio-accent) 30%, var(--studio-card)),
      color-mix(in srgb, var(--studio-accent) 16%, var(--studio-card))
    );
    color: #fff;
    box-shadow:
      0 7px 20px color-mix(in srgb, var(--studio-accent) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  .new-loop-button i {
    color: color-mix(in srgb, var(--studio-accent) 68%, white);
    font-size: 1rem;
  }

  @media (hover: hover) and (pointer: fine) {
    .new-loop-button:hover {
      border-color: color-mix(in srgb, var(--studio-accent) 80%, white);
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--studio-accent) 40%, var(--studio-card)),
        color-mix(in srgb, var(--studio-accent) 22%, var(--studio-card))
      );
      box-shadow:
        0 10px 26px color-mix(in srgb, var(--studio-accent) 28%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
    }
  }

  .prop-tile.active {
    border-color: color-mix(in srgb, var(--studio-accent) 82%, white);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--studio-accent) 24%, var(--studio-card)),
      color-mix(in srgb, var(--studio-accent) 12%, var(--studio-card))
    );
    box-shadow:
      0 5px 16px color-mix(in srgb, var(--studio-accent) 18%, transparent),
      inset 0 0 0 1px color-mix(in srgb, var(--studio-accent) 45%, transparent);
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

  /*
    At 4K@100% nothing is scaling for you, so the deck and the controls step up
    together. The first row keeps using the full width instead of collapsing
    into a narrow controls column beside the prop grid.
    Placed after the base `button` rule on purpose — a container query carries no
    extra specificity, so an earlier block would simply lose to it.
  */
  @container (min-width: 2600px) {
    .review-deck {
      --tile-art: 46px;
      --studio-control-size: 60px;
      --studio-transport-size: 84px;
      padding: 22px;
      gap: 18px;
    }

    button {
      min-height: 56px;
      padding: 11px 16px;
      font-size: 18px;
    }

    .control-label {
      font-size: 15px;
    }

    .transport-cell :global(.play-pause-btn.large) {
      font-size: 1.65rem;
    }

    .prop-grid {
      grid-template-columns: repeat(14, minmax(0, 1fr));
    }
  }

  @container (max-width: 1360px) {
    .deck-top {
      grid-template-columns: minmax(0, 1fr);
    }

    .playback-group {
      justify-self: stretch;
    }

    .transport-row {
      grid-template-columns: max-content minmax(0, 1fr) max-content;
    }
  }

  @container (max-width: 760px), (max-height: 620px) {
    .title-block {
      max-width: calc(100% - 36px);
    }

    .review-deck {
      gap: 12px;
      max-height: 58cqh;
      overflow-y: auto;
    }

    .prop-tile {
      padding: 6px 8px;
    }

    .deck-top {
      gap: 12px;
    }

    .family-picker,
    .build-controls.has-finish .family-picker,
    .solo-finish-picker {
      grid-column: 1 / -1;
    }

    .finish-picker {
      grid-column: 1 / span 6;
      grid-row: 2;
    }

    .transport-row {
      grid-template-areas:
        "transport next"
        "tempo tempo";
      grid-template-columns: auto minmax(0, 1fr);
    }

    .transport-cell {
      justify-self: start;
    }

    .tempo-cell :global(.tempo-control) {
      justify-content: center;
    }

    .new-loop-button {
      width: auto;
    }
  }

  @container (max-width: 900px) {
    .fan-build-primary,
    .fan-build-layout.has-customization .fan-build-primary,
    .fan-customization {
      grid-column: 1 / -1;
    }

    .fan-customization {
      grid-row: 2;
    }
  }

  @container (max-width: 520px) {
    .fan-modifier-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .fan-modifier-grid.has-frame-color .frame-color-modifier,
    .fan-modifier-grid.has-frame-color .cover-modifier {
      grid-column: 1;
    }
  }

  @container (max-height: 620px) {
    .review-deck {
      --studio-control-size: 44px;
      --studio-transport-size: 58px;
      padding: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
