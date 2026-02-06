<script lang="ts">
  /**
   * Level 5 Lab Module
   *
   * Admin-only experimental sandbox for validating centric position rendering.
   * Renders all 9 Tau/Terra positions as static pictographs.
   * - Tau (8): One hand at center, other at each perimeter location
   * - Terra (1): Both hands at center
   *
   * Note: Pictograph rendering won't be complete without a centric grid SVG
   * and rendering support. This is the scaffold only.
   */

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
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

  // State
  let selectedGroup = $state<"all" | "tau-diamond" | "tau-box" | "terra">("all");
  let blueOrientation = $state<Orientation>(Orientation.CENTER_N);
  let redOrientation = $state<Orientation>(Orientation.IN);

  // Radial orientation options (for perimeter props)
  const RADIAL_ORIENTATIONS = [
    { value: Orientation.IN, label: "In", icon: "fa-compress-arrows-alt" },
    { value: Orientation.OUT, label: "Out", icon: "fa-expand-arrows-alt" },
    { value: Orientation.CLOCK, label: "CW", icon: "fa-rotate-right" },
    { value: Orientation.COUNTER, label: "CCW", icon: "fa-rotate-left" },
  ] as const;

  // Compass orientation options (for center-positioned props)
  const COMPASS_ORIENTATIONS = [
    { value: Orientation.CENTER_N, label: "N", icon: "fa-arrow-up" },
    { value: Orientation.CENTER_NE, label: "NE", icon: "fa-arrow-up", rotation: 45 },
    { value: Orientation.CENTER_E, label: "E", icon: "fa-arrow-right" },
    { value: Orientation.CENTER_SE, label: "SE", icon: "fa-arrow-down", rotation: -45 },
    { value: Orientation.CENTER_S, label: "S", icon: "fa-arrow-down" },
    { value: Orientation.CENTER_SW, label: "SW", icon: "fa-arrow-down", rotation: 45 },
    { value: Orientation.CENTER_W, label: "W", icon: "fa-arrow-left" },
    { value: Orientation.CENTER_NW, label: "NW", icon: "fa-arrow-up", rotation: -45 },
  ] as const;

  // Both colors can be at center across tau groups, so always show compass
  const blueIsAtCenter = true;
  const redIsAtCenter = true;

  // Get user's prop types from reactive settings
  const bluePropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  const redPropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  // Position to hand location mapping for centric mode
  // TAU1-8: Blue at center, red at perimeter
  // TAU9-16: Red at center, blue at perimeter
  // Terra: both at center
  const POSITION_LOCATIONS: Partial<Record<GridPosition, [GridLocation, GridLocation]>> = {
    // Blue at center, red at perimeter
    [GridPosition.TAU1]: [GridLocation.CENTER, GridLocation.NORTH],
    [GridPosition.TAU2]: [GridLocation.CENTER, GridLocation.NORTHEAST],
    [GridPosition.TAU3]: [GridLocation.CENTER, GridLocation.EAST],
    [GridPosition.TAU4]: [GridLocation.CENTER, GridLocation.SOUTHEAST],
    [GridPosition.TAU5]: [GridLocation.CENTER, GridLocation.SOUTH],
    [GridPosition.TAU6]: [GridLocation.CENTER, GridLocation.SOUTHWEST],
    [GridPosition.TAU7]: [GridLocation.CENTER, GridLocation.WEST],
    [GridPosition.TAU8]: [GridLocation.CENTER, GridLocation.NORTHWEST],
    // Red at center, blue at perimeter
    [GridPosition.TAU9]: [GridLocation.NORTH, GridLocation.CENTER],
    [GridPosition.TAU10]: [GridLocation.NORTHEAST, GridLocation.CENTER],
    [GridPosition.TAU11]: [GridLocation.EAST, GridLocation.CENTER],
    [GridPosition.TAU12]: [GridLocation.SOUTHEAST, GridLocation.CENTER],
    [GridPosition.TAU13]: [GridLocation.SOUTH, GridLocation.CENTER],
    [GridPosition.TAU14]: [GridLocation.SOUTHWEST, GridLocation.CENTER],
    [GridPosition.TAU15]: [GridLocation.WEST, GridLocation.CENTER],
    [GridPosition.TAU16]: [GridLocation.NORTHWEST, GridLocation.CENTER],
    // Both at center
    [GridPosition.TERRA1]: [GridLocation.CENTER, GridLocation.CENTER],
  };

  // Diamond Tau: perimeter prop at cardinal point (N/E/S/W)
  const TAU_DIAMOND_POSITIONS = [
    GridPosition.TAU1, GridPosition.TAU3, GridPosition.TAU5, GridPosition.TAU7,
    GridPosition.TAU9, GridPosition.TAU11, GridPosition.TAU13, GridPosition.TAU15,
  ];

  // Box Tau: perimeter prop at intercardinal point (NE/SE/SW/NW)
  const TAU_BOX_POSITIONS = [
    GridPosition.TAU2, GridPosition.TAU4, GridPosition.TAU6, GridPosition.TAU8,
    GridPosition.TAU10, GridPosition.TAU12, GridPosition.TAU14, GridPosition.TAU16,
  ];

  const TERRA_POSITIONS = [
    GridPosition.TERRA1,
  ];

  const CARDINAL_LOCATIONS = new Set([
    GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST,
  ]);

  /** Determine grid mode from the perimeter prop's location */
  function getGridModeForPosition(position: GridPosition): GridMode {
    const locations = POSITION_LOCATIONS[position];
    if (!locations) return GridMode.DIAMOND;
    const [blueLoc, redLoc] = locations;
    // Find the perimeter location (whichever isn't CENTER)
    const perimeterLoc = blueLoc === GridLocation.CENTER ? redLoc : blueLoc;
    // Both at center (Terra) - doesn't matter, use diamond as default
    if (perimeterLoc === GridLocation.CENTER) return GridMode.DIAMOND;
    return CARDINAL_LOCATIONS.has(perimeterLoc) ? GridMode.DIAMOND : GridMode.BOX;
  }

  interface PositionSection {
    label: string;
    gridMode: GridMode;
    positions: GridPosition[];
  }

  const displaySections = $derived.by((): PositionSection[] => {
    const sections: PositionSection[] = [];

    if (selectedGroup === "all" || selectedGroup === "tau-diamond") {
      sections.push({
        label: "Tau Diamond",
        gridMode: GridMode.DIAMOND,
        positions: TAU_DIAMOND_POSITIONS,
      });
    }
    if (selectedGroup === "all" || selectedGroup === "tau-box") {
      sections.push({
        label: "Tau Box",
        gridMode: GridMode.BOX,
        positions: TAU_BOX_POSITIONS,
      });
    }
    if (selectedGroup === "all" || selectedGroup === "terra") {
      sections.push({
        label: "Terra",
        gridMode: GridMode.DIAMOND,
        positions: TERRA_POSITIONS,
      });
    }

    return sections;
  });

  function createStaticPictograph(position: GridPosition, gridMode: GridMode): PictographData {
    const locations = POSITION_LOCATIONS[position];
    if (!locations) {
      throw new Error(`No location mapping found for position: ${position}`);
    }
    const [blueLocation, redLocation] = locations;

    // Use compass orientation for center-positioned props, radial for perimeter
    const effectiveBlueOri = blueLocation === GridLocation.CENTER
      ? blueOrientation
      : (isCenterOri(blueOrientation) ? Orientation.IN : blueOrientation);
    const effectiveRedOri = redLocation === GridLocation.CENTER
      ? redOrientation
      : (isCenterOri(redOrientation) ? Orientation.IN : redOrientation);

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: effectiveBlueOri,
      endOrientation: effectiveBlueOri,
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
      startOrientation: effectiveRedOri,
      endOrientation: effectiveRedOri,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLocation,
      gridMode,
    });

    return {
      id: `level5-${position}`,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  function isCenterOri(ori: Orientation): boolean {
    return (ori as string).startsWith("center");
  }

  function formatPosition(pos: GridPosition): string {
    const match = pos.match(/^(tau|terra)(\d+)$/i);
    if (match && match[1] && match[2]) {
      return `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}${match[2]}`;
    }
    return pos.toUpperCase();
  }
</script>

<div class="level5-lab">
  <header class="header">
    <div class="title-row">
      <h1>Level 5</h1>
      <span class="badge">Admin</span>
      <span class="scaffold-badge">Scaffold</span>
    </div>
    <p class="description">
      Centric positions. Rendering requires a centric grid SVG (not yet implemented).
    </p>
  </header>

  <nav class="filter-chips">
    <button
      class="chip"
      class:active={selectedGroup === "all"}
      onclick={() => (selectedGroup = "all")}
    >
      All
      <span class="count">{TAU_DIAMOND_POSITIONS.length + TAU_BOX_POSITIONS.length + TERRA_POSITIONS.length}</span>
    </button>
    <button
      class="chip tau"
      class:active={selectedGroup === "tau-diamond"}
      onclick={() => (selectedGroup = "tau-diamond")}
    >
      Tau Diamond
      <span class="count">{TAU_DIAMOND_POSITIONS.length}</span>
    </button>
    <button
      class="chip tau"
      class:active={selectedGroup === "tau-box"}
      onclick={() => (selectedGroup = "tau-box")}
    >
      Tau Box
      <span class="count">{TAU_BOX_POSITIONS.length}</span>
    </button>
    <button
      class="chip terra"
      class:active={selectedGroup === "terra"}
      onclick={() => (selectedGroup = "terra")}
    >
      Terra
      <span class="count">{TERRA_POSITIONS.length}</span>
    </button>
  </nav>

  <div class="orientation-controls">
    <div class="orientation-group blue">
      <span class="group-label">Blue</span>
      <div class="orientation-chips" class:compass={blueIsAtCenter}>
        {#each (blueIsAtCenter ? COMPASS_ORIENTATIONS : RADIAL_ORIENTATIONS) as ori}
          <button
            class="ori-chip"
            class:active={blueOrientation === ori.value}
            onclick={() => (blueOrientation = ori.value)}
            title={ori.label}
          >
            <i
              class="fas {ori.icon}"
              aria-hidden="true"
              style={('rotation' in ori && ori.rotation) ? `transform: rotate(${ori.rotation}deg)` : ''}
            ></i>
            <span>{ori.label}</span>
          </button>
        {/each}
      </div>
    </div>
    <div class="orientation-group red">
      <span class="group-label">Red</span>
      <div class="orientation-chips" class:compass={redIsAtCenter}>
        {#each (redIsAtCenter ? COMPASS_ORIENTATIONS : RADIAL_ORIENTATIONS) as ori}
          <button
            class="ori-chip"
            class:active={redOrientation === ori.value}
            onclick={() => (redOrientation = ori.value)}
            title={ori.label}
          >
            <i
              class="fas {ori.icon}"
              aria-hidden="true"
              style={('rotation' in ori && ori.rotation) ? `transform: rotate(${ori.rotation}deg)` : ''}
            ></i>
            <span>{ori.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="sections themed-scrollbar">
    {#each displaySections as section (section.label)}
      <section class="position-section">
        <h2 class="section-heading">
          {section.label}
          <span class="section-mode">{section.gridMode}</span>
        </h2>
        <div class="grid">
          {#each section.positions as position (position)}
            {@const gridMode = getGridModeForPosition(position)}
            {@const pictograph = createStaticPictograph(position, gridMode)}
            {@const positionLocations = POSITION_LOCATIONS[position]}
            {@const blueLoc = positionLocations?.[0] ?? GridLocation.CENTER}
            {@const redLoc = positionLocations?.[1] ?? GridLocation.NORTH}
            <article class="card">
              <div class="pictograph-area">
                <PictographContainer
                  pictographData={pictograph}
                  {gridMode}
                />
              </div>
              <footer class="card-footer">
                <span class="position-name">{formatPosition(position)}</span>
                <div class="locations">
                  <span class="loc blue">{blueLoc === GridLocation.CENTER ? "C" : blueLoc.slice(0, 2).toUpperCase()}</span>
                  <span class="loc red">{redLoc === GridLocation.CENTER ? "C" : redLoc.slice(0, 2).toUpperCase()}</span>
                </div>
              </footer>
            </article>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .level5-lab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .header {
    padding: 1.5rem 1.5rem 1rem;
    flex-shrink: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .scaffold-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .description {
    margin: 0.5rem 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }

  .filter-chips {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .chip.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }

  .chip.tau.active {
    border-color: #22d3ee;
  }

  .chip.terra.active {
    border-color: #fbbf24;
  }

  .chip .count {
    font-size: var(--font-size-compact, 12px);
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .chip.active .count {
    background: rgba(255, 255, 255, 0.15);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .chip:active:not(:disabled) {
    transform: scale(0.97);
  }

  .orientation-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    .orientation-controls {
      flex-direction: column;
      gap: 0.75rem;
    }
  }

  .orientation-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .group-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    min-width: 2.5rem;
  }

  .orientation-group.blue .group-label {
    color: #60a5fa;
  }

  .orientation-group.red .group-label {
    color: #f87171;
  }

  .orientation-chips {
    display: flex;
    gap: 0.25rem;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.25rem;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .orientation-chips.compass {
    max-width: 360px;
  }

  .ori-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    min-height: 44px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (pointer: coarse) {
    .ori-chip {
      min-height: 48px;
      padding: 0.75rem;
    }
  }

  .ori-chip:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text, #fff);
  }

  .ori-chip.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, #fff);
  }

  .orientation-group.blue .ori-chip.active {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }

  .orientation-group.red .ori-chip.active {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .ori-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .ori-chip:active {
    transform: scale(0.95);
  }

  .ori-chip i {
    font-size: 0.75rem;
  }

  .sections {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem 1.5rem;
  }

  .position-section {
    margin-bottom: 1.5rem;
  }

  .position-section:last-child {
    margin-bottom: 0;
  }

  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-mode {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: normal;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-secondary, #888);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }

  .card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    overflow: hidden;
    transition: border-color var(--duration-fast) ease;
  }

  .card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .pictograph-area {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    aspect-ratio: 1;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
  }

  .position-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .locations {
    display: flex;
    gap: 0.375rem;
  }

  .loc {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .loc.blue {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
  }

  .loc.red {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .ori-chip,
    .card {
      transition: none;
    }

    .chip:active:not(:disabled),
    .ori-chip:active {
      transform: none;
    }
  }
</style>
