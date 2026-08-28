<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";

  import EditHistoryShortcutBridge from "$lib/shared/keyboard/components/EditHistoryShortcutBridge.svelte";
  import { getKeyboardShortcutManager } from "$lib/shared/keyboard/get-keyboard-shortcut-manager";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";
  import {
    createInertStageHandlers,
    createStageShortcuts,
  } from "$lib/shared/keyboard/registration/register-stage-shortcuts";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import type { PanelDefinition } from "$lib/shared/panels/PanelGroup.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import SceneChromeButton from "$lib/shared/3d/components/controls/SceneChromeButton.svelte";
  import Viewer3DFullscreen from "$lib/shared/3d/components/Viewer3DFullscreen.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { createFullscreenController } from "$lib/shared/fullscreen/state/fullscreen-controller.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { sceneEnvironmentIdForBackground } from "$lib/shared/3d/environments/domain/scene-environment";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { FILM_DIRECTOR_ROUTE } from "$lib/features/film-director/domain/film-director-link";
  import { consumeSceneStudioHandoff } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { FormationPresetId } from "./domain/stage-types";

  import FormationOverlay from "./components/FormationOverlay.svelte";
  import SetProperties from "./components/SetProperties.svelte";
  import StageFloorPaths from "./components/StageFloorPaths.svelte";
  import StageTimeline from "./components/StageTimeline.svelte";
  import StageStarter from "./components/StageStarter.svelte";
  import SceneExportModal from "./scene/components/SceneExportModal.svelte";
  import { createSceneVideoExport } from "./scene/services/create-scene-video-export.svelte";
  import { setStageChoreographyContext } from "./context/stage-choreography-context";
  import { resolveActiveFormationIndex } from "./domain/active-formation";
  import { samplePerformerSequenceAtBeat } from "./domain/stage-sequence-timeline";
  import { createStageChoreographyState } from "./state/stage-choreography-state.svelte";
  import type { StudioStarter } from "./domain/studio-project";
  import { createStageEditMode } from "./state/stage-edit-mode.svelte";
  import {
    DEFAULT_STAGE_SEQUENCE_ID,
    loadStageSequence,
  } from "./services/stage-sequence-loader";
  import {
    applyStageCastToViewer,
    applyStagePerformerMotion,
  } from "./services/stage-viewer-adapter";

  type SequenceLoadState = "loading" | "ready" | "error";
  type TimelineDisclosure = "hidden" | "dock" | "editor";

  // Opening a saved 3D scene from the collection hands over a whole resolved
  // sequence rather than an id, so it seeds the resolver instead of going
  // through the catalog — a collection id has no catalog entry to fetch.
  const handoff = consumeSceneStudioHandoff();

  const settings = getSettings();
  const stageState = createStageChoreographyState({
    initialEnvironmentId: sceneEnvironmentIdForBackground(
      settings.backgroundType
    ),
  });
  setStageChoreographyContext(stageState);
  const editMode = createStageEditMode();

  // The Stage is the same 3D surface as every other one in the app: the shared
  // viewer state is what makes the control rail's tools — performers, formation,
  // camera, scene, presets — reach real rigs instead of doing nothing.
  const viewer = createViewer3DState(undefined, {
    firstUseEnvironment: stageState.choreography.environmentId,
    appDefaultProp: settings.bluePropType ?? null,
  });
  setViewer3DContext(viewer);
  viewer.setEnvironmentId(stageState.choreography.environmentId);
  viewer.enter3D();

  if (handoff) {
    stageState.setSharedSequence(handoff.sequence);
    if (handoff.bpm != null) stageState.setBpm(handoff.bpm);
  }

  const fullscreen = createFullscreenController({
    getHapticService: () => null,
    announce: (message) => console.debug("[Stage]", message),
  });

  const exporter = createSceneVideoExport(viewer);

  const compactTimelineWorkspace = new MediaQuery(
    "(max-width: 900px), (max-height: 560px)"
  );

  const choreography = $derived(stageState.choreography);
  const performanceFrames = $derived(stageState.performanceFrames);

  let chartRaised = $state(false);
  let starterVisible = $state(!handoff);
  let timelineExpanded = $state(false);
  let workspaceSizes = $state<number[]>([]);
  let pickerOpen = $state(false);
  const preloadedSequences = new Map<string, SequenceData>(
    handoff ? [[handoff.sequence.id, handoff.sequence]] : []
  );
  let resolvedSequences = $state<ReadonlyMap<string, SequenceData>>(
    new Map(preloadedSequences)
  );
  let sequenceLoadState = $state<SequenceLoadState>("loading");
  let sequenceLoadError = $state<string | null>(null);
  let retryRequest = $state(0);

  const sharedSequenceId = $derived(
    choreography.sharedSequenceId ?? DEFAULT_STAGE_SEQUENCE_ID
  );
  const sharedSequence = $derived(
    resolvedSequences.get(sharedSequenceId) ?? null
  );

  const timelineDisclosure = $derived<TimelineDisclosure>(
    starterVisible ? "hidden" : timelineExpanded ? "editor" : "dock"
  );

  const sequenceIds = $derived.by(() => {
    const ids = new Set<string>([sharedSequenceId]);
    for (const performer of choreography.performers) {
      for (const clip of performer.sequenceClips) ids.add(clip.sequenceId);
    }
    return [...ids].sort();
  });

  const sequenceIdKey = $derived(sequenceIds.join("|"));

  const sequenceByPerformerId = $derived.by(() => {
    const active = new Map<string, SequenceData>();
    for (const performer of choreography.performers) {
      const sample = samplePerformerSequenceAtBeat(
        performer,
        stageState.currentBeat
      );
      const sequenceId = sample?.clip.sequenceId ?? sharedSequenceId;
      const sequence = resolvedSequences.get(sequenceId);
      if (sequence) active.set(performer.id, sequence);
    }
    return active;
  });

  /**
   * Each performer's own playhead. Stage lanes hold independent choreography,
   * so the shared clock cannot express them — this is what the viewer's
   * `performerSteps` seam exists for.
   */
  const performerSteps = $derived(
    choreography.performers.map((performer) => {
      const sample = samplePerformerSequenceAtBeat(
        performer,
        stageState.currentBeat
      );
      return sample ? sample.stepIndex + sample.progress : 0;
    })
  );

  const activeSetIndex = $derived(
    resolveActiveFormationIndex(
      choreography.formations,
      editMode.selectedFormationId,
      stageState.currentBeat
    )
  );
  const activeSet = $derived(
    activeSetIndex >= 0 ? choreography.formations[activeSetIndex] : undefined
  );

  const stageWord = $derived(
    sharedSequence
      ? simplifyRepeatedWord(
          sharedSequence.word ??
            sharedSequence.intendedWord ??
            sharedSequence.displayName ??
            ""
        ) || null
      : null
  );

  // Resolve every sequence the document references. One request per id, redone
  // whenever the set of ids changes or the user retries a failure.
  //
  // Keyed on the joined ids rather than the array: `sequenceIds` rebuilds its
  // array whenever anything in the clip list is touched, and this effect writes
  // back into that list, so depending on the array itself makes the fetch
  // re-run forever.
  $effect(() => {
    sequenceIdKey;
    retryRequest;
    const requestedIds = untrack(() => sequenceIds);
    let cancelled = false;

    sequenceLoadState = "loading";
    sequenceLoadError = null;

    void Promise.all(
      requestedIds.map(async (sequenceId) => {
        const preloaded = preloadedSequences.get(sequenceId);
        return [
          sequenceId,
          preloaded ?? (await loadStageSequence(sequenceId)),
        ] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        resolvedSequences = new Map(entries);
        stageState.registerSequenceLabels(
          new Map(
            entries.map(([sequenceId, sequence]) => [
              sequenceId,
              simplifyRepeatedWord(
                sequence.word ??
                  sequence.intendedWord ??
                  sequence.displayName ??
                  sequenceId
              ),
            ])
          )
        );
        stageState.syncClipSourceLengths(
          new Map(
            entries.map(([sequenceId, sequence]) => [
              sequenceId,
              sequence.steps.length,
            ])
          )
        );
        sequenceLoadState = "ready";
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const failure =
          error instanceof Error ? error : new Error(String(error));
        sequenceLoadState = "error";
        sequenceLoadError = failure.message;
        getErrorHandler().showUserError({
          message: "The Stage sequence could not be loaded.",
          technicalDetails: failure.message,
          error: failure,
          context: {
            module: "stage",
            action: "load-stage-performance-sequence",
            additionalData: { sequenceIds: requestedIds },
          },
        });
      });

    return () => {
      cancelled = true;
    };
  });

  // Cast size and per-lane sequences are document facts; look edits — avatar,
  // prop, effort, effects, planes — stay with the performer manager and are
  // never rewritten from here, so the rail's Performer tool keeps working.
  //
  // The tracked reads are explicit because `choreography` is a mutated $state
  // object whose identity never changes: reading the object alone would make
  // this run once and never again.
  let castSizeFromDocument = choreography.performers.length;
  $effect(() => {
    const castSize = choreography.performers.length;
    const castLabels = choreography.performers.map((p) => p.label).join("|");
    const sequences = sequenceByPerformerId;
    void castSize;
    void castLabels;
    untrack(() => {
      castSizeFromDocument = choreography.performers.length;
      applyStageCastToViewer(viewer, choreography, sequences);
    });
  });

  // The other direction: adding or removing a performer from the rail is a
  // document edit. Without this the effect above would put the cast straight
  // back, and the rail's Performers tool would look broken.
  $effect(() => {
    const railCastSize = viewer.performerManager.performers.length;
    if (railCastSize === castSizeFromDocument) return;
    untrack(() => stageState.setPerformerCount(railCastSize));
  });

  $effect(() => {
    const frames = performanceFrames;
    const playing = stageState.isPlaying;
    untrack(() =>
      applyStagePerformerMotion(viewer, choreography, frames, playing)
    );
  });

  // The rail's Scene tool writes the viewer's environment; the document keeps
  // it so the choreography carries its own world. One direction only — the
  // document was seeded from the viewer at mount.
  let syncedEnvironmentId = stageState.choreography.environmentId;
  $effect(() => {
    const next = viewer.environmentId;
    if (next === syncedEnvironmentId) return;
    syncedEnvironmentId = next;
    stageState.setEnvironmentId(next);
  });

  /**
   * The rail's Formation tool arranges the cast now. On the Stage, "now" is a
   * count in a document, so a shape chosen there reseeds the set the playhead
   * is sitting on rather than starting a transition the Stage would overwrite
   * on its next frame.
   */
  let syncedFormation = viewer.activeFormation;
  $effect(() => {
    const preset = viewer.activeFormation;
    if (preset === syncedFormation) return;
    syncedFormation = preset;
    const set = untrack(() => activeSet);
    if (!preset || !set) return;
    untrack(() => {
      stageState.applyPresetToFormation(set.id, preset as FormationPresetId);
      viewer.performerManager.cancelFormationTransition();
    });
  });

  onDestroy(() => {
    stageState.destroy();
    exporter.cancel();
    viewer.dispose();
  });

  let exportOpen = $state(false);

  const workspacePanels = $derived.by<PanelDefinition[]>(() => {
    const stage: PanelDefinition = {
      content: stagePanel,
      defaultSize: 2.8,
      minSize: 240,
      id: "stage",
      resizable:
        timelineDisclosure === "editor" && !compactTimelineWorkspace.current,
    };
    if (timelineDisclosure === "hidden") return [stage];

    return [
      stage,
      {
        content:
          timelineDisclosure === "editor"
            ? timelineEditorPanel
            : timelineDockPanel,
        defaultSize: 1.2,
        minSize: 200,
        maxSize: 360,
        fixedSize:
          timelineDisclosure === "dock"
            ? "var(--stage-timeline-dock-size)"
            : compactTimelineWorkspace.current
              ? "var(--stage-timeline-sheet-size)"
              : undefined,
        id: "timeline",
      },
    ];
  });

  function openChoreography(openChart = false): void {
    starterVisible = false;
    timelineExpanded = true;
    if (openChart) chartRaised = true;
  }

  function collapseChoreography(): void {
    timelineExpanded = false;
  }

  function chooseSequence(next: SequenceData): void {
    stageState.setSharedSequence(next);
  }

  async function applyStudioStarter(starter: StudioStarter): Promise<void> {
    stageState.applyStudioStarter(starter);
    // Stage owns cast, formation and world; the shared performer manager owns
    // the prop look. Waiting one render lets the canonical cast adapter create
    // exactly the rigs the fresh Stage document called for.
    viewer.setEnvironmentId(starter.environmentId);
    await tick();
    for (const performer of viewer.performerManager.performers) {
      performer.setProp(starter.prop, { equipBuild: false });
    }
  }

  /** One count, and the eight counts a drill is written in. */
  const COUNT = 1;
  const EIGHT = 8;

  function seekToCount(count: number): void {
    const total = Math.max(1, stageState.maxTotalBeats);
    stageState.seek(Math.min(Math.max(count, 0), total) / total);
  }

  function nudgeCount(delta: number): void {
    seekToCount(Math.round(stageState.currentBeat) + delta);
  }

  /**
   * Sets carry the show, so the brackets jump between the counts they arrive
   * on rather than scrubbing. A tolerance keeps a float playhead sitting on a
   * set from counting as "before" it and going nowhere.
   */
  function jumpToNeighbouringSet(direction: -1 | 1): void {
    const beats = choreography.formations.map((formation) => formation.atBeat);
    const here = stageState.currentBeat;
    const next =
      direction === 1
        ? beats.find((beat) => beat > here + 0.001)
        : [...beats].reverse().find((beat) => beat < here - 0.001);
    if (next !== undefined) seekToCount(next);
  }

  function addSetAtPlayhead(): void {
    const added = stageState.addFormation(Math.round(stageState.currentBeat));
    if (added) editMode.selectFormation(added.id);
  }

  function removeSelectedSet(): void {
    const id = editMode.selectedFormationId ?? activeSet?.id;
    if (!id) return;
    stageState.removeFormation(id);
    editMode.clearSelection();
  }

  /**
   * The Stage's keys go through the app's shortcut manager rather than a local
   * window listener, so they appear in `?` and Settings → Keyboard Shortcuts,
   * can be rebound, and are conflict-checked against every other binding. The
   * ids are registered inert at boot; this re-registration supplies the real
   * actions. Undo and redo are not here — Ctrl+Z is owned globally and reaches
   * this document through EditHistoryShortcutBridge below.
   */
  $effect(() => {
    const manager = getKeyboardShortcutManager();
    const previousContext = manager.getContext();
    manager.setContext("stage");

    for (const shortcut of createStageShortcuts({
      togglePlay: () => stageState.togglePlay(),
      stepBack: () => nudgeCount(-COUNT),
      stepForward: () => nudgeCount(COUNT),
      jumpBack: () => nudgeCount(-EIGHT),
      jumpForward: () => nudgeCount(EIGHT),
      firstCount: () => seekToCount(0),
      lastCount: () => seekToCount(stageState.maxTotalBeats),
      previousSet: () => jumpToNeighbouringSet(-1),
      nextSet: () => jumpToNeighbouringSet(1),
      toggleChart: () => (chartRaised = !chartRaised),
      addSet: addSetAtPlayhead,
      removeSelectedSet,
    })) {
      manager.register(shortcut);
    }

    return () => {
      // Leave the definitions registered so Settings keeps listing them, but
      // hand back the context and let the inert actions stand again.
      manager.setContext(previousContext);
      for (const shortcut of createStageShortcuts(createInertStageHandlers())) {
        manager.register(shortcut);
      }
    };
  });

  /**
   * The raised chart is a layer, so Escape closes it through the same manager
   * that closes drawers and modals — a competing Escape shortcut would have to
   * guess which of them the user meant.
   */
  $effect(() => {
    if (!chartRaised) return;
    return getEscapeLayerManager().register({
      id: "stage:drill-chart",
      canDismiss: () => true,
      dismiss: () => {
        chartRaised = false;
      },
    });
  });
</script>

{#snippet stageHudActions()}
  <SceneChromeButton
    icon="fa-border-all"
    label={chartRaised ? "Hide drill chart" : "Drill chart"}
    tooltipSide="bottom"
    active={chartRaised}
    onclick={(event: MouseEvent) => {
      event.stopPropagation();
      chartRaised = !chartRaised;
    }}
  />
{/snippet}

{#snippet floorPaths()}
  <StageFloorPaths />
{/snippet}

{#snippet stageOverlay()}
  {#if chartRaised}
    <div class="drill-layer" aria-label="Drill chart">
      <div class="drill-chart">
        <FormationOverlay {editMode} />
      </div>
      {#if activeSet}
        <div class="drill-inspector">
          <SetProperties {editMode} />
        </div>
      {/if}
    </div>
  {/if}

  {#if sequenceLoadState === "loading"}
    <div class="load-notice" role="status" aria-live="polite">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <strong>Preparing the performance</strong>
      <span>Loading the sequence and performer rigs</span>
    </div>
  {:else if sequenceLoadState === "error"}
    <div class="load-notice error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <strong>Sequence failed to load</strong>
      <span>{sequenceLoadError ?? "The catalog entry is unavailable."}</span>
      <PanelButton variant="primary" onclick={() => (retryRequest += 1)}>
        Try again
      </PanelButton>
    </div>
  {:else if !handoff}
    <StageStarter
      word={stageWord}
      showDirector={authState.isAdmin && import.meta.env.DEV}
      directorHref={FILM_DIRECTOR_ROUTE}
      onApply={applyStudioStarter}
      onChooseSequence={() => (pickerOpen = true)}
      onOpenChoreography={() => openChoreography(true)}
      onVisibilityChange={(visible) => (starterVisible = visible)}
    />
  {/if}
{/snippet}

{#snippet stagePanel()}
  <div class="stage-canvas">
    {#if viewer.webgl2Available}
      <!-- word={null}: a Stage is a cast of lanes that each hold their own
           sequence, so one title over the frame is a claim the document cannot
           make. The timeline names each lane's clip, where it is true. Dropping
           it also hands the top-left corner to the performer bar, which is what
           a viewer of a multi-performer show reaches for first. -->
      <Viewer3DFullscreen
        sequenceData={sharedSequence}
        currentStep={stageState.currentBeat}
        isPlaying={stageState.isPlaying}
        bpm={choreography.bpm}
        word={null}
        stageExtent={{
          width: choreography.stageWidth,
          depth: choreography.stageDepth,
        }}
        bluePropType={settings.bluePropType ?? settings.propType ?? "staff"}
        redPropType={settings.redPropType ?? settings.propType ?? "staff"}
        onChangeSequence={() => (pickerOpen = true)}
        onExport={sharedSequence ? () => (exportOpen = true) : undefined}
        exportBusy={exporter.state.isExporting}
        onPlaybackToggle={() => stageState.togglePlay()}
        onBpmChange={(nextBpm) => stageState.setBpm(nextBpm)}
        onProgressBarSeek={seekToCount}
        immersive={fullscreen.immersive}
        onToggleImmersive={(host) => fullscreen.toggleImmersive(host)}
        {performerSteps}
        worldChildren={floorPaths}
        hudActions={stageHudActions}
        overlayChildren={stageOverlay}
        hideCanvasOverlays
        sceneControlsBottomOffset="0.75rem"
        allowSaveScene={false}
        renderEmptyScene
        contained
      />
    {:else}
      <div class="unsupported-state" role="alert">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <h1>3D isn’t available in this browser</h1>
        <p>WebGL 2 is required to stage a performance.</p>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet timelineDockPanel()}
  <StageTimeline {editMode} mode="dock" onExpand={() => openChoreography()} />
{/snippet}

{#snippet timelineEditorPanel()}
  <StageTimeline {editMode} mode="editor" onCollapse={collapseChoreography} />
{/snippet}

<div
  class="stage-module"
  role="main"
  aria-label="Stage"
  data-edit-history-shortcut-scope
>
  <EditHistoryShortcutBridge
    onUndo={stageState.undo}
    onRedo={stageState.redo}
    canUndo={stageState.canUndo}
    canRedo={stageState.canRedo}
  />
  <PanelGroup
    direction="vertical"
    panels={workspacePanels}
    bind:sizes={workspaceSizes}
  />
</div>

<SequencePickerModal
  bind:open={pickerOpen}
  onClose={() => (pickerOpen = false)}
  onSelect={chooseSequence}
  title="Choose the sequence your cast performs"
/>

{#if sharedSequence}
  <SceneExportModal
    bind:open={exportOpen}
    sequence={sharedSequence}
    bpm={choreography.bpm}
    {exporter}
    onClose={() => (exportOpen = false)}
  />
{/if}

<style>
  .stage-module {
    --stage-timeline-dock-size: 4.25rem;
    --stage-timeline-sheet-size: min(66cqh, 26rem);
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--color-bg-primary, #080910);
    container-type: size;
  }

  @media (max-width: 35rem) {
    .stage-module {
      --stage-timeline-dock-size: 6.75rem;
    }
  }

  .stage-canvas {
    position: relative;
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    container-type: size;
  }

  /* The chart is a layer you raise over the stage, not a mode that replaces
     it. It stops short of the rail so the tools stay reachable while editing. */
  .drill-layer {
    position: absolute;
    /* Clears the top band the scene chrome owns: the performer bar on the left,
       the command buttons on the right. The bar is the taller of the two. */
    top: 5.75rem;
    right: 5.75rem;
    bottom: 0.75rem;
    left: 0.75rem;
    z-index: 2;
    display: flex;
    min-width: 0;
    min-height: 0;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: #0c0e16;
    box-shadow: var(--theme-panel-shadow, 0 1.25rem 4rem rgba(0, 0, 0, 0.62));
  }

  .drill-chart {
    position: relative;
    min-width: 0;
    min-height: 0;
    flex: 1;
  }

  .drill-inspector {
    width: min(22rem, 34%);
    min-width: 0;
    flex: none;
    overflow-y: auto;
  }

  .load-notice {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 3;
    display: flex;
    width: min(24rem, calc(100% - 2rem));
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    padding: 1.5rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: #0c0e16;
    color: var(--theme-text, #fff);
    text-align: center;
    translate: -50% -50%;
  }

  .load-notice i {
    color: var(--theme-accent, #f59e0b);
    font-size: 2rem;
  }

  .load-notice.error i {
    color: var(--semantic-error, #ef4444);
  }

  .load-notice span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .unsupported-state {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    align-content: center;
    padding: clamp(1.25rem, 4cqi, 4.5rem);
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .unsupported-state i {
    color: var(--semantic-warning, #f59e0b);
    font-size: 2.5rem;
  }

  @container (max-width: 52rem) {
    .drill-layer {
      right: 0.75rem;
      flex-direction: column;
    }

    .drill-inspector {
      width: auto;
      max-height: 40%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .load-notice i {
      animation: none;
    }
  }
</style>
