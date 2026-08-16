<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import ChoiceCard from "$lib/features/create/generate/components/cards/ChoiceCard.svelte";
  import StyleExpandPanel from "$lib/features/create/generate/components/StyleExpandPanel.svelte";
  import { startOrientationsForLevel } from "$lib/features/create/generate/domain/level-orientation-policy";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    Orientation,
    type Orientation as OrientationValue,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_STYLE_BASELINE } from "../domain/fuse-recipe-summaries";
  import type { SoloLoopTraversalDirection } from "../services/solo-loop-generator";

  type RecipeSection = "style" | "starting";
  type LocationChoice = "random" | GridLocation;
  type OrientationChoice = "random" | OrientationValue;
  type TraversalChoice = "random" | SoloLoopTraversalDirection;

  let {
    section,
    presentation = "drawer",
  }: {
    section: RecipeSection;
    presentation?: "drawer" | "modal" | "popover";
  } = $props();
  const { state: fuseState } = getFuseContext();

  const diamondLocationOptions = [
    { value: "random", label: "Random" },
    { value: GridLocation.NORTH, label: "North", shortLabel: "N" },
    { value: GridLocation.EAST, label: "East", shortLabel: "E" },
    { value: GridLocation.SOUTH, label: "South", shortLabel: "S" },
    { value: GridLocation.WEST, label: "West", shortLabel: "W" },
  ] as const;
  const boxLocationOptions = [
    { value: "random", label: "Random" },
    { value: GridLocation.NORTHEAST, label: "Northeast", shortLabel: "NE" },
    { value: GridLocation.SOUTHEAST, label: "Southeast", shortLabel: "SE" },
    { value: GridLocation.SOUTHWEST, label: "Southwest", shortLabel: "SW" },
    { value: GridLocation.NORTHWEST, label: "Northwest", shortLabel: "NW" },
  ] as const;
  const orientationCatalog = [
    { value: Orientation.IN, label: "In" },
    { value: Orientation.OUT, label: "Out" },
    { value: Orientation.CLOCK, label: "Clock" },
    {
      value: Orientation.COUNTER,
      label: "Counter",
    },
  ] as const;
  const traversalOptions = [
    { value: "random", label: "Random" },
    { value: "clockwise", label: "Clockwise", shortLabel: "CW" },
    {
      value: "counterclockwise",
      label: "Counterclockwise",
      shortLabel: "CCW",
    },
  ] as const;

  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );
  const cardHeaderSize = $derived(
    presentation === "modal"
      ? "var(--recipe-detail-title-size)"
      : "var(--font-size-compact, 0.75rem)"
  );
  const locationChoice = $derived<LocationChoice>(
    fuseState.startLocation ?? "random"
  );
  const orientationChoice = $derived<OrientationChoice>(
    fuseState.startOrientation ?? "random"
  );
  const traversalChoice = $derived<TraversalChoice>(
    fuseState.traversalDirection ?? "random"
  );
  const locationOptions = $derived(
    fuseState.gridMode === GridMode.BOX
      ? boxLocationOptions
      : diamondLocationOptions
  );
  const orientationOptions = $derived([
    { value: "random" as const, label: "Random" },
    ...orientationCatalog.filter((option) =>
      startOrientationsForLevel(fuseState.generationLevel).includes(
        option.value
      )
    ),
  ]);
  const cardColors = $derived(
    getCardColors(
      settingsService.settings.backgroundType ?? BackgroundType.WINTER
    )
  );
  function selectLocation(value: LocationChoice): void {
    fuseState.setStartLocation(value === "random" ? null : value);
  }

  function selectOrientation(value: OrientationChoice): void {
    fuseState.setStartOrientation(value === "random" ? null : value);
  }

  function selectTraversal(value: TraversalChoice): void {
    fuseState.setTraversalDirection(value === "random" ? null : value);
  }
</script>

{#if section === "style"}
  <div
    class="drill-fill detail-stack"
    class:modal-detail={presentation === "modal"}
    class:popover-detail={presentation === "popover"}
  >
    <StyleExpandPanel
      constraintPreset={fuseState.constraintPreset}
      handPathMode={fuseState.handPathMode}
      motionTypeFilter={fuseState.motionTypeFilter}
      baseline={FUSE_STYLE_BASELINE}
      haptic={null}
      onPropsChange={fuseState.setConstraintPreset}
      onHandsChange={fuseState.setHandPathMode}
      onDashesChange={(value) =>
        fuseState.setMotionTypeFilter(value === "mixed" ? null : value)}
    />
  </div>
{:else}
  <div
    class="drill-fill recipe-stage"
    class:modal-detail={presentation === "modal"}
    class:popover-detail={presentation === "popover"}
  >
    <div class="recipe-grid starting-grid">
      <div class="card-wrapper">
        <ChoiceCard
          title="Start point"
          currentValue={locationOptions.find(
            (option) => option.value === locationChoice
          )?.label ?? "Random"}
          options={locationOptions.map((option) => ({
            ...option,
            disabled,
          }))}
          value={locationChoice}
          onchange={selectLocation}
          color={cardColors.startEnd.color}
          shadowColor={cardColors.startEnd.shadowColor}
          ariaLabel="Generated LOOP start point"
          gridColumnSpan={6}
          headerFontSize={cardHeaderSize}
        />
      </div>
      <div class="card-wrapper">
        <ChoiceCard
          title="Prop orientation"
          currentValue={orientationOptions.find(
            (option) => option.value === orientationChoice
          )?.label ?? "Random"}
          options={orientationOptions.map((option) => ({
            ...option,
            disabled,
          }))}
          value={orientationChoice}
          onchange={selectOrientation}
          color={cardColors.continuity.color}
          shadowColor={cardColors.continuity.shadowColor}
          ariaLabel="Generated LOOP start orientation"
          gridColumnSpan={6}
          headerFontSize={cardHeaderSize}
        />
      </div>
      <div class="card-wrapper">
        <ChoiceCard
          title="Travel"
          currentValue={traversalOptions.find(
            (option) => option.value === traversalChoice
          )?.label ?? "Random"}
          options={traversalOptions.map((option) => ({
            ...option,
            disabled,
          }))}
          value={traversalChoice}
          onchange={selectTraversal}
          color={cardColors.mode.color}
          shadowColor={cardColors.mode.shadowColor}
          ariaLabel="Generated LOOP traversal direction"
          gridColumnSpan={6}
          headerFontSize={cardHeaderSize}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .recipe-stage {
    --card-text-size: clamp(1.45rem, 4cqh, 2.35rem);
    --card-text-weight: 750;
    --card-text-spacing: 0.02em;
    --card-text-shadow: 0 2px 6px var(--theme-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: clamp(0.5rem, 2.5cqh, 2rem) 0;
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: clamp(0.55rem, 1.5cqh, 0.9rem);
    width: 100%;
    min-height: min(34rem, 64cqh);
    max-height: 48rem;
  }

  .starting-grid {
    grid-template-rows: repeat(3, minmax(10rem, 1fr));
  }

  .card-wrapper {
    container: generate-card / size;
    display: flex;
    grid-column: span 6;
    min-width: 0;
    min-height: 0;
  }

  .card-wrapper > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .detail-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  .detail-stack :global(.style-panel) {
    flex: 0 0 auto;
    justify-content: flex-start;
  }

  .detail-stack.modal-detail {
    justify-content: center;
    width: min(100%, 72rem);
    margin-inline: auto;
    padding: clamp(1rem, 4cqh, 3rem);
  }

  .recipe-stage.modal-detail {
    --recipe-detail-title-size: clamp(1rem, 4.5cqh, 1.25rem);
    --card-text-size: clamp(1.75rem, 7cqh, 3rem);
    align-items: center;
    padding: clamp(0.75rem, 2cqh, 1.5rem) 0;
  }

  .modal-detail :global(.choice-control .segment) {
    font-size: clamp(1rem, 2.5cqh, 1.25rem);
  }

  .modal-detail .recipe-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: minmax(18rem, 1fr);
    min-height: 0;
    max-height: 40rem;
    height: min(100%, 40rem);
  }

  .modal-detail .card-wrapper {
    grid-column: span 2;
  }

  .detail-stack.popover-detail {
    width: 100%;
    padding: 0.25rem;
  }

  .recipe-stage.popover-detail {
    --recipe-detail-title-size: var(--font-size-min, 14px);
    --card-text-size: clamp(1.35rem, 4cqh, 2rem);
    align-items: stretch;
    padding: 0;
  }

  .popover-detail :global(.choice-control .segment) {
    font-size: var(--font-size-compact, 12px);
  }

  .popover-detail .recipe-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: minmax(12rem, 15rem);
    min-height: 0;
    max-height: none;
  }

  .popover-detail .card-wrapper {
    grid-column: span 1;
  }

  @media (max-width: 560px) {
    .recipe-stage {
      align-items: flex-start;
      padding: 0.25rem 0 0.75rem;
    }

    .recipe-grid {
      min-height: auto;
      max-height: none;
      gap: 0.6rem;
    }

    .starting-grid {
      grid-template-rows: repeat(3, 9.5rem);
    }
  }

  @media (min-width: 561px) and (min-height: 1200px) {
    .recipe-grid {
      min-height: min(64rem, 68cqh);
      max-height: 72rem;
    }
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .recipe-stage.popover-detail {
      --recipe-detail-title-size: 1rem;
      --card-text-size: 2.25rem;
    }

    .popover-detail .recipe-grid {
      grid-template-rows: minmax(15rem, 18rem);
    }
  }
</style>
