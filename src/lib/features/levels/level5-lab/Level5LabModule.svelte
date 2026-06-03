<script lang="ts">
  /**
   * Level 4 Lab Module
   *
   * Admin-only sandbox for validating centric position rendering.
   * Renders all 17 Tau/Terra positions as static pictographs with
   * per-card orientation controls.
   */

  import { GridMode, type GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import type { PositionGroup, PositionSection, CardOrientations } from "./domain/level5-lab-types";
  import {
    TAU_DIAMOND_POSITIONS,
    TAU_BOX_POSITIONS,
    TERRA_POSITIONS,
    isHandAtCenter,
  } from "./domain/level5-position-data";
  import FilterChips from "./components/FilterChips.svelte";
  import PositionGrid from "./components/PositionGrid.svelte";

  // ── State ─────────────────────────────────────────────────────────────

  let selectedGroup = $state<PositionGroup>("all");

  /** Every position tracked independently */
  const ALL_POSITIONS = [
    ...TAU_DIAMOND_POSITIONS,
    ...TAU_BOX_POSITIONS,
    ...TERRA_POSITIONS,
  ];

  /** Initialize per-card orientation map with sensible defaults */
  let orientationMap = $state<Map<GridPosition, CardOrientations>>(
    new Map(
      ALL_POSITIONS.map((pos) => [
        pos,
        {
          blue: isHandAtCenter(pos, "blue") ? Orientation.CENTER_N : Orientation.IN,
          red: isHandAtCenter(pos, "red") ? Orientation.CENTER_N : Orientation.IN,
        },
      ])
    )
  );

  function handleOrientationChange(
    position: GridPosition,
    hand: "blue" | "red",
    value: Orientation
  ): void {
    const current = orientationMap.get(position);
    if (!current) return;
    const updated = new Map(orientationMap);
    updated.set(position, { ...current, [hand]: value });
    orientationMap = updated;
  }

  // ── Derived ───────────────────────────────────────────────────────────

  const bluePropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.bluePropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

  const redPropType = $derived.by(() => {
    const settings = getSettings();
    return (settings.redPropType ?? settings.propType ?? PropType.STAFF) as PropType;
  });

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
</script>

<div class="level5-lab">
  <header class="header">
    <div class="title-row">
      <h1>Level 4</h1>
      <span class="badge">Admin</span>
    </div>
    <p class="description">
      Centric position rendering. Tau (one hand at center) and Terra (both at center).
    </p>
  </header>

  <FilterChips
    {selectedGroup}
    onSelect={(group) => (selectedGroup = group)}
  />

  <PositionGrid
    sections={displaySections}
    {orientationMap}
    onOrientationChange={handleOrientationChange}
    {bluePropType}
    {redPropType}
  />
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

  .description {
    margin: 0.5rem 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, #888);
  }
</style>
