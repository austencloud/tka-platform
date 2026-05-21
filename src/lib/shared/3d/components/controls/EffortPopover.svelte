<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";
  import CascadeBadge from "./CascadeBadge.svelte";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const isAllMode = $derived(selectedIndex === null);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const currentEffort = $derived(
    isAllMode
      ? viewer.defaultSettings.effortId
      : (selected?.effectiveEffortId ?? viewer.defaultSettings.effortId)
  );

  const isOverridden = $derived(!isAllMode && (selected?.hasOverride.effort ?? false));
  const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("effort") : 0);

  function handleSelect(effortId: EffortId) {
    if (isAllMode) {
      viewer.setDefaultEffort(effortId);
    } else if (selected) {
      selected.setEffort(effortId);
    }
  }
</script>

<div style="--theme-stroke: rgba(255,255,255,0.1); --theme-card-bg: rgba(255,255,255,0.04); --theme-text-dim: rgba(255,255,255,0.5);">
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge mode="overrides" {overrideCount} categoryLabel="effort" onReset={() => viewer.resetAllPerformersEffort()} />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetEffort()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}

  <EffortPalette
    selectedEffort={currentEffort}
    onSelect={handleSelect}
  />
</div>
