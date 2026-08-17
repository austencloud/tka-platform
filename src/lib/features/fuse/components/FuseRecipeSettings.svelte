<script lang="ts">
  import GenerationSettingsOverlay from "$lib/features/create/generate/components/cards/GenerationSettingsOverlay.svelte";
  import SettingsDrillPanel, {
    type SettingsDrillItem,
  } from "$lib/shared/ui/components/settings-drill/SettingsDrillPanel.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    isFuseRecipeDestination,
    type FuseSettingsDestination,
  } from "../domain/fuse-recipe-destination";
  import { buildFuseRecipeSummaries } from "../domain/fuse-recipe-summaries";
  import FuseRecipeSettingContent from "./FuseRecipeSettingContent.svelte";

  let {
    destination = $bindable(null),
    onClose,
  }: {
    destination?: FuseSettingsDestination;
    onClose: () => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const summaries = $derived(
    buildFuseRecipeSummaries({
      requestedLength: fuseState.requestedLength,
      generationLevel: fuseState.generationLevel,
      maxTurnIntensity: fuseState.maxTurnIntensity,
      gridMode: fuseState.gridMode,
      constraintPreset: fuseState.constraintPreset,
      handPathMode: fuseState.handPathMode,
      motionTypeFilter: fuseState.motionTypeFilter,
      startLocation: fuseState.startLocation,
      startOrientation: fuseState.startOrientation,
      traversalDirection: fuseState.traversalDirection,
      mode: fuseState.mode,
      driverSide: fuseState.driverSide,
      rule: fuseState.rule,
    })
  );
  // Pairing is listed only when there is a pairing: separate paths have no rule,
  // and the header switch is what links them. Listing it anyway is how the
  // recipe used to open on an editor with nothing in it.
  const drillItems = $derived<SettingsDrillItem[]>([
    { id: "length", label: "Length", value: summaries.length },
    { id: "level", label: "Level", value: summaries.level },
    { id: "grid", label: "Grid", value: summaries.grid },
    { id: "style", label: "Style", value: summaries.style },
    { id: "starting", label: "Starting conditions", value: summaries.starting },
    ...(fuseState.mode === "symmetry"
      ? [{ id: "pairing", label: "Pairing", value: summaries.pairing }]
      : []),
  ]);

  function selectDestination(id: string | null): void {
    destination = id !== null && isFuseRecipeDestination(id) ? id : null;
  }
</script>

<!-- The six focused recipe editors, identical whether they arrive as a drawer
     over the workspace or as the workspace's own left column. -->
<GenerationSettingsOverlay
  title="Fuse recipe"
  titleId="fuse-settings-title"
  closeLabel="Close Fuse recipe settings"
  {onClose}
>
  {#snippet children()}
    <SettingsDrillPanel
      items={drillItems}
      bind:selected={destination}
      onSelect={selectDestination}
    >
      {#snippet detail(id)}
        {#if isFuseRecipeDestination(id)}
          <FuseRecipeSettingContent
            destination={id}
            presentation="drawer"
            onCancel={() => (destination = null)}
            onApply={onClose}
          />
        {/if}
      {/snippet}
    </SettingsDrillPanel>
  {/snippet}
</GenerationSettingsOverlay>
