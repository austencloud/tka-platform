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
     that whole region and starts at the top like a desktop property panel.

     `margin-block` is the half that actually does it. The shared panel sets
     `margin: auto 0`, which floated the section in the middle of the rail —
     at 1920 that left 234px of dead space above the first control and the
     same again below it. Releasing `max-width` alone never touched it. */
  .animation-settings :global(.panel-center-inner) {
    max-width: none;
    margin-block: 0;
    align-self: stretch;
  }

  /* The rail centers itself independently of the section it navigates. Once
     the section starts at the top, a centered rail leaves an L-shaped hole in
     the corner between them — both have to agree on the top edge. */
  .animation-settings :global(.icon-rail) {
    justify-content: flex-start;
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

  /* The studio chrome steps up at 105rem / 180rem (PostStudio.svelte), but the
     embedded sequence-viewer panels size themselves from the global type and
     touch-target tokens, so at 4K the rails grew and their contents stayed at
     12px / 44px. Redefining the tokens on the wrapper carries the step through
     every chip, label and row inside without forking the shared panel CSS. */
  @container post-studio (min-width: 105rem) {
    .animation-settings,
    .card-settings {
      --font-size-compact: 0.8125rem;
      --font-size-min: 0.9375rem;
      --min-touch-target: 3rem;
    }
  }

  @container post-studio (min-width: 180rem) {
    .animation-settings,
    .card-settings {
      --font-size-compact: 1.0625rem;
      --font-size-min: 1.25rem;
      --min-touch-target: 3.75rem;
    }

    /* The icon rail is laid out in px and has no token to ride. */
    .animation-settings :global(.icon-rail) {
      width: 12rem;
    }

    .animation-settings :global(.rail-btn) {
      height: 4.25rem;
      font-size: 1.5rem;
    }
  }
</style>
