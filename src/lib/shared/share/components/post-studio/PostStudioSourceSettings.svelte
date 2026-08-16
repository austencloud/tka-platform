<script lang="ts">
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import type { ExportOptionsStateManager } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
  import ExportImagePanel from "$lib/shared/sequence-viewer/components/ExportImagePanel.svelte";

  let {
    sequence,
    exportOptions,
    selectedPropType,
    onPropChange,
    resolvedAutoLayout = null,
  }: {
    sequence: SequenceData;
    exportOptions: ExportOptionsStateManager;
    selectedPropType: PropType;
    onPropChange: (propType: PropType) => void;
    resolvedAutoLayout?: ResolvedAutoLayout | null;
  } = $props();

  const composition = getMediaCompositionContext();
  const selectedBinding = $derived(composition.selectedBinding);
</script>

{#if selectedBinding?.renderMode === "sequence-animation"}
  <div class="animation-settings">
    <AnimationPanel
      layout="sidebar"
      isExporting={false}
      isPlaying={composition.isPlaying}
      bpm={composition.tempoBpm ?? 60}
      onPlaybackToggle={composition.togglePlayback}
      onBpmChange={composition.tempoBpm === null
        ? undefined
        : composition.setTempoBpm}
      showTempoControls={composition.tempoBpm !== null}
      showEffectsPlayback={false}
      {selectedPropType}
      {onPropChange}
    />
  </div>
{:else if selectedBinding?.renderMode === "choreo-card"}
  <div class="card-settings">
    <ExportImagePanel
      {exportOptions}
      layout="inline"
      stepCount={sequence.steps.length}
      {resolvedAutoLayout}
    />
  </div>
{/if}

<style>
  .animation-settings {
    container-name: post-studio-animation-settings;
    container-type: inline-size;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md);
    background: var(--theme-card-bg);
  }

  .animation-settings :global(.export-panel.sidebar) {
    border-left: 0;
    background: transparent;
  }

  /* The sequence viewer deliberately centers a narrow settings column. Post
     Studio already supplies a dedicated inspector region, so its editor uses
     that whole region and starts at the top like a desktop property panel. */
  .animation-settings :global(.panel-center-inner) {
    max-width: none;
  }

  .animation-settings
    :global(.panel-center-inner:has(.effects-panel.detail-view)) {
    margin-block: 0;
  }

  .card-settings {
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md);
    background: var(--theme-card-bg);
  }

  .card-settings :global(.export-panel.inline) {
    background: transparent;
  }

  @container post-studio-animation-settings (min-width: 35rem) {
    .animation-settings :global(.panel-title),
    .animation-settings :global(.effects-panel.detail-view > .sb-footer) {
      display: none;
    }
  }
</style>
