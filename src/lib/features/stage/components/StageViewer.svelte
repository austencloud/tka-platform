<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { PerformerRig, Plane, PlaneMode } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";

  import Scene3D from "$lib/shared/3d/components/Scene3D.svelte";
  import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";
  import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
  import {
    getStageCoordinateFrame,
    isRenderable3DEnvironment,
  } from "$lib/shared/3d/environments/domain/stage-coordinate-frame";
  import { getSceneEnvironmentRendererKey } from "$lib/shared/3d/environments/domain/scene-environment";
  import { setSceneFeatureContext } from "$lib/shared/3d/scene-features/context/scene-feature-context";
  import { createSceneFeatureState } from "$lib/shared/3d/scene-features/state/scene-feature-state.svelte";
  import {
    createAvatarInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  import { getStageChoreographyContext } from "../context/stage-choreography-context";
  import { samplePerformerSequenceAtBeat } from "../domain/stage-sequence-timeline";
  import {
    DEFAULT_STAGE_SEQUENCE_ID,
    loadStageSequence,
  } from "../services/stage-sequence-loader";

  type PerformerRuntime = ReturnType<typeof createAvatarInstanceState>;
  type SequenceLoadState = "loading" | "ready" | "error";

  const WALL_PLANE = new Set([Plane.WALL]);
  const sceneFeatures = createSceneFeatureState(
    {
      stage: true,
      audience: false,
      environment: true,
    },
    { isolated: true }
  );
  setSceneFeatureContext(sceneFeatures);

  const stageState = getStageChoreographyContext();
  const choreography = $derived(stageState.choreography);
  const performanceFrames = $derived(stageState.performanceFrames);
  let viewerWidth = $state(1);
  let viewerHeight = $state(1);
  const viewerAspectRatio = $derived(
    Math.max(0.1, viewerWidth / Math.max(1, viewerHeight))
  );

  const backgroundType = $derived.by((): BackgroundType => {
    const rendererKey = getSceneEnvironmentRendererKey(
      stageState.choreography.environmentId
    );
    return isRenderable3DEnvironment(rendererKey)
      ? rendererKey
      : BackgroundType.FOREST;
  });
  const groundOffset = $derived(
    getStageCoordinateFrame(backgroundType, true).performerAnchorY
  );

  const framingShot = $derived.by(() =>
    computeFramingShot({
      performers: [
        { x: -choreography.stageWidth / 2, z: -choreography.stageDepth / 2 },
        { x: choreography.stageWidth / 2, z: -choreography.stageDepth / 2 },
        { x: -choreography.stageWidth / 2, z: choreography.stageDepth / 2 },
        { x: choreography.stageWidth / 2, z: choreography.stageDepth / 2 },
      ],
      plane: "wall",
      groundOffset,
      fovDeg: 50,
      aspectRatio: viewerAspectRatio,
      paddingMult: 1.08,
      elevationDeg: 12,
    })
  );
  const cameraPosition = $derived<[number, number, number]>([
    framingShot.eye.x,
    framingShot.eye.y,
    2 * framingShot.target.z - framingShot.eye.z,
  ]);
  const cameraTarget = $derived<[number, number, number]>([
    framingShot.target.x,
    framingShot.target.y,
    framingShot.target.z,
  ]);

  let performerRuntimes = $state<Map<string, PerformerRuntime>>(new Map());
  let resolvedSequences = $state<Map<string, SequenceData>>(new Map());
  let loadedSequenceByPerformer = new Map<string, string>();
  let sequenceLoadState = $state<SequenceLoadState>("loading");
  let sequenceLoadError = $state<string | null>(null);
  let retryRequest = $state(0);
  const sequenceIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const performer of choreography.performers) {
      for (const clip of performer.sequenceClips) ids.add(clip.sequenceId);
    }
    ids.add(choreography.sharedSequenceId ?? DEFAULT_STAGE_SEQUENCE_ID);
    return [...ids].sort();
  });

  const activeSequenceByPerformer = $derived.by(() => {
    const active = new Map<string, SequenceData>();
    for (const performer of choreography.performers) {
      const sample = samplePerformerSequenceAtBeat(
        performer,
        stageState.currentBeat
      );
      const sequenceId =
        sample?.clip.sequenceId ??
        choreography.sharedSequenceId ??
        DEFAULT_STAGE_SEQUENCE_ID;
      const sequence = resolvedSequences.get(sequenceId);
      if (sequence) active.set(performer.id, sequence);
    }
    return active;
  });

  $effect(() => {
    const performerIds = choreography.performers.map(
      (performer) => performer.id
    );
    untrack(() => {
      const next = new Map<string, PerformerRuntime>();
      for (const performerId of performerIds) {
        const existing = performerRuntimes.get(performerId);
        next.set(
          performerId,
          existing ??
            createAvatarInstanceState(
              {
                id: `stage-${performerId}`,
                positionX: 0,
                positionZ: 0,
              },
              makeStandaloneDeps()
            )
        );
      }
      for (const [performerId, runtime] of performerRuntimes) {
        if (!next.has(performerId)) {
          runtime.destroy();
          loadedSequenceByPerformer.delete(performerId);
        }
      }
      performerRuntimes = next;
    });
  });

  $effect(() => {
    const requestedIds = sequenceIds;
    retryRequest;
    let cancelled = false;

    sequenceLoadState = "loading";
    sequenceLoadError = null;
    resolvedSequences = new Map();
    loadedSequenceByPerformer = new Map();

    void Promise.all(
      requestedIds.map(
        async (sequenceId) =>
          [sequenceId, await loadStageSequence(sequenceId)] as const
      )
    )
      .then((entries) => {
        if (cancelled) return;
        resolvedSequences = new Map(entries);
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

  $effect(() => {
    const beat = stageState.currentBeat;
    const frames = performanceFrames;
    const runtimes = performerRuntimes;
    const performers = choreography.performers;
    const sequences = resolvedSequences;
    if (sequences.size === 0) return;

    untrack(() => {
      for (const frame of frames) {
        const runtime = runtimes.get(frame.performerId);
        const performer = performers.find(
          (candidate) => candidate.id === frame.performerId
        );
        if (!runtime || !performer) continue;

        const sample = samplePerformerSequenceAtBeat(performer, beat);
        const sequenceId =
          sample?.clip.sequenceId ??
          choreography.sharedSequenceId ??
          DEFAULT_STAGE_SEQUENCE_ID;
        const sequence = sequences.get(sequenceId);
        if (!sequence) continue;

        if (loadedSequenceByPerformer.get(frame.performerId) !== sequenceId) {
          runtime.loadSequence(sequence);
          loadedSequenceByPerformer.set(frame.performerId, sequenceId);
        }

        const stepIndex = sample?.stepIndex ?? 0;
        const progress = sample?.progress ?? 0;
        if (runtime.currentStepIndex !== stepIndex) {
          runtime.goToStep(stepIndex);
        }
        runtime.setProgress(progress);
        runtime.setMoveInput(frame.moveDirection);
      }
    });
  });

  function retrySequenceLoad(): void {
    retryRequest += 1;
  }

  onDestroy(() => {
    for (const runtime of performerRuntimes.values()) runtime.destroy();
    performerRuntimes.clear();
  });
</script>

<div
  class="stage-viewer"
  bind:clientWidth={viewerWidth}
  bind:clientHeight={viewerHeight}
  role="region"
  aria-label="3D stage performance preview"
  data-sequence-load-state={sequenceLoadState}
>
  <Scene3D
    {backgroundType}
    performerCount={performanceFrames.length}
    stageWidth={choreography.stageWidth}
    stageDepth={choreography.stageDepth}
    showStage={false}
    showAudience={false}
    showGrid={false}
    customCameraPosition={cameraPosition}
    customCameraTarget={cameraTarget}
  >
    {#snippet children()}
      {#if sequenceLoadState === "ready"}
        {#each performanceFrames as frame (frame.performerId)}
          {@const runtime = performerRuntimes.get(frame.performerId)}
          {@const activeSequence = activeSequenceByPerformer.get(
            frame.performerId
          )}
          {#if runtime && activeSequence}
            <PerformerRig
              position={frame.worldPosition}
              facingAngle={frame.bodyFacing}
              planeMode={PlaneMode.WALL}
              avatarState={runtime}
              showGrid={false}
              showEffects={false}
              visiblePlanes={WALL_PLANE}
              gridMode={(activeSequence.gridMode ?? "diamond") as GridMode}
              bluePropType={toScenePropType(PropType.STAFF)}
              redPropType={toScenePropType(PropType.STAFF)}
              {groundOffset}
              enableLocomotion={true}
              enableFootPlanting={true}
              isMoving={stageState.isPlaying && frame.isMoving}
              moveSpeed={frame.speedMetersPerSecond}
              isPlaying={stageState.isPlaying}
            />
          {/if}
        {/each}
      {/if}
    {/snippet}
  </Scene3D>

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
      <button type="button" onclick={retrySequenceLoad}>Try again</button>
    </div>
  {:else if sequenceLoadState === "ready"}
    <div class="performance-readout" aria-live="polite">
      <span class="sequence-name">{choreography.performers.length} lanes</span>
      <span
        >Beat {stageState.currentBeat.toFixed(1)} / {stageState.maxTotalBeats}</span
      >
    </div>
  {/if}
</div>

<style>
  .stage-viewer {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--border-radius-lg, 0.75rem);
    background: var(--theme-panel-bg, #12121c);
    container-type: size;
  }

  .load-notice {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 4;
    display: flex;
    width: min(24rem, calc(100% - 2rem));
    min-height: 10rem;
    translate: -50% -50%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    padding: 1.5rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #12121c) 92%,
      transparent
    );
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .load-notice i {
    color: var(--theme-accent, #f59e0b);
    font-size: 2rem;
  }

  .load-notice strong {
    font-size: 1rem;
  }

  .load-notice span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .load-notice.error i {
    color: var(--semantic-error, #ef4444);
  }

  .load-notice button {
    min-width: 7rem;
    min-height: 2.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #f59e0b) 55%, transparent);
    border-radius: 0.7rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 22%,
      var(--theme-card-bg, #222)
    );
    color: var(--theme-text, #fff);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .load-notice button:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 34%,
      var(--theme-card-bg, #222)
    );
  }

  .load-notice button:focus-visible {
    outline: 3px solid var(--theme-accent, #f59e0b);
    outline-offset: 3px;
  }

  .performance-readout {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #191923) 88%,
      transparent
    );
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.74));
    font-size: var(--font-size-compact, 0.75rem);
    pointer-events: none;
  }

  .sequence-name {
    color: var(--theme-text, #fff);
    font-weight: 750;
  }

  @container (max-height: 28rem) {
    .load-notice {
      min-height: 7rem;
      padding: 1rem;
    }

    .load-notice i {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .load-notice i {
      animation: none;
    }
  }
</style>
