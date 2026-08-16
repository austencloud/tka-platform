<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPerformerColor } from "../../constants/performer-colors";
  import CascadeBadge from "./CascadeBadge.svelte";
  import PropFamilyPicker from "./PropFamilyPicker.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const selected = $derived.by(() =>
    selectedIndex === null
      ? null
      : (viewer.performerManager.performers[selectedIndex] ?? null)
  );
  const isAllMode = $derived(selectedIndex === null);
  const currentProp = $derived(
    isAllMode
      ? viewer.defaultSettings.prop
      : (selected?.effectiveProp ?? viewer.defaultSettings.prop)
  );
  const isOverridden = $derived(
    !isAllMode && (selected?.hasOverride.prop ?? false)
  );
  const overrideCount = $derived(
    isAllMode ? viewer.overrideCountForCategory("prop") : 0
  );
  const performerColor = $derived(
    isAllMode ? "#4a9eff" : getPerformerColor(selectedIndex ?? 0)
  );

  function selectProp(propType: PropType): void {
    if (isAllMode) viewer.setDefaultProp(propType);
    else selected?.setProp(propType);
  }
</script>

<div class="prop-content">
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge
      mode="overrides"
      {overrideCount}
      categoryLabel="prop"
      onReset={() => viewer.resetAllPerformersProp()}
    />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetProp()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}

  <PropFamilyPicker
    {currentProp}
    accentColor={performerColor}
    onSelect={selectProp}
  />
</div>

<style>
  .prop-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    container-type: inline-size;
  }
</style>
