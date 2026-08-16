<script lang="ts">
  import { onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
  import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import {
    getEffectsConfigContext,
    setEffectsConfigContext,
  } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import {
    getAnimationVisibilityContext,
    setAnimationVisibilityContext,
  } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
  import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
  import { createTempoGridTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
  import {
    DEFAULT_POST_LAYOUT,
    POST_STUDIO_ROLE,
  } from "$lib/shared/media-composition/domain/post-studio-presets";
  import {
    createMediaCompositionState,
    type CompositionSourceBinding,
  } from "$lib/shared/media-composition/state/media-composition-state.svelte";
  import { setMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import {
    exportPostStudioVideo,
    type PostStudioExportProgress,
  } from "$lib/shared/media-composition/services/post-studio-exporter";
  import { getVideoFileMetadata } from "$lib/shared/video-collaboration/helpers/create-video-from-upload";
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { hasDecodableAudioTrack } from "$lib/shared/media-composition/services/media-audio-inspector";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PostStudioTopBar from "./PostStudioTopBar.svelte";
  import PostStudioPreview from "./PostStudioPreview.svelte";
  import PostStudioInspector from "./PostStudioInspector.svelte";
  import PostStudioTimeline from "./PostStudioTimeline.svelte";
  import PostStudioDeliveryPanel from "./PostStudioDeliveryPanel.svelte";
  import PostStudioPerformancePicker from "./PostStudioPerformancePicker.svelte";
  import {
    createCatalogPerformanceSelection,
    createPostStudioSequenceRef,
    createUnmappedPerformanceSelection,
    type PostStudioPerformanceSelection,
  } from "./post-studio-performance-selection";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import { withPostStudioPropType } from "./post-studio-prop-render-options";
  import {
    PostStudioArtControllers,
    setPostStudioArtContext,
  } from "./post-studio-art-context.svelte";

  type FocusedPanel = "canvas" | "edit" | "timing";

  interface Props {
    sequence: SequenceData;
    cardPreviewUrl: string | null;
    animationPreviewUrl: string | null;
    animationPreviewType?: "video" | "image";
    cardRenderOptions?: Partial<SequenceExportOptions> | null;
    resolvedCardAutoLayout?: ResolvedAutoLayout | null;
    performanceDurationSeconds?: number;
    sequenceTimeMap?: SequenceTimeMap | null;
    isPreparingCard?: boolean;
    isPreparingAnimation?: boolean;
    onRequestAnimation: () => void;
    onBack?: () => void;
    onClose?: () => void;
    onExported?: (blob: Blob) => void;
  }

  let {
    sequence,
    cardPreviewUrl,
    animationPreviewUrl,
    animationPreviewType = "video",
    cardRenderOptions = null,
    resolvedCardAutoLayout = null,
    performanceDurationSeconds,
    sequenceTimeMap = null,
    isPreparingCard = false,
    isPreparingAnimation = false,
    onRequestAnimation,
    onBack,
    onClose,
    onExported,
  }: Props = $props();

  const exportOptions = getExportOptionsState();
  const effectsConfig =
    getEffectsConfigContext() ??
    createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effectsConfig);
  const animationVisibility =
    getAnimationVisibilityContext() ?? getAnimationVisibilityManager();
  setAnimationVisibilityContext(animationVisibility);

  let selectedPropType = $state<PropType>(
    settingsService.settings.bluePropType ?? PropType.STAFF
  );
  const synchronizedCardRenderOptions = $derived(
    withPostStudioPropType(cardRenderOptions, selectedPropType)
  );

  let chosenPerformance = $state<PostStudioPerformanceSelection | null>(null);
  let performanceSelectionTouched = false;
  let localPerformanceUrl: string | null = null;
  let performancePickerOpen = $state(false);
  let performanceLibraryError = $state("");
  let performanceLibraryRequest = 0;
  let focusedPanel = $state<FocusedPanel>("canvas");
  let timingAdvanced = $state(false);
  let performanceHasAudio = $state<boolean | null>(null);
  let audioInspectionVersion = 0;
  let workspaceWidth = $state(0);
  let workspaceHeight = $state(0);
  let workspaceWasAdjusted = $state(false);
  let workspaceSizes = $state([72, 44]);

  const compactWorkspace = $derived(
    workspaceWidth === 0 || workspaceWidth <= 1120 || workspaceHeight <= 640
  );

  const sequenceRef = $derived(createPostStudioSequenceRef(sequence));
  const performanceUrl = $derived(
    chosenPerformance?.url ?? sequence.performanceVideoUrl ?? null
  );
  const performanceDuration = $derived(
    chosenPerformance?.duration ?? performanceDurationSeconds
  );
  const resolvedSequenceTimeMap = $derived(
    chosenPerformance ? chosenPerformance.sequenceTimeMap : sequenceTimeMap
  );
  const performanceAlignmentDetail = $derived.by(() => {
    if (!performanceUrl) return null;
    if (chosenPerformance) return chosenPerformance.alignmentDetail;
    if (sequenceTimeMap?.source === "manual") return "Saved manual map";
    if (
      sequenceTimeMap?.source === "audio-detected" ||
      sequenceTimeMap?.source === "motion-detected" ||
      sequenceTimeMap?.source === "hybrid"
    ) {
      return "Assisted candidate";
    }
    return "Unmapped · even timing preview";
  });

  $effect(() => {
    const sequenceId = sequence.id;
    const linkedUrl = sequence.performanceVideoUrl;
    const ref = sequenceRef;
    const request = ++performanceLibraryRequest;
    performanceLibraryError = "";
    if (!sequenceId || !linkedUrl || performanceSelectionTouched) return;

    void getVideosForSequence(sequenceId)
      .then((videos) => {
        if (
          request !== performanceLibraryRequest ||
          performanceSelectionTouched
        )
          return;
        const linkedVideo = videos.find(
          (video) => video.videoUrl === linkedUrl
        );
        if (linkedVideo) {
          chosenPerformance = createCatalogPerformanceSelection(
            linkedVideo,
            ref
          );
        }
      })
      .catch(() => {
        if (request === performanceLibraryRequest) {
          performanceLibraryError =
            "Saved timing could not be checked. This preview is using even timing.";
        }
      });
  });

  $effect(() => {
    const width = workspaceWidth;
    const height = workspaceHeight;
    if (workspaceWasAdjusted || width <= 0) return;

    const available = Math.max(0, width - 8);

    // The 9:16 frame is height-bound, so the canvas column has an appetite, not
    // an appetite for everything: past `frame + matting` every further pixel is
    // black rail. Size it to what the frame can actually use at this height and
    // hand the surplus to the inspector, which does grow into it (more effect
    // columns rather than a wider gutter). The reverse split gave the canvas
    // 1123px to hold a 395px frame.
    const frame = height > 0 ? (height - 44) * 0.5625 : 480;
    const canvasFloor = width >= 1680 ? 640 : 480;
    const inspectorFloor = width >= 1680 ? 720 : 320;
    // Surplus past that appetite goes to the inspector, but only up to a share
    // of the workspace — handing it every spare pixel makes the panel the
    // dominant column in a studio whose product is the frame, and stretches a
    // grid of one-word tiles to fill it.
    const inspector = Math.min(
      Math.max(900, available * 0.32),
      Math.max(inspectorFloor, available - (frame + 240))
    );
    const canvas = Math.max(canvasFloor, available - inspector);
    workspaceSizes = [canvas, Math.max(inspectorFloor, available - canvas)];
  });

  const bindings = $derived.by((): CompositionSourceBinding[] => [
    {
      roleKey: POST_STUDIO_ROLE.performance,
      kind: "video",
      label: "Performance",
      previewUrl: performanceUrl,
      previewType: "video",
      renderMode: "external-media",
      durationSeconds: performanceDuration,
      hasAudio: performanceHasAudio === true,
      status: performanceUrl ? "ready" : "missing",
      missingMessage: "Choose a performance video",
    },
    {
      roleKey: POST_STUDIO_ROLE.animation,
      kind: "sequence-animation",
      label: "Animation",
      previewUrl: animationPreviewUrl,
      previewType: animationPreviewType,
      renderMode: "sequence-animation",
      status:
        sequence.steps.length > 0
          ? "ready"
          : animationPreviewUrl
            ? "ready"
            : isPreparingAnimation
              ? "preparing"
              : "missing",
      missingMessage: "No sequence motion",
    },
    {
      roleKey: POST_STUDIO_ROLE.card,
      kind: "choreo-card",
      label: "Choreo card",
      previewUrl: cardPreviewUrl,
      previewType: "image",
      renderMode: "choreo-card",
      status:
        sequence.steps.length > 0
          ? "ready"
          : cardPreviewUrl
            ? "ready"
            : isPreparingCard
              ? "preparing"
              : "missing",
      missingMessage: "Card preview unavailable",
    },
    // Sequence-derived sources need nothing chosen. The sequence is already
    // open — asking "click to choose a source" for a tunnel or a mandala is
    // asking for the thing the studio was handed on the way in.
    {
      roleKey: POST_STUDIO_ROLE.tunnel,
      kind: "tunnel",
      label: "Tunnel",
      previewUrl: null,
      renderMode: "tunnel",
      status: sequence.steps.length > 0 ? "ready" : "missing",
      missingMessage: "No sequence motion",
    },
    {
      roleKey: POST_STUDIO_ROLE.mandala,
      kind: "mandala",
      label: "Mandala",
      previewUrl: null,
      renderMode: "mandala",
      status: sequence.steps.length > 0 ? "ready" : "missing",
      missingMessage: "No sequence motion",
    },
    {
      roleKey: POST_STUDIO_ROLE.scene3d,
      kind: "scene-3d",
      label: "3D view",
      previewUrl: null,
      renderMode: "scene-3d",
      // The 3D scene needs a context installed before mount, a performer, and
      // an async feature gate — none of which the preview slot builds yet.
      // Say that, rather than implying a file is missing.
      status: "missing",
      missingMessage: "3D preview is not wired up yet",
    },
  ]);

  // One starting arrangement, not a menu of four. A post is a top slot and a
  // bottom slot, and both are picked in the preview — a template list is a
  // second way to say the same thing, and a worse one, since it can only offer
  // the pairings someone thought to enumerate.
  const composition = createMediaCompositionState({
    presets: [DEFAULT_POST_LAYOUT],
    initialPresetId: DEFAULT_POST_LAYOUT.id,
    getBindings: () => bindings,
    getSequenceSteps: () => sequence.steps,
    getSequenceTimeMap: (durationSeconds) =>
      resolvedSequenceTimeMap ??
      createTempoGridTimeMap({
        sequenceRef,
        mediaSourceId:
          chosenPerformance?.id ??
          (performanceUrl
            ? `performance:${sequence.id}`
            : `animation:${sequence.id}`),
        mediaDurationSeconds: durationSeconds,
        motionDurations: sequence.steps.map((step) => step.duration ?? 1),
      }),
    requestSource: (roleKey) => {
      if (roleKey === POST_STUDIO_ROLE.performance) {
        performancePickerOpen = true;
        return;
      }
      if (roleKey === POST_STUDIO_ROLE.animation) onRequestAnimation();
    },
  });
  setMediaCompositionContext(composition);

  // Tunnel and mandala controllers live here, above both the slot that draws
  // them and the inspector that steers them, so the Look / Spin / Colors
  // controls change the instance the canvas is reading. Same ownership as
  // ArtPane in the sequence viewer.
  const artControllers = new PostStudioArtControllers({
    getSequence: () => sequence,
    getBluePropType: () => synchronizedCardRenderOptions?.bluePropTypeOverride,
    getRedPropType: () => synchronizedCardRenderOptions?.redPropTypeOverride,
  });
  setPostStudioArtContext(artControllers);

  let previewRoot = $state<HTMLElement | null>(null);
  let audioMode = $state<"original" | "instagram">("original");
  let audioModeTouched = $state(false);
  let exportProgress = $state<PostStudioExportProgress | null>(null);
  let exportError = $state("");
  let exportedUrl = $state<string | null>(null);
  let exportCancelled = false;

  const performanceBinding = $derived(
    bindings.find(
      (binding) => binding.roleKey === POST_STUDIO_ROLE.performance
    ) ?? null
  );
  const usesPerformance = $derived(
    composition.activePreset.sourceRoles.some(
      (role) => role.key === POST_STUDIO_ROLE.performance
    )
  );
  const canKeepOriginalAudio = $derived(
    usesPerformance &&
      performanceBinding?.status === "ready" &&
      Boolean(performanceBinding.previewUrl) &&
      performanceBinding.hasAudio === true
  );
  const exporting = $derived(exportProgress !== null);
  const exportPercent = $derived(
    exportProgress
      ? Math.round(
          (exportProgress.completedFrames / exportProgress.totalFrames) * 100
        )
      : 0
  );
  const sequenceName = $derived(
    simplifyRepeatedWord(
      sequence.displayName || deriveWord(sequence) || "Vertical post"
    )
  );
  const exportFilename = $derived(
    `${simplifyRepeatedWord(sequenceName || "tka-post")}.mp4`
  );
  const firstMissingSource = $derived(
    composition.missingRequiredRoles[0] ?? null
  );
  const canRender = $derived(
    composition.isReady && previewRoot !== null && !exporting
  );

  $effect(() => {
    if (audioModeTouched) return;
    audioMode = canKeepOriginalAudio ? "original" : "instagram";
  });

  $effect(() => {
    const url = performanceUrl;
    const version = ++audioInspectionVersion;
    performanceHasAudio = null;
    if (!url) return;
    void hasDecodableAudioTrack(url).then((hasAudio) => {
      if (version === audioInspectionVersion) performanceHasAudio = hasAudio;
    });
  });

  onDestroy(() => {
    exportCancelled = true;
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    if (localPerformanceUrl) URL.revokeObjectURL(localPerformanceUrl);
  });

  function setPreviewRoot(root: HTMLElement | null): void {
    previewRoot = root;
  }

  function setAudioMode(mode: "original" | "instagram"): void {
    audioMode = mode;
    audioModeTouched = true;
  }

  function setPropType(propType: PropType): void {
    selectedPropType = propType;
  }

  function fixFirstMissingSource(): void {
    if (!firstMissingSource) return;
    composition.requestSource(firstMissingSource.roleKey);
  }

  function choosePerformance(selection: PostStudioPerformanceSelection): void {
    if (localPerformanceUrl) {
      URL.revokeObjectURL(localPerformanceUrl);
      localPerformanceUrl = null;
    }
    performanceSelectionTouched = true;
    chosenPerformance = selection;
    performanceLibraryError = "";
    performancePickerOpen = false;
    composition.selectRole(POST_STUDIO_ROLE.performance);
    focusedPanel = "edit";
  }

  async function choosePerformanceFile(file: File): Promise<void> {
    if (!file.type.startsWith("video/")) {
      throw new Error("Choose a video file.");
    }
    if (file.size > 500 * 1024 * 1024) {
      throw new Error("Choose a video under 500 MB.");
    }
    const metadata = await getVideoFileMetadata(file);
    if (localPerformanceUrl) URL.revokeObjectURL(localPerformanceUrl);
    localPerformanceUrl = URL.createObjectURL(file);
    performanceSelectionTouched = true;
    chosenPerformance = createUnmappedPerformanceSelection({
      id: `local-performance:${file.name}:${file.size}:${file.lastModified}`,
      url: localPerformanceUrl,
      duration: metadata.duration,
      label: file.name,
    });
    performanceLibraryError = "";
    performancePickerOpen = false;
    composition.selectRole(POST_STUDIO_ROLE.performance);
    focusedPanel = "edit";
  }

  async function renderPost(): Promise<void> {
    if (!previewRoot || !composition.isReady || exporting) return;
    const previousTime = composition.previewSeconds;
    const wasPlaying = composition.isPlaying;
    composition.pause();
    exportCancelled = false;
    exportError = "";
    exportProgress = {
      completedFrames: 0,
      totalFrames: Math.ceil(
        composition.durationSeconds * composition.activePreset.output.frameRate
      ),
      phase: "rendering",
    };

    try {
      const blob = await exportPostStudioVideo({
        root: previewRoot,
        preset: composition.activePreset,
        durationSeconds: composition.durationSeconds,
        getLayers: () => composition.frameLayers,
        seek: composition.seek,
        originalAudioUrl:
          audioMode === "original" && canKeepOriginalAudio
            ? performanceBinding?.previewUrl
            : null,
        onProgress: (progress) => (exportProgress = progress),
        shouldCancel: () => exportCancelled,
      });
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
      exportedUrl = URL.createObjectURL(blob);
      onExported?.(blob);
    } catch (error) {
      if (!exportCancelled) {
        console.error("[PostStudio] Export failed:", error);
        exportError =
          error instanceof Error
            ? error.message
            : "The post could not be rendered.";
      }
    } finally {
      exportProgress = null;
      composition.seek(previousTime);
      if (wasPlaying) composition.togglePlayback();
    }
  }

  function cancelExport(): void {
    exportCancelled = true;
  }

  function toggleTimingAdvanced(): void {
    timingAdvanced = !timingAdvanced;
  }

</script>

<section
  class="post-studio"
  data-mobile-panel={focusedPanel}
  aria-labelledby="post-studio-title"
>
  <PostStudioTopBar
    {sequenceName}
    missingCount={composition.missingRequiredRoles.length}
    missingLabel={firstMissingSource?.label}
    {canRender}
    {exporting}
    {exportProgress}
    {exportPercent}
    {exportedUrl}
    {exportFilename}
    {onBack}
    {onClose}
    onFixMissing={fixFirstMissingSource}
    onRender={renderPost}
    onCancelExport={cancelExport}
  />

  {#snippet canvasPanel()}
    <main class="canvas-panel" aria-label="Post canvas">
      <div class="canvas-stage">
        <PostStudioPreview
          {sequence}
          cardRenderOptions={synchronizedCardRenderOptions}
          durationLabel={`${composition.durationSeconds.toFixed(1)}s`}
          onRootReady={setPreviewRoot}
          onEditRegion={() => (focusedPanel = "edit")}
        />
      </div>
    </main>
  {/snippet}

  {#snippet inspectorPanel()}
    <aside class="inspector-rail" aria-label="Inspector and export settings">
      <PostStudioInspector
        {sequence}
        {exportOptions}
        {selectedPropType}
        onPropChange={setPropType}
        resolvedAutoLayout={resolvedCardAutoLayout}
      />
      {#if canKeepOriginalAudio}
        <PostStudioDeliveryPanel
          {audioMode}
          {canKeepOriginalAudio}
          {exporting}
          {exportError}
          onAudioModeChange={setAudioMode}
        />
      {/if}
    </aside>
  {/snippet}

  {#snippet timelinePanel()}
    <div class="timeline-dock">
      <PostStudioTimeline
        advanced={timingAdvanced}
        {performanceAlignmentDetail}
        onMapPerformance={() => (performancePickerOpen = true)}
        onToggleAdvanced={toggleTimingAdvanced}
      />
    </div>
  {/snippet}

  {#if performanceLibraryError}
    <div class="studio-notice">
      <p role="alert">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        {performanceLibraryError}
      </p>
    </div>
  {/if}

  <div class="studio-body">
    <div
      class="workspace"
      bind:clientWidth={workspaceWidth}
      bind:clientHeight={workspaceHeight}
    >
      <PanelGroup
        direction="horizontal"
        panels={[
          {
            id: "canvas",
            content: canvasPanel,
            defaultSize: workspaceSizes[0],
            minSize: workspaceWidth >= 1680 ? 640 : 480,
          },
          {
            id: "inspector",
            content: inspectorPanel,
            defaultSize: workspaceSizes[1],
            minSize: workspaceWidth >= 1680 ? 720 : 320,
            maxSize: 1280,
          },
        ]}
        bind:sizes={workspaceSizes}
        onSizesChange={() => (workspaceWasAdjusted = true)}
        gap={8}
        flattened={compactWorkspace}
      />
    </div>

    <!-- Timing spans the workspace rather than riding inside the canvas column.
         It is a composition-wide control — one playhead, one tempo, every
         region's clips — so scoping it to the canvas was backwards twice over:
         the transport row's intrinsic width (~1000px) exceeded the narrowest
         column and got clipped, and the height it claimed came straight out of
         the 9:16 frame, which is the one thing on this page that is the
         product. Full width also gives clip trimming a track worth dragging. -->
    {@render timelinePanel()}
  </div>

  <nav class="focused-nav" aria-label="Post Studio tools">
    <button
      type="button"
      class:active={focusedPanel === "canvas"}
      aria-pressed={focusedPanel === "canvas"}
      onclick={() => (focusedPanel = "canvas")}
    >
      <i class="fa-solid fa-mobile-screen" aria-hidden="true"></i>
      Canvas
    </button>
    <button
      type="button"
      class:active={focusedPanel === "edit"}
      aria-pressed={focusedPanel === "edit"}
      onclick={() => (focusedPanel = "edit")}
    >
      <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      Edit
    </button>
    <button
      type="button"
      class:active={focusedPanel === "timing"}
      aria-pressed={focusedPanel === "timing"}
      onclick={() => {
        timingAdvanced = true;
        focusedPanel = "timing";
      }}
    >
      <i class="fa-solid fa-scissors" aria-hidden="true"></i>
      Timing
    </button>
  </nav>

  <PostStudioPerformancePicker
    open={performancePickerOpen}
    {sequence}
    {sequenceRef}
    bpm={composition.tempoBpm ?? 60}
    currentUrl={performanceUrl}
    onClose={() => (performancePickerOpen = false)}
    onSelect={choosePerformance}
    onChooseFile={choosePerformanceFile}
  />
</section>

<style>
  .post-studio {
    --studio-control-height: 2.75rem;
    --studio-body-size: var(--font-size-min);
    --studio-meta-size: var(--font-size-compact);
    --studio-section-title-size: 1.15rem;
    --studio-panel-gap: var(--spacing-lg);
    --studio-panel-padding: var(--spacing-lg);
    --studio-canvas-padding: var(--spacing-md);
    position: relative;
    container-name: post-studio;
    container-type: inline-size;
    /* Flex, not grid rows: the notice strip is conditional, and a fixed
       `auto minmax(0,1fr)` template hands the 1fr to whichever child lands in
       row two, which flips between the body and the notice as errors come and
       go. Flex lets the body claim the remainder regardless of siblings. */
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  /* Columns above, timing across the full width below. The scale tokens live
     here rather than on .workspace so the timing bar steps with the columns
     at the 105rem / 180rem tiers instead of staying frozen at base size. */
  .studio-body {
    display: grid;
    flex: 1;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .studio-notice {
    display: grid;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .studio-notice p {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0;
    color: var(--semantic-warning);
    font-size: var(--studio-meta-size);
  }

  .workspace {
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg);
  }

  .inspector-rail {
    display: grid;
    grid-area: inspector;
    grid-template-rows: minmax(0, 1fr);
    align-content: stretch;
    gap: var(--studio-panel-gap);
    min-width: 0;
    min-height: 0;
    padding: var(--studio-panel-padding);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-left: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    scrollbar-width: none;
  }

  .inspector-rail::-webkit-scrollbar,
  .timeline-dock::-webkit-scrollbar {
    display: none;
  }

  /* No header row: it repeated the 9:16 the preview already states, and its
     reserved control-height band cost the vertical space the 9:16 frame is
     sized from. Format and length now ride the preview's own meta line. */
  .canvas-panel {
    grid-area: canvas;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    padding: var(--studio-canvas-padding);
    background: color-mix(
      in srgb,
      var(--theme-card-bg) 48%,
      var(--theme-panel-bg)
    );
  }

  .canvas-stage {
    container-name: post-studio-stage;
    container-type: size;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .timeline-dock {
    min-width: 0;
    min-height: 0;
    padding: var(--studio-canvas-padding) var(--studio-panel-padding);
    overflow-x: auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    border-top: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .focused-nav {
    display: none;
  }

  /* A container query cannot style its own container, so the scale steps land
     on every direct child instead of on `.post-studio`. All of them, not just
     the body: the top bar carries the layouts menu and the render button, and
     leaving it out froze those at 12px on a 3840 screen while the columns
     underneath stepped to 20px. */
  @container post-studio (min-width: 105rem) {
    .studio-body,
    .studio-notice,
    .post-studio > :global(.topbar) {
      --studio-control-height: 3.25rem;
      --studio-body-size: 0.9375rem;
      --studio-meta-size: 0.8125rem;
      --studio-section-title-size: 1.25rem;
      --studio-panel-gap: var(--spacing-xl);
      --studio-panel-padding: var(--spacing-xl);
      --studio-canvas-padding: var(--spacing-lg);
    }
  }

  @container post-studio (min-width: 180rem) {
    .studio-body,
    .studio-notice,
    .post-studio > :global(.topbar) {
      --studio-control-height: 4.25rem;
      --studio-body-size: 1.25rem;
      --studio-meta-size: 1.0625rem;
      --studio-section-title-size: 1.75rem;
      --studio-panel-gap: 2.75rem;
      --studio-panel-padding: 3rem;
      --studio-canvas-padding: 2.5rem;
    }
  }

  @media (min-width: 70.0625rem) and (max-height: 70rem) {
    .studio-body {
      --studio-panel-gap: 0.75rem;
      --studio-panel-padding: 1rem;
      --studio-canvas-padding: 0.75rem;
    }
  }

  @container post-studio (max-width: 70rem) {
    /* One panel at a time, each filling the body. The timing bar is a sibling
       of the columns now, so the columns step aside when timing is showing
       rather than collapsing to an empty row above it. */
    .studio-body,
    .workspace {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
    }

    .workspace {
      height: 100%;
    }

    .post-studio[data-mobile-panel="timing"] .workspace {
      display: none;
    }

    .canvas-panel,
    .inspector-rail,
    .timeline-dock {
      display: none;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .post-studio[data-mobile-panel="canvas"] .canvas-panel {
      display: grid;
    }

    .post-studio[data-mobile-panel="edit"] .inspector-rail,
    .post-studio[data-mobile-panel="timing"] .timeline-dock {
      display: grid;
    }

    .inspector-rail,
    .timeline-dock {
      padding: var(--spacing-md);
    }

    .focused-nav {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-top: 1px solid var(--theme-stroke);
      background: var(--theme-panel-bg);
    }

    .focused-nav button {
      display: grid;
      place-items: center;
      gap: var(--spacing-xs);
      min-height: 3.75rem;
      padding: var(--spacing-xs);
      border: 0;
      border-top: 2px solid transparent;
      background: transparent;
      color: var(--theme-text-dim);
      font: inherit;
      font-size: var(--font-size-compact);
      cursor: pointer;
    }

    .focused-nav button.active {
      border-top-color: var(--theme-accent);
      color: var(--theme-text);
    }

    .focused-nav button:focus-visible {
      outline: 3px solid var(--theme-accent);
      outline-offset: -4px;
    }
  }

  @media (max-height: 40rem) {
    .post-studio {
      grid-template-rows: auto minmax(0, 1fr) auto;
    }

    .studio-body,
    .workspace {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
    }

    .workspace {
      height: 100%;
    }

    .post-studio[data-mobile-panel="timing"] .workspace {
      display: none;
    }

    .canvas-panel,
    .inspector-rail,
    .timeline-dock {
      display: none;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .post-studio[data-mobile-panel="canvas"] .canvas-panel {
      display: grid;
    }

    .post-studio[data-mobile-panel="edit"] .inspector-rail,
    .post-studio[data-mobile-panel="timing"] .timeline-dock {
      display: grid;
    }

    .inspector-rail,
    .timeline-dock {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .focused-nav {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-top: 1px solid var(--theme-stroke);
      background: var(--theme-panel-bg);
    }

    .focused-nav button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      min-height: 3rem;
      padding: var(--spacing-xs);
      border: 0;
      border-top: 2px solid transparent;
      background: transparent;
      color: var(--theme-text-dim);
      font: inherit;
      font-size: var(--font-size-compact);
      cursor: pointer;
    }

    .focused-nav button.active {
      border-top-color: var(--theme-accent);
      color: var(--theme-text);
    }

    .focused-nav button:focus-visible {
      outline: 3px solid var(--theme-accent);
      outline-offset: -4px;
    }
  }
</style>
