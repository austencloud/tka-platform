<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import type { CameraStateSnapshot } from "@austencloud/scene-3d";
  import { replaceState } from "$app/navigation";
  import { onDestroy } from "svelte";

  import Viewer3DFullscreen from "$lib/shared/3d/components/Viewer3DFullscreen.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import {
    readCameraUrlPose,
    setCameraUrlPose,
  } from "$lib/shared/3d/domain/camera-url-pose";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { createPlaybackState } from "$lib/shared/3d/state/playback-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import demoSequenceJson from "$lib/shared/landing/data/demo-sequence.json";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const WORKBENCH_SCENES = new Set<string>([
    BackgroundType.FOREST,
    BackgroundType.AUTUMN,
    BackgroundType.COSMIC,
    BackgroundType.WINTER,
    BackgroundType.OCEAN,
    BackgroundType.EMBER,
    BackgroundType.BLOSSOM,
    BackgroundType.PRIDE,
    BackgroundType.CELESTIAL,
    BackgroundType.VOID,
  ]);
  const STREAMED_SCENE_FEATURES = ["environment"] as const;

  function requestedScene(): BackgroundType {
    if (typeof window === "undefined") return BackgroundType.BLOSSOM;
    const requested = new URLSearchParams(window.location.search).get("scene");
    return requested && WORKBENCH_SCENES.has(requested)
      ? (requested as BackgroundType)
      : BackgroundType.BLOSSOM;
  }

  function requestedCamera(): CameraStateSnapshot | undefined {
    if (typeof window === "undefined") return undefined;
    const pose = readCameraUrlPose(
      new URLSearchParams(window.location.search),
      48
    );
    if (!pose) return undefined;
    return {
      ...pose,
      rotation: { x: 0, y: 0, z: 0 },
      timestamp: 0,
    };
  }

  const sequence = demoSequenceJson as unknown as SequenceData;
  const viewer = createViewer3DState({
    renderMode: "3d",
    backgroundType: requestedScene(),
    camera: requestedCamera(),
    performers: [],
    selectedPerformerIndex: 0,
    activeFormation: "line",
    defaultProp: PropType.STAFF,
    visiblePlanes: [],
    effectToggles: {},
    sceneFeatures: {
      environment: true,
      stage: true,
      audience: false,
      campfire: false,
      tent: false,
    },
  });
  viewer.enter3D(sequence);
  viewer.hideAllPlanes();
  setViewer3DContext(viewer);

  let currentStepBase = $state(0);
  let bpm = $state(60);
  const playback = createPlaybackState({
    persistenceKey: "tka-viewer-3d-workbench-playback",
    onCycleComplete: () => {
      const stepCount = Math.max(1, sequence.steps.length);
      currentStepBase = (currentStepBase + 1) % stepCount;
      return true;
    },
  });
  const currentStep = $derived(currentStepBase + playback.progress);

  $effect(() => {
    playback.speed = bpm / 60;
  });

  $effect(() => {
    const scene = viewer.seededBackgroundType;
    if (!scene || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("scene") === scene) return;
    url.searchParams.set("scene", scene);
    replaceState(url, {});
  });

  $effect(() => {
    const camera = viewer.cameraSnapshot;
    if (!camera || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    setCameraUrlPose(url, camera, 3);
    replaceState(url, {});
  });

  onDestroy(() => {
    playback.destroy();
    viewer.dispose();
  });
</script>

<div class="workbench" data-viewer-3d-workbench>
  <Viewer3DFullscreen
    sequenceData={sequence}
    {currentStep}
    isPlaying={playback.isPlaying}
    {bpm}
    word={null}
    bluePropType="staff"
    redPropType="staff"
    initialRevealMode="streaming"
    initialRevealDeferredFeatures={STREAMED_SCENE_FEATURES}
    onClose={() => history.back()}
    onPlaybackToggle={playback.togglePlay}
    onBpmChange={(nextBpm) => (bpm = nextBpm)}
    onProgressBarSeek={(targetStep) => {
      currentStepBase = targetStep;
      playback.setProgress(0);
    }}
  />
</div>

<style>
  .workbench {
    position: fixed;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-panel-bg, #0a0a14);
  }
</style>
