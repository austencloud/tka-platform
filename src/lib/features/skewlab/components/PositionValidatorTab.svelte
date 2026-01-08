<script lang="ts">
  /**
   * Position Validator Tab
   *
   * Renders all Zeta and Eta positions as static Type 6 pictographs
   * using the user's prop preferences on a skewed grid to validate rendering.
   */

  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import {
    GridLocation,
    GridMode,
    GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionType,
    RotationDirection,
    Orientation,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

  // State
  let pictographSize = $state(200);
  let selectedGroup = $state<"all" | "zeta" | "eta">("all");
  let settingsService: ISettingsState | null = $state(null);

  // Get user's prop types from settings
  const bluePropType = $derived.by(() => {
    if (!settingsService) return PropType.HAND;
    return (
      settingsService.settings.bluePropType ??
      settingsService.settings.propType ??
      PropType.HAND
    ) as PropType;
  });

  const redPropType = $derived.by(() => {
    if (!settingsService) return PropType.HAND;
    return (
      settingsService.settings.redPropType ??
      settingsService.settings.propType ??
      PropType.HAND
    ) as PropType;
  });

  onMount(() => {
    settingsService = resolve<ISettingsState>(TYPES.ISettingsState);
  });

  // Position to hand location mapping (from GridPositionDeriver)
  const POSITION_LOCATIONS: Record<GridPosition, [GridLocation, GridLocation]> = {
    // Zeta positions - 135° obtuse angle (skewed mode)
    [GridPosition.ZETA1]: [GridLocation.SOUTHWEST, GridLocation.NORTH],
    [GridPosition.ZETA2]: [GridLocation.WEST, GridLocation.NORTHEAST],
    [GridPosition.ZETA3]: [GridLocation.NORTHWEST, GridLocation.EAST],
    [GridPosition.ZETA4]: [GridLocation.NORTH, GridLocation.SOUTHEAST],
    [GridPosition.ZETA5]: [GridLocation.NORTHEAST, GridLocation.SOUTH],
    [GridPosition.ZETA6]: [GridLocation.EAST, GridLocation.SOUTHWEST],
    [GridPosition.ZETA7]: [GridLocation.SOUTHEAST, GridLocation.WEST],
    [GridPosition.ZETA8]: [GridLocation.SOUTH, GridLocation.NORTHWEST],
    [GridPosition.ZETA9]: [GridLocation.SOUTHEAST, GridLocation.NORTH],
    [GridPosition.ZETA10]: [GridLocation.SOUTH, GridLocation.NORTHEAST],
    [GridPosition.ZETA11]: [GridLocation.SOUTHWEST, GridLocation.EAST],
    [GridPosition.ZETA12]: [GridLocation.WEST, GridLocation.SOUTHEAST],
    [GridPosition.ZETA13]: [GridLocation.NORTHWEST, GridLocation.SOUTH],
    [GridPosition.ZETA14]: [GridLocation.NORTH, GridLocation.SOUTHWEST],
    [GridPosition.ZETA15]: [GridLocation.NORTHEAST, GridLocation.WEST],
    [GridPosition.ZETA16]: [GridLocation.EAST, GridLocation.NORTHWEST],

    // Eta positions - 45° acute angle (skewed mode)
    [GridPosition.ETA1]: [GridLocation.NORTHWEST, GridLocation.NORTH],
    [GridPosition.ETA2]: [GridLocation.NORTH, GridLocation.NORTHEAST],
    [GridPosition.ETA3]: [GridLocation.NORTHEAST, GridLocation.EAST],
    [GridPosition.ETA4]: [GridLocation.EAST, GridLocation.SOUTHEAST],
    [GridPosition.ETA5]: [GridLocation.SOUTHEAST, GridLocation.SOUTH],
    [GridPosition.ETA6]: [GridLocation.SOUTH, GridLocation.SOUTHWEST],
    [GridPosition.ETA7]: [GridLocation.SOUTHWEST, GridLocation.WEST],
    [GridPosition.ETA8]: [GridLocation.WEST, GridLocation.NORTHWEST],
    [GridPosition.ETA9]: [GridLocation.NORTHEAST, GridLocation.NORTH],
    [GridPosition.ETA10]: [GridLocation.EAST, GridLocation.NORTHEAST],
    [GridPosition.ETA11]: [GridLocation.SOUTHEAST, GridLocation.EAST],
    [GridPosition.ETA12]: [GridLocation.SOUTH, GridLocation.SOUTHEAST],
    [GridPosition.ETA13]: [GridLocation.SOUTHWEST, GridLocation.SOUTH],
    [GridPosition.ETA14]: [GridLocation.WEST, GridLocation.SOUTHWEST],
    [GridPosition.ETA15]: [GridLocation.NORTHWEST, GridLocation.WEST],
    [GridPosition.ETA16]: [GridLocation.NORTH, GridLocation.NORTHWEST],
  };

  // All Zeta/Eta positions
  const ZETA_POSITIONS = [
    GridPosition.ZETA1, GridPosition.ZETA2, GridPosition.ZETA3, GridPosition.ZETA4,
    GridPosition.ZETA5, GridPosition.ZETA6, GridPosition.ZETA7, GridPosition.ZETA8,
    GridPosition.ZETA9, GridPosition.ZETA10, GridPosition.ZETA11, GridPosition.ZETA12,
    GridPosition.ZETA13, GridPosition.ZETA14, GridPosition.ZETA15, GridPosition.ZETA16,
  ];

  const ETA_POSITIONS = [
    GridPosition.ETA1, GridPosition.ETA2, GridPosition.ETA3, GridPosition.ETA4,
    GridPosition.ETA5, GridPosition.ETA6, GridPosition.ETA7, GridPosition.ETA8,
    GridPosition.ETA9, GridPosition.ETA10, GridPosition.ETA11, GridPosition.ETA12,
    GridPosition.ETA13, GridPosition.ETA14, GridPosition.ETA15, GridPosition.ETA16,
  ];

  // Filtered positions based on selection
  const displayPositions = $derived.by(() => {
    if (selectedGroup === "zeta") return ZETA_POSITIONS;
    if (selectedGroup === "eta") return ETA_POSITIONS;
    return [...ZETA_POSITIONS, ...ETA_POSITIONS];
  });

  // Create static pictograph data for a position using user's prop preferences
  function createStaticPictograph(position: GridPosition): PictographData {
    const [blueLocation, redLocation] = POSITION_LOCATIONS[position];
    const gridMode = GridMode.SKEWED;

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: bluePropType,
      arrowLocation: blueLocation,
      gridMode,
    });

    const redMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redLocation,
      endLocation: redLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLocation,
      gridMode,
    });

    return {
      id: `validator-${position}`,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  // Format position name for display
  function formatPosition(pos: GridPosition): string {
    return pos.replace(/(\d+)/, " $1").toUpperCase();
  }

  // Get angle description
  function getAngleDesc(pos: GridPosition): string {
    if (pos.startsWith("zeta")) return "135°";
    if (pos.startsWith("eta")) return "45°";
    return "";
  }
</script>

<div class="validator-tab">
  <header class="tab-header">
    <div class="title-area">
      <h1>
        <i class="fas fa-check-double" aria-hidden="true"></i>
        Position Validator
      </h1>
      <p class="subtitle">
        Static Type 6 pictographs with hands on skewed grid
      </p>
    </div>

    <div class="controls">
      <div class="filter-group">
        <label>Show:</label>
        <select bind:value={selectedGroup}>
          <option value="all">All ({ZETA_POSITIONS.length + ETA_POSITIONS.length})</option>
          <option value="zeta">Zeta only ({ZETA_POSITIONS.length})</option>
          <option value="eta">Eta only ({ETA_POSITIONS.length})</option>
        </select>
      </div>

      <div class="size-control">
        <label>Size:</label>
        <input
          type="range"
          min="120"
          max="300"
          bind:value={pictographSize}
        />
        <span class="size-value">{pictographSize}px</span>
      </div>
    </div>
  </header>

  <div class="position-grid">
    {#each displayPositions as position (position)}
      {@const pictograph = createStaticPictograph(position)}
      {@const [blueLoc, redLoc] = POSITION_LOCATIONS[position]}
      <div class="position-card">
        <div class="pictograph-wrapper" style="--size: {pictographSize}px">
          <PictographContainer
            pictographData={pictograph}
            size={pictographSize}
            gridMode={GridMode.SKEWED}
          />
        </div>
        <div class="position-label">
          <span class="name">{formatPosition(position)}</span>
          <span class="angle">{getAngleDesc(position)}</span>
          <span class="locations">
            <span class="blue">L: {blueLoc.toUpperCase()}</span>
            <span class="red">R: {redLoc.toUpperCase()}</span>
          </span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .validator-tab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 1rem;
    gap: 1rem;
  }

  .tab-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title-area h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--theme-text, #fff);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-area h1 i {
    color: #8b5cf6;
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
  }

  .controls {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-group,
  .size-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group label,
  .size-control label {
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
  }

  select {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: var(--theme-text, #fff);
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-min, 14px);
  }

  input[type="range"] {
    width: 100px;
    accent-color: #8b5cf6;
  }

  .size-value {
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-compact, 12px);
    min-width: 45px;
  }

  .position-grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    padding: 0.5rem;
  }

  .position-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: border-color 0.2s;
  }

  .position-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .pictograph-wrapper {
    width: var(--size);
    height: var(--size);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .position-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    text-align: center;
  }

  .position-label .name {
    font-weight: 600;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  .position-label .angle {
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-compact, 12px);
  }

  .position-label .locations {
    display: flex;
    gap: 0.75rem;
    font-size: var(--font-size-compact, 12px);
    font-family: monospace;
  }

  .position-label .blue {
    color: #60a5fa;
  }

  .position-label .red {
    color: #f87171;
  }
</style>
