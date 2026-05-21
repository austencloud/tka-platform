<script lang="ts">
  import RecordSceneRecordButton from "./RecordSceneRecordButton.svelte";
  import RecordingModeToggle from "./RecordingModeToggle.svelte";
  import type { CameraChoreographyState } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";

  interface Props {
    isExporting: boolean;
    canvasReady: boolean;
    onExport: () => void;
    choreography: CameraChoreographyState;
  }

  let { isExporting, canvasReady, onExport, choreography }: Props = $props();

  const currentMode = $derived(
    choreography?.activePresetId === "auto-orbit" ? "auto-orbit" as const : "free" as const
  );

  function handleModeToggle(mode: "free" | "auto-orbit") {
    choreography?.setPresetId(mode);
  }
</script>

<div class="chrome-root">
  <div class="bottom-right">
    <RecordingModeToggle
      mode={currentMode}
      onToggle={handleModeToggle}
    />
    <RecordSceneRecordButton
      {onExport}
      {isExporting}
      {canvasReady}
    />
  </div>
</div>

<style>
  .chrome-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .bottom-right {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
    bottom: 68px;
    right: 16px;
  }

  @media (max-width: 600px) {
    .bottom-right {
      bottom: 60px;
      right: 12px;
    }
  }
</style>
