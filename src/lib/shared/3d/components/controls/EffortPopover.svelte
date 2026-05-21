<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import EffortPalette from "$lib/shared/phrase-effort-lab/components/EffortPalette.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });
</script>

{#if selected}
  <div style="--theme-stroke: rgba(255,255,255,0.1); --theme-card-bg: rgba(255,255,255,0.04); --theme-text-dim: rgba(255,255,255,0.5);">
    <EffortPalette
      selectedEffort={selected.settings.effortId ?? "linear"}
      onSelect={(e) => selected.setEffort(e)}
    />
  </div>
{/if}
