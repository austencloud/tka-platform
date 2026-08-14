<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import ChoiceCard from "$lib/features/create/generate/components/cards/ChoiceCard.svelte";
  import LevelCard from "$lib/features/create/generate/components/cards/LevelCard.svelte";
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
  import StyleExpandPanel from "$lib/features/create/generate/components/StyleExpandPanel.svelte";
  import { startOrientationsForLevel } from "$lib/features/create/generate/domain/level-orientation-policy";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import {
    maxTurnIntensitiesForLevel,
    type TurnLevel,
  } from "$lib/shared/create/services/level-turn-values";
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    Orientation,
    type Orientation as OrientationValue,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import type { SoloLoopTraversalDirection } from "../services/solo-loop-generator";
  import { FUSE_LENGTHS } from "../state/fuse-state.svelte";

  type RecipeSection = "basics" | "style" | "starting";
  type LocationChoice = "random" | GridLocation;
  type OrientationChoice = "random" | OrientationValue;
  type TraversalChoice = "random" | SoloLoopTraversalDirection;

  let { section }: { section: RecipeSection } = $props();
  const { state: fuseState } = getFuseContext();

  const styleBaseline = {
    constraintPreset: "mixed",
    handPathMode: "mixed",
    motionTypeFilter: null,
  } as const;
  const locationOptions = [
    { value: "random", label: "Random" },
    { value: GridLocation.NORTH, label: "North", shortLabel: "N" },
    { value: GridLocation.EAST, label: "East", shortLabel: "E" },
    { value: GridLocation.SOUTH, label: "South", shortLabel: "S" },
    { value: GridLocation.WEST, label: "West", shortLabel: "W" },
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

  const levelMap: Record<TurnLevel, DifficultyLevel> = {
    1: DifficultyLevel.BEGINNER,
    2: DifficultyLevel.INTERMEDIATE,
    3: DifficultyLevel.ADVANCED,
  };
  const reverseLevelMap: Record<DifficultyLevel, TurnLevel> = {
    [DifficultyLevel.BEGINNER]: 1,
    [DifficultyLevel.INTERMEDIATE]: 2,
    [DifficultyLevel.ADVANCED]: 3,
    [DifficultyLevel.SKEWED]: 3,
  };

  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
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
  const lengthIndex = $derived(FUSE_LENGTHS.indexOf(fuseState.requestedLength));
  const allowedTurnIntensities = $derived(
    fuseState.generationLevel === 1
      ? [0]
      : [...maxTurnIntensitiesForLevel(fuseState.generationLevel)]
  );
  const displayedTurnIntensity = $derived(
    fuseState.generationLevel === 1 ? 0 : fuseState.maxTurnIntensity
  );

  function changeLength(offset: -1 | 1): void {
    if (disabled) return;
    const nextIndex = Math.max(
      0,
      Math.min(FUSE_LENGTHS.length - 1, lengthIndex + offset)
    );
    const nextLength = FUSE_LENGTHS[nextIndex];
    if (nextLength !== undefined) void fuseState.setLength(nextLength);
  }

  function selectLevel(level: DifficultyLevel): void {
    if (disabled) return;
    fuseState.setGenerationLevel(reverseLevelMap[level]);
  }

  function selectTurnIntensity(value: number): void {
    if (disabled || fuseState.generationLevel === 1) return;
    fuseState.setMaxTurnIntensity(value);
  }

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

{#if section === "basics"}
  <div class="drill-fill recipe-stage">
    <div class="recipe-grid basics-grid">
      <div class="card-wrapper length-card">
        <StepperCard
          title="Length"
          currentValue={fuseState.requestedLength}
          minValue={FUSE_LENGTHS[0]}
          maxValue={FUSE_LENGTHS[FUSE_LENGTHS.length - 1]}
          onIncrement={() => changeLength(1)}
          onDecrement={() => changeLength(-1)}
          formatValue={(value) => String(value)}
          subtitle="steps"
          color={cardColors.length.color}
          shadowColor={cardColors.length.shadowColor}
          gridColumnSpan={6}
        />
      </div>
      <div class="card-wrapper">
        <LevelCard
          currentLevel={levelMap[fuseState.generationLevel]}
          onLevelChange={selectLevel}
          gridColumnSpan={3}
        />
      </div>
      <div class="card-wrapper">
        {#if fuseState.generationLevel === 1}
          <StepperCard
            title="Max turns"
            currentValue={0}
            minValue={0}
            maxValue={0}
            onIncrement={() => undefined}
            onDecrement={() => undefined}
            formatValue={() => "0"}
            description="No turns at Level 1"
            color={cardColors.turnIntensity.color}
            shadowColor={cardColors.turnIntensity.shadowColor}
            gridColumnSpan={3}
          />
        {:else}
          <TurnIntensityCard
            currentIntensity={displayedTurnIntensity}
            allowedValues={allowedTurnIntensities}
            onIntensityChange={selectTurnIntensity}
            gridColumnSpan={3}
          />
        {/if}
      </div>
    </div>
  </div>
{:else if section === "style"}
  <div class="drill-fill detail-stack">
    <StyleExpandPanel
      constraintPreset={fuseState.constraintPreset}
      handPathMode={fuseState.handPathMode}
      motionTypeFilter={fuseState.motionTypeFilter}
      baseline={styleBaseline}
      haptic={null}
      onPropsChange={fuseState.setConstraintPreset}
      onHandsChange={fuseState.setHandPathMode}
      onDashesChange={(value) =>
        fuseState.setMotionTypeFilter(value === "mixed" ? null : value)}
    />
  </div>
{:else}
  <div class="drill-fill recipe-stage">
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

  .basics-grid {
    grid-template-rows: minmax(12rem, 1.15fr) minmax(13rem, 1fr);
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

  .basics-grid .card-wrapper:not(.length-card) {
    grid-column: span 3;
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

    .basics-grid {
      grid-template-rows: 9rem 10rem 10rem;
    }

    .basics-grid .card-wrapper:not(.length-card) {
      grid-column: span 6;
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
</style>
