<script lang="ts">
  import { onMount } from "svelte";
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { getPerformerColor } from "$lib/shared/3d/constants/performer-colors";
  import ViewerPopover from "$lib/shared/3d/components/controls/ViewerPopover.svelte";
  import TempoPopover from "./TempoPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import CameraPopover from "$lib/shared/3d/components/CameraPopover.svelte";
  import PlanesPopover from "$lib/shared/3d/components/PlanesPopover.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
  import FormationPopover from "$lib/shared/3d/components/controls/FormationPopover.svelte";
  import EffectsPopover from "$lib/shared/3d/components/controls/EffectsPopover.svelte";
  import PropPopover from "$lib/shared/3d/components/controls/PropPopover.svelte";
  import EffortPopover from "$lib/shared/3d/components/controls/EffortPopover.svelte";
  import PerformerPropSizeSlider from "$lib/shared/3d/components/controls/PerformerPropSizeSlider.svelte";
  import { createViewer3DKeyboardHandler } from "$lib/shared/3d/keyboard/Viewer3DKeyboardHandler";

  const viewer = getViewer3DContext();

  interface Props {
    renderMode: "2d" | "3d";
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
  }
  let { renderMode, bpm = 60, onBpmChange = () => {} }: Props = $props();

  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isIndividualMode = $derived(renderMode === "3d" && selectedIndex !== null);
  const performerColor = $derived(isIndividualMode ? getPerformerColor(selectedIndex ?? 0) : undefined);
  const selectedPerformer = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const propOverride = $derived(selectedPerformer?.hasOverride.prop ?? false);
  const effectsOverride = $derived(selectedPerformer?.hasOverride.effects ?? false);
  const effortOverride = $derived(selectedPerformer?.hasOverride.effort ?? false);
  const planesOverride = $derived(selectedPerformer?.hasOverride.planes ?? false);

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
    <ViewerPopover id="formation" title="Formation" icon="fa-users" tooltip="Formation">
      <FormationPopover />
    </ViewerPopover>

    <ViewerPopover id="tempo" title="Tempo" icon="fa-gauge" tooltip="Speed" width={340}>
      <TempoPopover {bpm} {onBpmChange} />
    </ViewerPopover>

    <ViewerPopover id="camera" title="Camera" icon="fa-video" tooltip="Camera" width={300}>
      <CameraPopover />
    </ViewerPopover>

    <ViewerPopover id="export" title="Export" icon="fa-arrow-up-from-bracket" tooltip="Export" width={340}>
      <ExportPopover />
    </ViewerPopover>

    <ViewerPopover id="scene" title="Scene" icon="fa-mountain-sun" tooltip="Scene" width={320}>
      <SceneSelectorPopover />
    </ViewerPopover>

    <div class="performer-separator" aria-hidden="true">
      <div class="separator-line"></div>
    </div>

    <ViewerPopover
      id="planes"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-layer-group"
      tooltip="Planes"
      width={320}
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={planesOverride}
    >
      <PlanesPopover />
    </ViewerPopover>

    <ViewerPopover
      id="effects"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-wand-magic-sparkles"
      tooltip="Effects"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={effectsOverride}
    >
      <EffectsPopover />
    </ViewerPopover>

    <ViewerPopover
      id="prop"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-staff-snake"
      tooltip="Prop"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={propOverride}
    >
      <PropPopover />
      {#snippet footer()}
        {#if selectedPerformer}
          <PerformerPropSizeSlider performer={selectedPerformer} />
        {/if}
      {/snippet}
    </ViewerPopover>

    <ViewerPopover
      id="effort"
      title={isIndividualMode ? `Performer ${(selectedIndex ?? 0) + 1}` : "All Performers"}
      icon="fa-wave-square"
      tooltip="Effort"
      accentColor={performerColor}
      performerScoped={isIndividualMode}
      hasOverride={effortOverride}
    >
      <EffortPopover />
    </ViewerPopover>
  {/if}
</div>

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
