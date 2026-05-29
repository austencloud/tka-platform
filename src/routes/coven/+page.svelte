<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { page } from "$app/stores";
  import { createViewerCameraPlayerState } from "@austencloud/camera-3d";
  import Viewer3DCamera from "$lib/shared/3d/components/Viewer3DCamera.svelte";
  import ForestScene from "$lib/shared/3d/environments/scenes/ForestScene.svelte";
  import CovenHub from "$lib/features/coven-hub/components/CovenHub.svelte";
  import CovenSequencePicker from "$lib/features/coven-hub/components/CovenSequencePicker.svelte";
  import { createCovenHubState } from "$lib/features/coven-hub/state/coven-hub-state.svelte";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";

  const hub = createCovenHubState();

  // Viewer3DCamera reads its nav mode + camera snapshot from the viewer-3d
  // context, so the route must own that state and provide it before the Canvas
  // mounts. The hub's nav toggle drives BOTH the hub's local mode and this
  // shared state so the camera actually switches between orbit and fly.
  const viewer3DState = createViewer3DState();
  setViewer3DContext(viewer3DState);

  // Camera-player avatar for fly mode (WASD writes here, not a performer).
  const cameraPlayer = createViewerCameraPlayerState({ spawnY: -1.5 });

  function setNavMode(mode: "orbit" | "fly") {
    hub.setNavMode(mode);
    viewer3DState.setNavMode(mode);
  }

  // Deep-link: /coven?seq=<id> loads that sequence and skips the picker.
  $effect(() => {
    const id = $page.url.searchParams.get("seq");
    if (!id) return;
    getBrowseLoader()
      .loadFullSequenceData(id, id)
      .then((seq) => {
        if (seq) hub.setSequence(seq);
      })
      .catch((err: unknown) => {
        console.warn("[CovenPage] Failed to load deep-linked sequence:", err);
      });
  });
</script>

<div class="page">
  {#if hub.pickerOpen}
    <CovenSequencePicker onSelect={(seq) => hub.setSequence(seq)} />
  {/if}

  <div class="nav">
    {#each ["orbit", "fly"] as const as mode}
      <button
        type="button"
        class:active={hub.navMode === mode}
        aria-pressed={hub.navMode === mode}
        onclick={() => setNavMode(mode)}>{mode}</button
      >
    {/each}
    <button type="button" onclick={() => hub.openPicker()}>change sequence</button>
  </div>

  <Canvas>
    <Viewer3DCamera
      cameraPlayerAvatar={cameraPlayer.avatarState}
      cameraPlayerPhysics={cameraPlayer.physicsProvider}
    />
    <ForestScene showStage={false} clearingRadius={28} />
    <CovenHub sequence={hub.activeSequence} />
  </Canvas>
</div>

<style>
  .page {
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #0a0a12;
  }

  .nav {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 15;
    display: flex;
    gap: 0.4rem;
  }

  .nav button {
    min-height: 2.5rem;
    padding: 0.4rem 0.8rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: #e8e8f0;
    cursor: pointer;
  }

  .nav button.active {
    background: #3a7fd9;
    border-color: #3a7fd9;
    color: #fff;
  }
</style>
