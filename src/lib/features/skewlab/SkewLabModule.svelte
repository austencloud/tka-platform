<script lang="ts">
  /**
   * Skew Lab (L5) Module
   *
   * Admin-only experimental sandbox for validating skewed position rendering.
   * Has two tabs:
   * - Positions: Renders all 32 Zeta/Eta positions as static pictographs
   * - Categories: Browse skewed pictographs by category (1-4)
   */

  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import CategoryBrowser from "./components/CategoryBrowser.svelte";
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

  // State
  let activeTab = $state<"positions" | "categories">("categories");
  let selectedGroup = $state<"all" | "zeta" | "eta">("all");
  let blueOrientation = $state<Orientation>(Orientation.IN);
  let redOrientation = $state<Orientation>(Orientation.IN);

  // Orientation options for the switcher
  const ORIENTATIONS = [
    { value: Orientation.IN, label: "In", icon: "fa-compress-arrows-alt" },
    { value: Orientation.OUT, label: "Out", icon: "fa-expand-arrows-alt" },
    { value: Orientation.CLOCK, label: "CW", icon: "fa-rotate-right" },
    { value: Orientation.COUNTER, label: "CCW", icon: "fa-rotate-left" },
  ] as const;

  // Get user's prop types from reactive settings (responds to Alt+number, P key)
  const bluePropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  const redPropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  // Position to hand location mapping (only Zeta and Eta positions for skewed mode)
  const POSITION_LOCATIONS: Partial<Record<GridPosition, [GridLocation, GridLocation]>> = {
    // Zeta positions - 135° obtuse angle
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
    // Eta positions - 45° acute angle
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

  const displayPositions = $derived.by(() => {
    if (selectedGroup === "zeta") return ZETA_POSITIONS;
    if (selectedGroup === "eta") return ETA_POSITIONS;
    return [...ZETA_POSITIONS, ...ETA_POSITIONS];
  });

  function createStaticPictograph(position: GridPosition): PictographData {
    const locations = POSITION_LOCATIONS[position];
    if (!locations) {
      throw new Error(`No location mapping found for position: ${position}`);
    }
    const [blueLocation, redLocation] = locations;
    const gridMode = GridMode.SKEWED;

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: blueOrientation,
      endOrientation: blueOrientation,
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
      startOrientation: redOrientation,
      endOrientation: redOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLocation,
      gridMode,
    });

    return {
      id: `level4-${position}`,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  function formatPosition(pos: GridPosition): string {
    const match = pos.match(/^(zeta|eta)(\d+)$/i);
    if (match && match[1] && match[2]) {
      return `${match[1].charAt(0).toUpperCase()}${match[2]}`;
    }
    return pos.toUpperCase();
  }
</script>

<div class="skewlab">
  <header class="header">
    <div class="title-row">
      <h1>Skew Lab</h1>
      <span class="badge">Admin</span>
    </div>
    <nav class="tabs">
      <button
        class="tab"
        class:active={activeTab === "categories"}
        onclick={() => (activeTab = "categories")}
      >
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Categories
      </button>
      <button
        class="tab"
        class:active={activeTab === "positions"}
        onclick={() => (activeTab = "positions")}
      >
        <i class="fas fa-grip" aria-hidden="true"></i>
        Positions
      </button>
    </nav>
  </header>

  {#if activeTab === "categories"}
    <CategoryBrowser />
  {:else}
    <p class="tab-description">
      Validate skewed position rendering with your current prop settings
    </p>

    <nav class="filter-chips">
    <button
      class="chip"
      class:active={selectedGroup === "all"}
      onclick={() => (selectedGroup = "all")}
    >
      All
      <span class="count">{ZETA_POSITIONS.length + ETA_POSITIONS.length}</span>
    </button>
    <button
      class="chip zeta"
      class:active={selectedGroup === "zeta"}
      onclick={() => (selectedGroup = "zeta")}
    >
      Zeta
      <span class="angle">135°</span>
      <span class="count">{ZETA_POSITIONS.length}</span>
    </button>
    <button
      class="chip eta"
      class:active={selectedGroup === "eta"}
      onclick={() => (selectedGroup = "eta")}
    >
      Eta
      <span class="angle">45°</span>
      <span class="count">{ETA_POSITIONS.length}</span>
    </button>
  </nav>

  <div class="orientation-controls">
    <div class="orientation-group blue">
      <span class="group-label">Blue</span>
      <div class="orientation-chips">
        {#each ORIENTATIONS as ori}
          <button
            class="ori-chip"
            class:active={blueOrientation === ori.value}
            onclick={() => (blueOrientation = ori.value)}
            title={ori.label}
          >
            <i class="fas {ori.icon}" aria-hidden="true"></i>
            <span>{ori.label}</span>
          </button>
        {/each}
      </div>
    </div>
    <div class="orientation-group red">
      <span class="group-label">Red</span>
      <div class="orientation-chips">
        {#each ORIENTATIONS as ori}
          <button
            class="ori-chip"
            class:active={redOrientation === ori.value}
            onclick={() => (redOrientation = ori.value)}
            title={ori.label}
          >
            <i class="fas {ori.icon}" aria-hidden="true"></i>
            <span>{ori.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid themed-scrollbar">
    {#each displayPositions as position (position)}
      {@const pictograph = createStaticPictograph(position)}
      {@const positionLocations = POSITION_LOCATIONS[position]}
      {@const blueLoc = positionLocations?.[0] ?? GridLocation.NORTH}
      {@const redLoc = positionLocations?.[1] ?? GridLocation.SOUTH}
      <article class="card">
        <div class="pictograph-area">
          <PictographContainer
            pictographData={pictograph}
            gridMode={GridMode.SKEWED}
          />
        </div>
        <footer class="card-footer">
          <span class="position-name">{formatPosition(position)}</span>
          <div class="locations">
            <span class="loc blue">{blueLoc.slice(0, 2).toUpperCase()}</span>
            <span class="loc red">{redLoc.slice(0, 2).toUpperCase()}</span>
          </div>
        </footer>
      </article>
    {/each}
  </div>
  {/if}
</div>

<style>
  .skewlab {
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
    background: color-mix(in srgb, var(--semantic-warning, #f97316) 15%, transparent);
    color: var(--semantic-warning, #f97316);
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-top: 1rem;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.25rem;
    border-radius: 10px;
    width: fit-content;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    min-height: 44px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (pointer: coarse) {
    .tab {
      min-height: var(--min-touch-target);
    }
  }

  .tab:hover {
    color: var(--theme-text, #fff);
  }

  .tab.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .tab:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .tab:active:not(:disabled) {
    transform: scale(0.97);
  }

  .tab i {
    font-size: 0.875rem;
  }

  .tab-description {
    margin: 0;
    padding: 0 1.5rem 1rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
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
    min-height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (pointer: coarse) {
    .chip {
      min-height: var(--min-touch-target);
    }
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

  /* Zeta/Eta position group accents — scoped to skewlab; no global token exists. */
  .chip.zeta { --skewlab-zeta-accent: #a78bfa; } /* violet — 135° obtuse */
  .chip.eta  { --skewlab-eta-accent:  #34d399; } /* emerald — 45° acute */

  .chip.zeta.active {
    border-color: var(--skewlab-zeta-accent);
  }

  .chip.eta.active {
    border-color: var(--skewlab-eta-accent);
  }

  .chip .angle {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.6;
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
      min-height: var(--min-touch-target);
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

  .grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
    padding: 0 1.5rem 1.5rem;
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

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tab,
    .chip,
    .ori-chip,
    .card {
      transition: none;
    }

    .tab:active:not(:disabled),
    .chip:active:not(:disabled),
    .ori-chip:active {
      transform: none;
    }
  }
</style>
