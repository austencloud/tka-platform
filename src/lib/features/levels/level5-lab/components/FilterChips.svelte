<script lang="ts">
  import type { PositionGroup } from "../domain/level5-lab-types";
  import {
    TAU_DIAMOND_POSITIONS,
    TAU_BOX_POSITIONS,
    TERRA_POSITIONS,
  } from "../domain/level5-position-data";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  let {
    selectedGroup,
    onSelect,
  } = $props<{
    selectedGroup: PositionGroup;
    onSelect: (group: PositionGroup) => void;
  }>();

  const totalCount =
    TAU_DIAMOND_POSITIONS.length +
    TAU_BOX_POSITIONS.length +
    TERRA_POSITIONS.length;

  const options = $derived<{ value: PositionGroup; label: string; count: number }[]>([
    { value: "all", label: "All", count: totalCount },
    { value: "tau-diamond", label: "Tau Diamond", count: TAU_DIAMOND_POSITIONS.length },
    { value: "tau-box", label: "Tau Box", count: TAU_BOX_POSITIONS.length },
    { value: "terra", label: "Terra", count: TERRA_POSITIONS.length },
  ]);
</script>

<nav class="filter-chips">
  <SegmentedControl
    {options}
    value={selectedGroup}
    onchange={onSelect}
    color="accent"
    size="sm"
  />
</nav>

<style>
  .filter-chips {
    padding: 0 1.5rem 1rem;
    flex-shrink: 0;
  }
</style>
