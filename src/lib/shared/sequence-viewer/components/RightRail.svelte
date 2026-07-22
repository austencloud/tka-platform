<script lang="ts">
  import { onMount } from "svelte";
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import ViewerPopover from "$lib/shared/3d/components/controls/ViewerPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import CameraPopover from "$lib/shared/3d/components/CameraPopover.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
  import FormationPopover from "$lib/shared/3d/components/controls/FormationPopover.svelte";
  import { createViewer3DKeyboardHandler } from "$lib/shared/3d/keyboard/viewer-3d-keyboard-handler";
  import DevToolsPopover from "$lib/shared/3d/components/controls/DevToolsPopover.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import SaveSceneModal from "$lib/features/scene-3d-collection/components/SaveSceneModal.svelte";
  import {
    reportViewerControlChange,
    type ViewerActionSink,
    type ViewerControlSink,
  } from "../domain/viewer-control-analytics";

  const viewer = getViewer3DContext();

  interface Props {
    renderMode: "2d" | "3d";
    /** Playback tempo, threaded from the split pane so scene saves capture it. */
    bpm?: number;
    onSettingChange?: ViewerControlSink;
    onAction?: ViewerActionSink;
  }
  let { renderMode, bpm, onSettingChange, onAction }: Props = $props();

  let saveSceneOpen = $state(false);

  function openSaveScene(): void {
    const previous = saveSceneOpen;
    saveSceneOpen = true;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_rail",
      "save_scene_open",
      previous,
      true
    );
  }

  onMount(() => {
    const cleanupKeyboard = createViewer3DKeyboardHandler({
      undo: () => viewer.undo(),
      redo: () => viewer.redo(),
    });
    return () => cleanupKeyboard();
  });
</script>

<div
  class="right-rail"
  class:mode-2d={renderMode === "2d"}
  class:mode-3d={renderMode === "3d"}
  role="toolbar"
  aria-label="Viewer controls"
>
  {#if renderMode === "3d"}
    <ViewerPopover
      id="formation"
      title="Formation"
      icon="fa-users"
      tooltip="Formation"
      {onSettingChange}
    >
      <FormationPopover {onSettingChange} />
    </ViewerPopover>

    <ViewerPopover
      id="camera"
      title="Camera"
      icon="fa-video"
      tooltip="Camera"
      width={300}
      {onSettingChange}
    >
      <CameraPopover {onSettingChange} />
    </ViewerPopover>

    <ViewerPopover
      id="export"
      title="Export"
      icon="fa-arrow-up-from-bracket"
      tooltip="Export"
      width={340}
      {onSettingChange}
    >
      <ExportPopover {onSettingChange} />
    </ViewerPopover>

    <button
      type="button"
      class="rail-chip"
      aria-label="Save scene"
      data-tooltip="Save scene"
      onclick={openSaveScene}
    >
      <i class="fas fa-bookmark"></i>
    </button>

    <ViewerPopover
      id="scene"
      title="Scene"
      icon="fa-mountain-sun"
      tooltip="Scene"
      width={320}
      {onSettingChange}
    >
      <SceneSelectorPopover {onSettingChange} />
    </ViewerPopover>

    <!-- Prop/Planes/Effort/Effects controls moved to PerformerHub -->

    {#if authState.isAdmin}
      <div class="performer-separator" aria-hidden="true">
        <div class="separator-line"></div>
      </div>
      <ViewerPopover
        id="dev"
        title="Dev Tools"
        icon="fa-terminal"
        tooltip="Dev Tools"
        width={280}
        {onSettingChange}
      >
        <DevToolsPopover />
      </ViewerPopover>
    {/if}
  {/if}
</div>

{#if renderMode === "3d"}
  <SaveSceneModal
    bind:open={saveSceneOpen}
    {bpm}
    {onSettingChange}
    {onAction}
  />
{/if}

<style>
  .right-rail {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9;
  }
  /* Standalone rail chip — mirrors ViewerPopover's .rail-chip (scoped there). */
  .rail-chip {
    width: 56px;
    height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover {
    transform: scale(1.08);
    border-color: rgba(255, 255, 255, 0.22);
  }
  .rail-chip:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    background: rgba(0, 0, 0, 0.88);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
    animation: rail-tooltip-in 160ms cubic-bezier(0.2, 0, 0.13, 1.5) 180ms both;
  }
  @keyframes rail-tooltip-in {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(4px) scale(0.94);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0) scale(1);
    }
  }
  .rail-chip i {
    font-size: 22px;
  }
  .performer-separator {
    display: flex;
    justify-content: center;
    padding: 0;
  }
  .separator-line {
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
</style>
