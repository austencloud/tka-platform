<script lang="ts">
  /**
   * Level 7 Lab Module
   *
   * Admin-only experimental sandbox for validating interradial orientation rendering
   * at intercardinal positions (NE/SE/SW/NW). Shows static pictographs in box mode
   * with all 8 radial orientations (4 cardinal + 4 interradial).
   *
   * Optional gravity toggle auto-assigns resting orientations based on hand location.
   * Note: Gravity is a separate concept from interradial orientations - it's included
   * here as a convenience for testing physically correct defaults.
   */

  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
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
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  // ============================================================================
  // STATE
  // ============================================================================

  let selectedGroup = $state<"all" | "alpha" | "beta" | "gamma">("all");
  let gravityMode = $state(false);
  let blueOrientation = $state<Orientation>(Orientation.CLOCK_IN);
  let redOrientation = $state<Orientation>(Orientation.CLOCK_IN);

  // ============================================================================
  // ORIENTATION OPTIONS
  // ============================================================================

  const RADIAL_ORIENTATIONS = [
    { value: Orientation.IN, label: "In", icon: "fa-compress-arrows-alt" },
    { value: Orientation.OUT, label: "Out", icon: "fa-expand-arrows-alt" },
    { value: Orientation.CLOCK, label: "CW", icon: "fa-rotate-right" },
    { value: Orientation.COUNTER, label: "CCW", icon: "fa-rotate-left" },
  ] as const;

  const INTERRADIAL_ORIENTATIONS = [
    { value: Orientation.CLOCK_IN, label: "CW-In", icon: "fa-arrow-up", rotation: 45 },
    { value: Orientation.CLOCK_OUT, label: "CW-Out", icon: "fa-arrow-down", rotation: -45 },
    { value: Orientation.COUNTER_IN, label: "CCW-In", icon: "fa-arrow-up", rotation: -45 },
    { value: Orientation.COUNTER_OUT, label: "CCW-Out", icon: "fa-arrow-down", rotation: 45 },
  ] as const;

  const ALL_ORIENTATIONS = [...RADIAL_ORIENTATIONS, ...INTERRADIAL_ORIENTATIONS];

  // ============================================================================
  // GRAVITY MAP
  // ============================================================================

  /** Physically correct resting orientation per grid location (poi gravity) */
  const GRAVITY_MAP: Partial<Record<GridLocation, Orientation>> = {
    [GridLocation.NORTH]: Orientation.IN,
    [GridLocation.EAST]: Orientation.CLOCK,
    [GridLocation.SOUTH]: Orientation.OUT,
    [GridLocation.WEST]: Orientation.COUNTER,
    [GridLocation.NORTHEAST]: Orientation.CLOCK_IN,
    [GridLocation.SOUTHEAST]: Orientation.CLOCK_OUT,
    [GridLocation.SOUTHWEST]: Orientation.COUNTER_OUT,
    [GridLocation.NORTHWEST]: Orientation.COUNTER_IN,
  };

  // ============================================================================
  // POSITION DATA (Box mode = intercardinal locations)
  // ============================================================================

  /**
   * Box mode positions with intercardinal locations: [blueLocation, redLocation]
   * Sourced from GridPositionDeriver.POSITIONS_MAP (canonical)
   */
  const BOX_POSITIONS: Record<string, [GridLocation, GridLocation]> = {
    // Alpha (opposite intercardinals)
    [GridPosition.ALPHA2]: [GridLocation.SOUTHWEST, GridLocation.NORTHEAST],
    [GridPosition.ALPHA4]: [GridLocation.NORTHWEST, GridLocation.SOUTHEAST],
    [GridPosition.ALPHA6]: [GridLocation.NORTHEAST, GridLocation.SOUTHWEST],
    [GridPosition.ALPHA8]: [GridLocation.SOUTHEAST, GridLocation.NORTHWEST],
    // Beta (same intercardinal)
    [GridPosition.BETA2]: [GridLocation.NORTHEAST, GridLocation.NORTHEAST],
    [GridPosition.BETA4]: [GridLocation.SOUTHEAST, GridLocation.SOUTHEAST],
    [GridPosition.BETA6]: [GridLocation.SOUTHWEST, GridLocation.SOUTHWEST],
    [GridPosition.BETA8]: [GridLocation.NORTHWEST, GridLocation.NORTHWEST],
    // Gamma (adjacent intercardinals)
    [GridPosition.GAMMA2]: [GridLocation.NORTHWEST, GridLocation.NORTHEAST],
    [GridPosition.GAMMA4]: [GridLocation.NORTHEAST, GridLocation.SOUTHEAST],
    [GridPosition.GAMMA6]: [GridLocation.SOUTHEAST, GridLocation.SOUTHWEST],
    [GridPosition.GAMMA8]: [GridLocation.SOUTHWEST, GridLocation.NORTHWEST],
    [GridPosition.GAMMA10]: [GridLocation.SOUTHEAST, GridLocation.NORTHEAST],
    [GridPosition.GAMMA12]: [GridLocation.SOUTHWEST, GridLocation.SOUTHEAST],
    [GridPosition.GAMMA14]: [GridLocation.NORTHWEST, GridLocation.SOUTHWEST],
    [GridPosition.GAMMA16]: [GridLocation.NORTHEAST, GridLocation.NORTHWEST],
  };

  const ALPHA_POSITIONS = [GridPosition.ALPHA2, GridPosition.ALPHA4, GridPosition.ALPHA6, GridPosition.ALPHA8];
  const BETA_POSITIONS = [GridPosition.BETA2, GridPosition.BETA4, GridPosition.BETA6, GridPosition.BETA8];
  const GAMMA_POSITIONS = [
    GridPosition.GAMMA2, GridPosition.GAMMA4, GridPosition.GAMMA6, GridPosition.GAMMA8,
    GridPosition.GAMMA10, GridPosition.GAMMA12, GridPosition.GAMMA14, GridPosition.GAMMA16,
  ];

  // ============================================================================
  // PROP TYPES FROM SETTINGS
  // ============================================================================

  const bluePropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  const redPropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  // ============================================================================
  // DISPLAY SECTIONS
  // ============================================================================

  interface PositionSection {
    label: string;
    positions: GridPosition[];
  }

  const displaySections = $derived.by((): PositionSection[] => {
    const sections: PositionSection[] = [];
    if (selectedGroup === "all" || selectedGroup === "alpha") {
      sections.push({ label: "Alpha (opposite)", positions: ALPHA_POSITIONS });
    }
    if (selectedGroup === "all" || selectedGroup === "beta") {
      sections.push({ label: "Beta (same)", positions: BETA_POSITIONS });
    }
    if (selectedGroup === "all" || selectedGroup === "gamma") {
      sections.push({ label: "Gamma (adjacent)", positions: GAMMA_POSITIONS });
    }
    return sections;
  });

  // ============================================================================
  // PICTOGRAPH CREATION
  // ============================================================================

  function getOrientation(location: GridLocation, manualOri: Orientation): Orientation {
    if (gravityMode) {
      return GRAVITY_MAP[location] ?? manualOri;
    }
    return manualOri;
  }

  function createStaticPictograph(position: GridPosition): PictographData {
    const locations = BOX_POSITIONS[position];
    if (!locations) {
      throw new Error(`No location mapping for position: ${position}`);
    }
    const [blueLocation, redLocation] = locations;

    const blueOri = getOrientation(blueLocation, blueOrientation);
    const redOri = getOrientation(redLocation, redOrientation);

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: blueOri,
      endOrientation: blueOri,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: bluePropType,
      arrowLocation: blueLocation,
      gridMode: GridMode.BOX,
    });

    const redMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redLocation,
      endLocation: redLocation,
      startOrientation: redOri,
      endOrientation: redOri,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLocation,
      gridMode: GridMode.BOX,
    });

    return {
      id: `level7-${position}`,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  function formatPosition(pos: GridPosition): string {
    const match = pos.match(/^(alpha|beta|gamma)(\d+)$/i);
    if (match && match[1] && match[2]) {
      const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      return `${prefix}${match[2]}`;
    }
    return pos.toUpperCase();
  }

  function formatLocation(loc: GridLocation): string {
    return loc.toUpperCase();
  }

  const totalCount = $derived(ALPHA_POSITIONS.length + BETA_POSITIONS.length + GAMMA_POSITIONS.length);

  const groupOptions = $derived<
    { value: "all" | "alpha" | "beta" | "gamma"; label: string; count: number }[]
  >([
    { value: "all", label: "All", count: totalCount },
    { value: "alpha", label: "Alpha", count: ALPHA_POSITIONS.length },
    { value: "beta", label: "Beta", count: BETA_POSITIONS.length },
    { value: "gamma", label: "Gamma", count: GAMMA_POSITIONS.length },
  ]);
</script>

<div class="level7-lab">
  <header class="header">
    <div class="title-row">
      <h1>Level 7</h1>
      <span class="badge">Admin</span>
    </div>
    <p class="description">
      Interradial orientations (clockIn, clockOut, counterIn, counterOut) at intercardinal positions in box mode.
    </p>
  </header>

  <nav class="filter-chips">
    <SegmentedControl
      options={groupOptions}
      value={selectedGroup}
      onchange={(v) => (selectedGroup = v)}
      color="accent"
      size="sm"
    />
  </nav>

  <div class="controls-row">
    <div class="orientation-controls">
      <div class="orientation-group blue">
        <span class="group-label">Blue</span>
        <div class="orientation-chips">
          {#each ALL_ORIENTATIONS as ori}
            <button
              class="ori-chip"
              class:active={!gravityMode && blueOrientation === ori.value}
              class:interradial={ori.value.includes("clock") || ori.value.includes("counter")}
              aria-pressed={!gravityMode && blueOrientation === ori.value}
              aria-label={ori.label}
              disabled={gravityMode}
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
        <div class="orientation-chips">
          {#each ALL_ORIENTATIONS as ori}
            <button
              class="ori-chip"
              class:active={!gravityMode && redOrientation === ori.value}
              class:interradial={ori.value.includes("clock") || ori.value.includes("counter")}
              aria-pressed={!gravityMode && redOrientation === ori.value}
              aria-label={ori.label}
              disabled={gravityMode}
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

    <button
      class="gravity-toggle"
      class:active={gravityMode}
      aria-pressed={gravityMode}
      onclick={() => (gravityMode = !gravityMode)}
      title="Gravity mode: auto-assign orientation based on hand location"
    >
      <i class="fas fa-magnet" aria-hidden="true"></i>
      <span>Gravity</span>
    </button>
  </div>

  <div class="sections themed-scrollbar">
    {#each displaySections as section (section.label)}
      <section class="position-section">
        <h2 class="section-heading">
          {section.label}
          <span class="section-mode">box</span>
        </h2>
        <div class="grid">
          {#each section.positions as position (position)}
            {@const locations = BOX_POSITIONS[position]}
            {@const blueLoc = locations?.[0] ?? GridLocation.NORTHEAST}
            {@const redLoc = locations?.[1] ?? GridLocation.SOUTHWEST}
            {@const blueOri = getOrientation(blueLoc, blueOrientation)}
            {@const redOri = getOrientation(redLoc, redOrientation)}
            {@const pictograph = createStaticPictograph(position)}
            <article class="card">
              <div class="pictograph-area">
                <PictographContainer
                  pictographData={pictograph}
                  gridMode={GridMode.BOX}
                />
              </div>
              <footer class="card-footer">
                <span class="position-name">{formatPosition(position)}</span>
                <div class="ori-labels">
                  <span class="ori-label blue" title="Blue orientation">{formatLocation(blueLoc)}: {blueOri}</span>
                  <span class="ori-label red" title="Red orientation">{formatLocation(redLoc)}: {redOri}</span>
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
  .level7-lab {
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

  .description {
    margin: 0.5rem 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }

  /* Filter chips */
  .filter-chips {
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
    max-width: 32rem;
  }

  /* Controls row */
  .controls-row {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .orientation-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    flex: 1;
  }

  @media (max-width: 480px) {
    .orientation-controls {
      flex-direction: column;
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

  .orientation-group.blue .group-label { color: #60a5fa; }
  .orientation-group.red .group-label { color: #f87171; }

  .orientation-chips {
    display: flex;
    gap: 0.25rem;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.25rem;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .ori-chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    min-height: 36px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .ori-chip.interradial {
    border-left: 2px solid rgba(168, 85, 247, 0.3);
  }

  .ori-chip:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @media (pointer: coarse) {
    .ori-chip {
      min-height: 44px;
      padding: 0.5rem 0.625rem;
    }
  }

  .ori-chip:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
  }

  .ori-chip.active {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
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

  .ori-chip i {
    font-size: 0.7rem;
  }

  /* Gravity toggle */
  .gravity-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    min-height: 44px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    flex-shrink: 0;
  }

  .gravity-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .gravity-toggle.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: #a855f7;
    color: #c084fc;
  }

  .gravity-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Sections */
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
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-secondary, #888);
  }

  /* Grid */
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
    transition: border-color var(--duration-fast, 150ms) ease;
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
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
  }

  .position-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .ori-labels {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .ori-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .ori-label.blue {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
  }

  .ori-label.red {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .ori-chip,
    .card,
    .gravity-toggle {
      transition: none;
    }
  }
</style>
