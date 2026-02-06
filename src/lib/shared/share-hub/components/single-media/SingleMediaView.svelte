<!--
  SingleMediaView.svelte

  Container for Single Media mode in Share Hub.
  Animation state is consumed from AnimationExportContext.

  Features:
  - Format selector (Animation | Static | Performance)
  - Conditional preview rendering based on selected format
  - Primary export button at bottom (hidden for animation - it has its own)
-->
<script lang="ts">
  import type { MediaFormat } from "../../domain/models/MediaFormat";
  import { getShareHubState } from "../../state/share-hub-state.svelte";
  import { getAnimationExportContext } from "../../context/animation-export-context.svelte";
  import FormatSelector from "../shared/FormatSelector.svelte";
  import ExportButton from "../shared/ExportButton.svelte";
  import AnimationExportView from "./AnimationExportView.svelte";
  import StaticPreview from "./StaticPreview.svelte";
  import PerformancePreview from "./PerformancePreview.svelte";

  let {
    isSequenceSaved = true,
    isMobile = false,
    onExport,
  }: {
    isSequenceSaved?: boolean;
    isMobile?: boolean;
    onExport?: () => void;
  } = $props();

  const hubState = getShareHubState();
  const animationContext = getAnimationExportContext();
  let exporting = $state(false);

  // Dynamic button label based on save state, format, and platform
  const formatLabel = $derived(
    hubState.selectedFormat === "animation"
      ? "Animation"
      : hubState.selectedFormat === "static"
        ? "Image"
        : "Video"
  );
  const actionVerb = $derived(isMobile ? "Share" : "Save");
  const buttonLabel = $derived(
    isSequenceSaved
      ? `${actionVerb} ${formatLabel}`
      : `Save & ${actionVerb} ${formatLabel}`
  );

  function handleFormatSelect(format: MediaFormat) {
    hubState.selectedFormat = format;
    // Notify parent coordinator of format change (for animation loading)
    animationContext.actions.onFormatChange(format);
  }

  async function handleExport() {
    if (exporting) return;
    exporting = true;
    try {
      await onExport?.();
    } finally {
      exporting = false;
    }
  }
</script>

<div class="single-media-view">
  <!-- Format Selector -->
  <div class="format-selector-container">
    <FormatSelector
      selectedFormat={hubState.selectedFormat}
      onFormatSelect={handleFormatSelect}
    />
  </div>

  <!-- Preview Area (conditional based on selected format) -->
  <div class="preview-area">
    {#if hubState.selectedFormat === "animation"}
      <AnimationExportView />
    {:else if hubState.selectedFormat === "static"}
      <StaticPreview />
    {:else if hubState.selectedFormat === "performance"}
      <PerformancePreview />
    {/if}
  </div>

  <!-- Export Button (hidden for Animation - AnimationControlsPanel has its own) -->
  {#if hubState.selectedFormat !== "animation"}
    <div class="export-container">
      <ExportButton
        label={buttonLabel}
        loading={exporting}
        onclick={handleExport}
      />
    </div>
  {/if}
</div>

<style>
  .single-media-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 20px;
    padding: 20px;
  }

  .format-selector-container {
    flex-shrink: 0;
  }

  .preview-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .export-container {
    flex-shrink: 0;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke);
  }

  @media (max-width: 600px) {
    .single-media-view {
      padding: 16px;
      gap: 16px;
    }
  }
</style>
