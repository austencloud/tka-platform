<!--
  VideoRecordDrawer.svelte

  Full-height drawer for camera-based video recording.
  Used in Create and Library modules for low-stakes "proof of completion" videos.
-->
<script lang="ts">
  import CreatePanelDrawer from "$lib/features/create/shared/components/CreatePanelDrawer.svelte";
  import PanelHeader from "$lib/features/create/shared/components/PanelHeader.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import VideoRecordPanel from "./VideoRecordPanel.svelte";
  import type { RecordingResult } from "../services/contracts/IVideoRecorder";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let {
    show = $bindable(false),
    sequence = null,
    onClose,
    onSave,
    heading = "Record Video",
  }: {
    show?: boolean;
    sequence?: SequenceData | null;
    onClose?: () => void;
    onSave?: (recording: RecordingResult) => void;
    heading?: string;
  } = $props();

  function handleClose() {
    show = false;
    onClose?.();
  }

  function handleSave(recording: RecordingResult) {
    onSave?.(recording);
    handleClose();
  }

  const createModuleContext = tryGetCreateModuleContext();
  const isSideBySideLayout = $derived(
    createModuleContext
      ? createModuleContext.layout.shouldUseSideBySideLayout
      : false
  );
</script>

<CreatePanelDrawer
  isOpen={show}
  panelName="video-record"
  fullHeightOnMobile={true}
  showHandle={true}
  closeOnBackdrop={true}
  focusTrap={false}
  lockScroll={false}
  labelledBy="video-record-panel-title"
  onClose={handleClose}
>
  <div
    class="video-record-drawer"
    role="dialog"
    aria-labelledby="video-record-panel-title"
  >
    <PanelHeader
      title={heading}
      isMobile={!isSideBySideLayout}
      onClose={handleClose}
    />

    <h2 id="video-record-panel-title" class="sr-only">{heading}</h2>

    <div class="video-record-drawer__content">
      <VideoRecordPanel {sequence} onClose={handleClose} onSave={handleSave} />
    </div>
  </div>
</CreatePanelDrawer>

<style>
  /* Screen reader only class */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Drawer container - full height, flex layout */
  .video-record-drawer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Content area - takes remaining space */
  .video-record-drawer__content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
