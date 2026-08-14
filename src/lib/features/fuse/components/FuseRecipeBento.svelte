<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import GridModeCard from "$lib/features/create/generate/components/cards/GridModeCard.svelte";
  import LevelCard from "$lib/features/create/generate/components/cards/LevelCard.svelte";
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
  import {
    buildCustomizeSummary,
    ORIENTATION_SHORT,
  } from "$lib/features/create/generate/components/cards/customize-summary";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import {
    maxTurnIntensitiesForLevel,
    type TurnLevel,
  } from "$lib/shared/create/services/level-turn-values";
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_LENGTHS, FUSE_TRANSFORMS } from "../state/fuse-state.svelte";

  type DetailDestination = "style" | "starting" | "pairing";

  let {
    onOpen,
    presentation = "drawer",
  }: {
    onOpen: (destination: DetailDestination) => void;
    presentation?: "drawer" | "modal";
  } = $props();

  const { state: fuseState } = getFuseContext();
  const styleBaseline = {
    constraintPreset: "mixed",
    handPathMode: "mixed",
    motionTypeFilter: null,
  } as const;
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
  const locationLabels: Partial<Record<GridLocation, string>> = {
    [GridLocation.NORTH]: "North",
    [GridLocation.EAST]: "East",
    [GridLocation.SOUTH]: "South",
    [GridLocation.WEST]: "West",
    [GridLocation.NORTHEAST]: "Northeast",
    [GridLocation.SOUTHEAST]: "Southeast",
    [GridLocation.SOUTHWEST]: "Southwest",
    [GridLocation.NORTHWEST]: "Northwest",
  };

  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );
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
  const cardHeaderSize = $derived(
    presentation === "modal"
      ? "var(--recipe-card-title-size)"
      : "var(--font-size-compact, 0.75rem)"
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
        ? "CW"
        : "CCW"
      : "Random";
    return `${location} · ${orientation} · ${travel}`;
  });
  const pairingSummary = $derived.by(() => {
    if (fuseState.mode === "shuffle") return "Edit both paths separately";
    const driver = fuseState.driverSide === "blue" ? "Blue" : "Red";
    const follower = fuseState.driverSide === "blue" ? "Red" : "Blue";
    const transform =
      FUSE_TRANSFORMS.find((item) => item.id === fuseState.transformId)
        ?.label ?? "Mirror";
    return `${driver} → ${transform} → ${follower}`;
  });

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

  function selectGridMode(value: GridMode): void {
    if (disabled) return;
    fuseState.setGridMode(value);
  }
</script>

<div
  class="drill-fill recipe-dashboard"
  class:modal-dashboard={presentation === "modal"}
>
  <div
    class="recipe-grid"
    class:modal-grid={presentation === "modal"}
    class:level-one={fuseState.generationLevel === 1}
    class:turns-visible={fuseState.generationLevel > 1}
  >
    <div class="card-wrapper" data-card="length">
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
        gridColumnSpan={3}
        headerFontSize={cardHeaderSize}
      />
    </div>

    <div class="card-wrapper" data-card="level">
      <LevelCard
        currentLevel={levelMap[fuseState.generationLevel]}
        onLevelChange={selectLevel}
        gridColumnSpan={3}
        headerFontSize={cardHeaderSize}
      />
    </div>

    {#if fuseState.generationLevel > 1}
      <div class="card-wrapper" data-card="turns">
        <TurnIntensityCard
          currentIntensity={displayedTurnIntensity}
          allowedValues={allowedTurnIntensities}
          onIntensityChange={selectTurnIntensity}
          gridColumnSpan={3}
          headerFontSize={cardHeaderSize}
        />
      </div>
    {/if}

    <div class="card-wrapper" data-card="grid">
      <GridModeCard
        currentMode={fuseState.gridMode}
        onModeChange={selectGridMode}
        color={cardColors.gridMode.color}
        shadowColor={cardColors.gridMode.shadowColor}
        gridColumnSpan={3}
        headerFontSize={cardHeaderSize}
      />
    </div>

    <div class="card-wrapper" data-card="style">
      <BaseCard
        title="Style"
        currentValue={styleSummary}
        color={cardColors.customize.color}
        shadowColor={cardColors.customize.shadowColor}
        ariaLabel={`Style: ${styleSummary}. Open style settings.`}
        onClick={() => onOpen("style")}
        headerFontSize={cardHeaderSize}
      />
    </div>

    <div class="card-wrapper" data-card="starting">
      <BaseCard
        title="Starting conditions"
        currentValue={startingSummary}
        color={cardColors.startEnd.color}
        shadowColor={cardColors.startEnd.shadowColor}
        ariaLabel={`Starting conditions: ${startingSummary}. Open starting condition settings.`}
        onClick={() => onOpen("starting")}
        headerFontSize={cardHeaderSize}
      />
    </div>

    <div class="card-wrapper" data-card="pairing">
      <BaseCard
        title="Pairing"
        currentValue={pairingSummary}
        color={cardColors.mode.color}
        shadowColor={cardColors.mode.shadowColor}
        ariaLabel={`Pairing: ${pairingSummary}. Open pairing settings.`}
        onClick={() => onOpen("pairing")}
        headerFontSize={cardHeaderSize}
      />
    </div>
  </div>
</div>

<style>
  .recipe-dashboard {
    --card-text-size: clamp(1rem, 2.25cqh, 1.65rem);
    --card-text-weight: 750;
    --card-text-spacing: 0.02em;
    --card-text-shadow: 0 2px 6px var(--theme-shadow);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
    padding: clamp(0.75rem, 4cqh, 4rem) 0 clamp(1rem, 3cqh, 3rem);
  }

  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: repeat(4, minmax(10rem, 1fr));
    gap: clamp(0.55rem, 1.25cqh, 0.85rem);
    width: 100%;
    min-height: min(52rem, 72vh);
    max-height: 68rem;
  }

  .card-wrapper {
    container: generate-card / size;
    display: flex;
    grid-column: span 3;
    min-width: 0;
    min-height: 0;
  }

  .card-wrapper[data-card="pairing"] {
    grid-column: span 6;
  }

  .recipe-grid.level-one:not(.modal-grid) {
    grid-template-rows: repeat(3, minmax(10rem, 1fr));
  }

  .recipe-grid.level-one:not(.modal-grid) .card-wrapper[data-card="pairing"] {
    grid-column: span 3;
  }

  .recipe-grid.modal-grid {
    --recipe-card-title-size: clamp(1rem, 4.5cqh, 1.25rem);
    --card-text-size: clamp(1.75rem, 7cqh, 2.75rem);
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(2, clamp(14rem, 40cqh, 18rem));
    align-self: center;
    min-height: 0;
    max-height: none;
    height: auto;
  }

  .recipe-dashboard.modal-dashboard {
    container: fuse-recipe-dashboard / size;
    align-items: center;
    padding: clamp(0.75rem, 2cqh, 1.25rem) 0;
  }

  .modal-grid .card-wrapper {
    grid-column: span 4;
  }

  .modal-grid.turns-visible .card-wrapper[data-card="length"],
  .modal-grid.turns-visible .card-wrapper[data-card="level"],
  .modal-grid.turns-visible .card-wrapper[data-card="turns"],
  .modal-grid.turns-visible .card-wrapper[data-card="grid"] {
    grid-column: span 3;
  }

  .modal-grid .card-wrapper[data-card="pairing"] {
    grid-column: span 4;
  }

  .modal-grid .card-wrapper :global(.card-description),
  .modal-grid .card-wrapper :global(.card-subtitle) {
    font-size: clamp(0.875rem, 3.5cqh, 1.125rem);
  }

  .card-wrapper[data-card="style"] :global(.card-value),
  .card-wrapper[data-card="starting"] :global(.card-value),
  .card-wrapper[data-card="pairing"] :global(.card-value) {
    width: calc(100% - 1rem);
    padding-inline: 0.5rem;
    overflow: visible;
    white-space: normal;
    overflow-wrap: anywhere;
    text-overflow: clip;
    text-wrap: balance;
  }

  .card-wrapper > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  @media (max-width: 560px) {
    .recipe-dashboard {
      align-items: flex-start;
      padding: 0.15rem 0 0.75rem;
    }

    .recipe-grid {
      grid-template-rows: repeat(4, 9rem);
      gap: 0.6rem;
      min-height: auto;
      max-height: none;
    }

    .recipe-grid.level-one {
      grid-template-rows: repeat(3, 9rem);
    }
  }

  @media (min-width: 561px) and (min-height: 1400px) {
    .recipe-grid {
      min-height: min(68rem, 60vh);
    }
  }
</style>
