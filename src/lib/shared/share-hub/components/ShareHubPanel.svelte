<!--
  ShareHubPanel.svelte

  Main unified Share Hub panel combining Single Media and Composite modes.
  Animation state is consumed from AnimationExportContext (no prop drilling).

  Architecture:
  - Top: ModeToggle (Single Media | Composite) - hidden for MVP
  - Middle: Conditional view based on mode (SingleMediaView | CompositeView)
  - Overlay: SettingsPanel (slides in from right when gear clicked)
-->
<script lang="ts">
  import { createShareHubState } from "../state/share-hub-state.svelte";
  import SingleMediaView from "./single-media/SingleMediaView.svelte";
  import CompositeView from "./composite/CompositeView.svelte";
  import SettingsPanel from "./settings/SettingsPanel.svelte";
  import AnimationSettings from "./settings/AnimationSettings.svelte";
  import StaticSettingsPanel from "./settings/StaticSettings.svelte";
  import PerformanceSettingsPanel from "./settings/PerformanceSettings.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { untrack } from "svelte";
  import type { ExportSettings } from "../domain/models/ExportSettings";

  let {
    sequence,
    isSequenceSaved = true,
    isMobile = false,
    onExport,
  }: {
    sequence?: SequenceData | null;
    isSequenceSaved?: boolean;
    isMobile?: boolean;
    onExport?: (
      mode: "single" | "composite",
      settings?: ExportSettings
    ) => Promise<void>;
  } = $props();

  const hubState = createShareHubState();

  // Initialize sequence once on mount
  let sequenceInitialized = false;
  $effect.pre(() => {
    if (!sequenceInitialized && sequence !== undefined) {
      sequenceInitialized = true;
      untrack(() => {
        hubState.setSequence(sequence ?? null);
      });
    }
  });

  // Settings panel title based on context
  const settingsTitle = $derived(
    hubState.settingsContext
      ? `${hubState.settingsContext.format.charAt(0).toUpperCase() + hubState.settingsContext.format.slice(1)} Settings${
          hubState.settingsContext.pieceIndex
            ? ` (Piece ${hubState.settingsContext.pieceIndex})`
            : ""
        }`
      : "Settings"
  );

  // Handle export - passes current settings to parent
  async function handleExport() {
    if (hubState.mode === "single") {
      const format = hubState.selectedFormat;
      const exportSettings: ExportSettings = {
        format,
        staticSettings:
          format === "static" ? { ...hubState.staticSettings } : undefined,
        animationSettings:
          format === "animation"
            ? { ...hubState.animationSettings }
            : undefined,
        performanceSettings:
          format === "performance"
            ? { ...hubState.performanceSettings }
            : undefined,
      };
      await onExport?.(hubState.mode, exportSettings);
    } else {
      await onExport?.(hubState.mode, undefined);
    }
  }

  // Handle mode change
  function handleModeChange(mode: "single" | "composite") {
    hubState.mode = mode;
    if (hubState.settingsPanelOpen) {
      hubState.settingsPanelOpen = false;
      hubState.settingsContext = null;
    }
  }
</script>

<div class="share-hub-panel">
  <!-- MVP: Mode toggle hidden - only Single Media available -->
  <!-- <div class="mode-toggle-container">
    <ModeToggle mode={hubState.mode} onModeChange={handleModeChange} />
  </div> -->

  <!-- Content Area - Animation props come from context -->
  <div class="content-area">
    <SingleMediaView {isSequenceSaved} {isMobile} onExport={handleExport} />
  </div>

  <!-- Settings Panel Overlay -->
  {#if hubState.settingsPanelOpen && hubState.settingsContext}
    <SettingsPanel
      isOpen={hubState.settingsPanelOpen}
      title={settingsTitle}
      onClose={() => {
        hubState.settingsPanelOpen = false;
        hubState.settingsContext = null;
      }}
    >
      {#if hubState.settingsContext.format === "animation"}
        <AnimationSettings />
      {:else if hubState.settingsContext.format === "static"}
        <StaticSettingsPanel />
      {:else if hubState.settingsContext.format === "performance"}
        <PerformanceSettingsPanel />
      {/if}
    </SettingsPanel>
  {/if}
</div>

<style>
  .share-hub-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--theme-panel-bg);
    position: relative;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
