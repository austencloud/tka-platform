<script module lang="ts">
  export type FuseSettingsDestination =
    | "basics"
    | "style"
    | "starting"
    | "pairing"
    | null;
</script>

<script lang="ts">
  import GenerationSettingsOverlay from "$lib/features/create/generate/components/cards/GenerationSettingsOverlay.svelte";
  import {
    buildCustomizeSummary,
    ORIENTATION_SHORT,
  } from "$lib/features/create/generate/components/cards/customize-summary";
  import GenerationSettingsDrawer from "$lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte";
  import SettingsDrillPanel, {
    type SettingsDrillItem,
  } from "$lib/shared/ui/components/settings-drill/SettingsDrillPanel.svelte";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_TRANSFORMS } from "../state/fuse-state.svelte";
  import FusePathRecipePanel from "./FusePathRecipePanel.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";

  let {
    isOpen = $bindable(false),
    destination = $bindable(null),
  }: {
    isOpen: boolean;
    destination?: FuseSettingsDestination;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const styleBaseline = {
    constraintPreset: "mixed",
    handPathMode: "mixed",
    motionTypeFilter: null,
  } as const;
  const locationLabels: Partial<Record<GridLocation, string>> = {
    [GridLocation.NORTH]: "North",
    [GridLocation.EAST]: "East",
    [GridLocation.SOUTH]: "South",
    [GridLocation.WEST]: "West",
  };

  const basicsSummary = $derived(
    fuseState.generationLevel === 1
      ? `${fuseState.requestedLength} steps · L1 · No turns`
      : `${fuseState.requestedLength} steps · L${fuseState.generationLevel} · ≤${fuseState.maxTurnIntensity}`
  );
  const styleSummary = $derived.by(() => {
    const summary = buildCustomizeSummary(
      {
        constraintPreset: fuseState.constraintPreset,
        handPathMode: fuseState.handPathMode,
        motionTypeFilter: fuseState.motionTypeFilter,
      },
      styleBaseline
    );
    return summary.isDefault ? "Default" : summary.facts.join(" · ");
  });
  const startingSummary = $derived.by(() => {
    const location = fuseState.startLocation
      ? (locationLabels[fuseState.startLocation] ?? fuseState.startLocation)
      : "Random";
    const orientation = fuseState.startOrientation
      ? (ORIENTATION_SHORT[fuseState.startOrientation] ??
        fuseState.startOrientation)
      : "Random";
    const travel = fuseState.traversalDirection
      ? fuseState.traversalDirection === "clockwise"
        ? "Clockwise"
        : "Counterclockwise"
      : "Random";
    return `${location} · ${orientation} · ${travel}`;
  });
  const pairingSummary = $derived.by(() => {
    if (fuseState.mode === "shuffle") return "Separate paths";
    const driver = fuseState.driverSide === "blue" ? "Blue" : "Red";
    const follower = fuseState.driverSide === "blue" ? "Red" : "Blue";
    const transform =
      FUSE_TRANSFORMS.find((item) => item.id === fuseState.transformId)
        ?.label ?? "Mirror";
    return `${driver} → ${transform} → ${follower}`;
  });
  const drillItems = $derived<SettingsDrillItem[]>([
    { id: "basics", label: "Basics", value: basicsSummary },
    { id: "style", label: "Style", value: styleSummary },
    {
      id: "starting",
      label: "Starting conditions",
      value: startingSummary,
    },
    { id: "pairing", label: "Pairing", value: pairingSummary },
  ]);

  function closeDrawer(): void {
    isOpen = false;
    destination = null;
  }

  function selectDestination(id: string | null): void {
    destination = id as FuseSettingsDestination;
  }
</script>

<GenerationSettingsDrawer
  {isOpen}
  ariaLabel="Customize Fuse settings"
  onClose={closeDrawer}
>
  {#snippet children()}
    <GenerationSettingsOverlay
      title="Customize Fuse"
      closeLabel="Close Fuse settings"
      onClose={closeDrawer}
    >
      {#snippet children()}
        <SettingsDrillPanel
          items={drillItems}
          bind:selected={destination}
          onSelect={selectDestination}
        >
          {#snippet listHeader()}
            <p class="overlay-note">
              These settings stick until you change them again.
            </p>
          {/snippet}

          {#snippet detail(id)}
            {#if id === "basics" || id === "style" || id === "starting"}
              <FusePathRecipePanel section={id} />
            {:else if id === "pairing"}
              <FuseRelationshipComposer
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

<style>
  .overlay-note {
    flex-shrink: 0;
    margin: 0 0 8px;
    color: rgba(255, 255, 255, 0.55);
    font-size: var(--font-size-compact, 12px);
  }
</style>
