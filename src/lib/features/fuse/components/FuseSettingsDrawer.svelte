<script lang="ts">
  import GenerationSettingsOverlay from "$lib/features/create/generate/components/cards/GenerationSettingsOverlay.svelte";
  import GenerationSettingsDrawer from "$lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte";
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
    isOpen = $bindable(false),
    destination = $bindable(null),
  }: {
    isOpen: boolean;
    destination?: FuseSettingsDestination;
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
  const drillItems = $derived<SettingsDrillItem[]>([
    { id: "length", label: "Length", value: summaries.length },
    { id: "level", label: "Level", value: summaries.level },
    { id: "grid", label: "Grid", value: summaries.grid },
    { id: "style", label: "Style", value: summaries.style },
    {
      id: "starting",
      label: "Starting conditions",
      value: summaries.starting,
    },
    { id: "pairing", label: "Pairing", value: summaries.pairing },
  ]);

  function closeDrawer(): void {
    isOpen = false;
    destination = null;
  }

  function selectDestination(id: string | null): void {
    destination = id !== null && isFuseRecipeDestination(id) ? id : null;
  }
</script>

<!-- The compact entry point exposes the same six focused recipe editors as the desktop rail. -->
<GenerationSettingsDrawer
  {isOpen}
  ariaLabel="Fuse recipe settings"
  onClose={closeDrawer}
>
  {#snippet children()}
    <GenerationSettingsOverlay
      title="Fuse recipe"
      titleId="fuse-settings-title"
      closeLabel="Close Fuse recipe settings"
      onClose={closeDrawer}
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
                onApply={closeDrawer}
              />
            {/if}
          {/snippet}
        </SettingsDrillPanel>
      {/snippet}
    </GenerationSettingsOverlay>
  {/snippet}
</GenerationSettingsDrawer>
