<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import CascadeBadge from "./CascadeBadge.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const isOverridden = $derived(!isAllMode && (selected?.hasOverride.effects ?? false));
  const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("effects") : 0);
</script>

<div class="effects-content">
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge mode="overrides" {overrideCount} categoryLabel="effects" onReset={() => viewer.resetAllPerformersEffects()} />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetEffects()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}

  <EffectsPanel layout="grid" bpm={0} onBpmChange={() => {}} isPlaying={false} onPlaybackToggle={() => {}} showPlayback={false} />
</div>

<style>
  .effects-content {
    max-height: 70vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
