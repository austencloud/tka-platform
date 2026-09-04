<script lang="ts">
  import { onMount } from "svelte";

  import { createJellyfishChime } from "../../environments/scenes/ocean/runtime/fauna/jellyfish/jellyfish-chime";
  import type { ApplicationThreadCameraSnapshot } from "../domain/application-thread-camera";
  import { getWorkerEnvironmentCamera } from "../domain/worker-environment-camera";
  import type {
    WorkerEnvironmentKey,
    WorkerEffectQualityTier,
    WorkerPerformerSnapshot,
    WorkerSceneEffectsSnapshot,
  } from "../domain/worker-renderer-protocol";
  import {
    createApplicationThreadCameraController,
    type ApplicationThreadCameraController,
  } from "../services/application-thread-camera-controller";
  import {
    WorkerEnvironmentRenderer,
    type WorkerSceneSwitchSnapshot,
  } from "../services/worker-environment-renderer";
  import type {
    WorkerPerformerInteractionCameraArbiter,
    WorkerPerformerInteractionFrame,
    WorkerPerformerInteractionViewer,
  } from "../services/worker-performer-interaction";
  import WorkerPerformerInteractionAdapter, {
    type WorkerPerformerInteractionFailure,
    type WorkerPerformerInteractionStateSnapshot,
  } from "./WorkerPerformerInteractionAdapter.svelte";

  interface PixelRatioAwareWorkerRenderer {
    setPixelRatio?(pixelRatio: number): void;
  }

  interface Props {
    environment: WorkerEnvironmentKey;
    performers?: readonly WorkerPerformerSnapshot[];
    effects?: WorkerSceneEffectsSnapshot;
    initialCamera?:
      | import("../domain/worker-renderer-protocol").WorkerCameraSnapshot
      | null;
    initialCameraRoll?: number;
    maxOrbitDistance?: number;
    cameraFov?: number;
    pixelRatio?: number;
    qualityTier?: WorkerEffectQualityTier;
    onFrame?: (deltaMs: number) => void;
    performerInteractionFrame?: WorkerPerformerInteractionFrame | null;
    interactionViewer?: WorkerPerformerInteractionViewer | null;
    interactionCameraArbiter?: WorkerPerformerInteractionCameraArbiter | null;
    onPerformerInteractionChange?: (
      snapshot: WorkerPerformerInteractionStateSnapshot
    ) => void;
    onPerformerInteractionFailure?: (
      failure: WorkerPerformerInteractionFailure
    ) => void;
    onPerformerInteractionHintDismissed?: () => void;
    onCameraInteractionStart?: (
      snapshot: ApplicationThreadCameraSnapshot
    ) => void;
    onCameraInteractionEnd?: (
      snapshot: ApplicationThreadCameraSnapshot
    ) => void;
    onCameraChange?: (snapshot: ApplicationThreadCameraSnapshot) => void;
    onSnapshot?: (snapshot: WorkerSceneSwitchSnapshot) => void;
  }

  let {
    environment,
    performers = [],
    effects = { playing: false, sources: [] },
    initialCamera = null,
    initialCameraRoll = 0,
    maxOrbitDistance = 25,
    cameraFov,
    pixelRatio,
    qualityTier = "medium",
    onFrame,
    performerInteractionFrame = null,
    interactionViewer = null,
    interactionCameraArbiter = null,
    onPerformerInteractionChange,
    onPerformerInteractionFailure,
    onPerformerInteractionHintDismissed,
    onCameraInteractionStart,
    onCameraInteractionEnd,
    onCameraChange,
    onSnapshot,
  }: Props = $props();

  let container = $state<HTMLDivElement>();
  let interactionSurface = $state<HTMLDivElement>();
  let renderer: WorkerEnvironmentRenderer | null = null;
  let cameraController: ApplicationThreadCameraController | null = null;
  let cameraResizeObserver: ResizeObserver | null = null;
  let cameraSnapshot = $state<ApplicationThreadCameraSnapshot | null>(null);
  let performerInteractionState =
    $state<WorkerPerformerInteractionStateSnapshot>({
      hoveredIndex: null,
      draggingIndex: null,
    });
  let cameraInteractionActive = false;
  const jellyfishChime = createJellyfishChime();

  const performerCameraArbiter: WorkerPerformerInteractionCameraArbiter = {
    get enabled() {
      const localEnabled = cameraController?.controls.enabled ?? false;
      return interactionCameraArbiter
        ? localEnabled && interactionCameraArbiter.enabled
        : localEnabled;
    },
    set enabled(value: boolean) {
      cameraController?.setEnabled(value);
      if (interactionCameraArbiter) interactionCameraArbiter.enabled = value;
    },
    get azimuthAngle() {
      return (
        interactionCameraArbiter?.azimuthAngle ??
        cameraController?.controls.azimuthAngle ??
        0
      );
    },
  };

  function handleInteraction(
    message: import("../domain/worker-renderer-protocol").WorkerRendererInteractionMessage
  ): void {
    const performerCursor =
      performerInteractionState.draggingIndex !== null
        ? "grabbing"
        : performerInteractionState.hoveredIndex !== null
          ? "grab"
          : null;
    if (interactionSurface) {
      interactionSurface.style.cursor =
        performerCursor ?? (message.hover ? "pointer" : "");
    }
    if (message.chime) {
      jellyfishChime.play(message.chime.frequencyHz, message.chime.pan);
    }
  }

  function applyCameraSnapshot(
    snapshot: ApplicationThreadCameraSnapshot
  ): void {
    cameraSnapshot = snapshot;
    renderer?.setCamera(snapshot);
  }

  function handleCameraInteractionStart(
    snapshot: ApplicationThreadCameraSnapshot
  ): void {
    cameraInteractionActive = true;
    onCameraInteractionStart?.(snapshot);
    applyCameraSnapshot(snapshot);
  }

  function handleCameraInteractionEnd(
    snapshot: ApplicationThreadCameraSnapshot
  ): void {
    cameraInteractionActive = false;
    onCameraInteractionEnd?.(snapshot);
    applyCameraSnapshot(snapshot);
    onCameraChange?.(snapshot);
  }

  function applyPixelRatio(value: number | undefined): void {
    if (value === undefined) return;
    (
      renderer as
        | (WorkerEnvironmentRenderer & PixelRatioAwareWorkerRenderer)
        | null
    )?.setPixelRatio?.(value);
  }

  function handlePerformerInteractionChange(
    snapshot: WorkerPerformerInteractionStateSnapshot
  ): void {
    performerInteractionState = snapshot;
    onPerformerInteractionChange?.(snapshot);
  }

  onMount(() => {
    const mountedInteractionSurface = interactionSurface;
    if (!mountedInteractionSurface) return;

    renderer = new WorkerEnvironmentRenderer({
      container: mountedInteractionSurface,
      onSnapshot,
      onFrame,
      onInteraction: handleInteraction,
      qualityTier,
    });
    const cameraSeed = initialCamera ?? getWorkerEnvironmentCamera(environment);
    cameraController = createApplicationThreadCameraController(
      mountedInteractionSurface,
      {
        initialPosition: cameraSeed.position,
        initialTarget: cameraSeed.target,
        up: cameraSeed.up,
        roll: initialCameraRoll,
        fov: cameraFov ?? cameraSeed.fov,
        minDistance: 1,
        maxDistance: maxOrbitDistance,
        maxPolarAngle: Math.PI / 2,
        onChange: applyCameraSnapshot,
        onControlStart: handleCameraInteractionStart,
        onControlEnd: handleCameraInteractionEnd,
      }
    );
    applyPixelRatio(pixelRatio);
    applyCameraSnapshot(cameraController.getSnapshot());
    cameraResizeObserver = new ResizeObserver(() => {
      if (
        !cameraController ||
        mountedInteractionSurface.clientWidth < 1 ||
        mountedInteractionSurface.clientHeight < 1
      ) {
        return;
      }
      cameraController.setViewport(
        mountedInteractionSurface.clientWidth,
        mountedInteractionSurface.clientHeight
      );
      applyCameraSnapshot(cameraController.getSnapshot());
    });
    cameraResizeObserver.observe(mountedInteractionSurface);
    renderer.setPerformers($state.snapshot(performers));
    renderer.setEffects($state.snapshot(effects));
    renderer.switchTo(environment);

    return () => {
      if (cameraInteractionActive && cameraController) {
        onCameraInteractionEnd?.(cameraController.getSnapshot());
        cameraInteractionActive = false;
      }
      renderer?.dispose();
      renderer = null;
      cameraResizeObserver?.disconnect();
      cameraResizeObserver = null;
      cameraController?.dispose();
      cameraController = null;
      jellyfishChime.dispose();
    };
  });

  $effect(() => {
    renderer?.switchTo(environment);
  });

  $effect(() => {
    renderer?.setPerformers($state.snapshot(performers));
  });

  $effect(() => {
    renderer?.setEffects($state.snapshot(effects));
  });

  $effect(() => {
    applyPixelRatio(pixelRatio);
  });

  $effect(() => {
    renderer?.setQualityTier(qualityTier);
  });
</script>

<div class="worker-environment-renderer" bind:this={container}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex - the stable 3D application surface owns performer keyboard input -->
  <div
    class="worker-environment-renderer__interaction-surface"
    bind:this={interactionSurface}
    role="application"
    aria-label="3D performer stage"
    tabindex={interactionViewer ? 0 : undefined}
  ></div>

  {#if container && interactionSurface && cameraSnapshot && performerInteractionFrame && interactionViewer}
    {#key interactionViewer}
      <WorkerPerformerInteractionAdapter
        {interactionSurface}
        projectionContainer={container}
        frame={performerInteractionFrame}
        viewer={interactionViewer}
        cameraArbiter={performerCameraArbiter}
        {cameraSnapshot}
        onInteractionChange={handlePerformerInteractionChange}
        onFailure={onPerformerInteractionFailure}
        onHintDismissed={onPerformerInteractionHintDismissed}
      />
    {/key}
  {/if}
</div>

<style>
  .worker-environment-renderer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #05050a;
    contain: strict;
  }

  .worker-environment-renderer__interaction-surface {
    position: absolute;
    inset: 0;
  }

  :global(.worker-environment-renderer__canvas) {
    display: block;
  }
</style>
