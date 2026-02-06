<!--
  CompositeView.svelte

  Container for Composite mode in Share Hub.
  Displays dual preview, composite controls, and export button.

  Features:
  - Dual preview showing both media pieces
  - Composite controls (orientation toggle, layout options)
  - Primary export button at bottom
  - Clean vertical layout

  Domain: Share Hub - Composite Mode Container
-->
<script lang="ts">
  import { getShareHubState } from "../../state/share-hub-state.svelte";
  import ExportButton from "../shared/ExportButton.svelte";
  import DualPreview from "./DualPreview.svelte";
  import CompositeControls from "./CompositeControls.svelte";

  let {
    isSequenceSaved = true,
    isMobile = false,
    onExport,
  }: {
    /** Whether the sequence has been saved to the library */
    isSequenceSaved?: boolean;
    /** Whether we're on a mobile device (affects button label) */
    isMobile?: boolean;
    onExport?: () => void;
  } = $props();

  // FIX: Use 'hubState' instead of 'state' to avoid collision with $state rune
  const hubState = getShareHubState();
  let exporting = $state(false);

  // Dynamic button label based on save state and platform
  const actionVerb = $derived(isMobile ? "Share" : "Save");
  const buttonLabel = $derived(
    isSequenceSaved
      ? `${actionVerb} Composite`
      : `Save & ${actionVerb} Composite`
  );

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

<div class="composite-view">
  <!-- Composite Controls -->
  <div class="controls-container">
    <CompositeControls />
  </div>

  <!-- Dual Preview -->
  <div class="preview-area">
    <DualPreview />
  </div>

  <!-- Export Button -->
  <div class="export-container">
    <ExportButton
      label={buttonLabel}
      loading={exporting}
      onclick={handleExport}
    />
  </div>
</div>

<style>
  .composite-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 20px;
    padding: 20px;
  }

  .controls-container {
    flex-shrink: 0;
  }

  .preview-area {
    flex: 1;
    min-height: 0; /* Allow flex child to shrink */
    display: flex;
    flex-direction: column;
  }

  .export-container {
    flex-shrink: 0;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke);
  }

  /* Mobile optimization */
  @media (max-width: 600px) {
    .composite-view {
      padding: 16px;
      gap: 16px;
    }
  }
</style>
