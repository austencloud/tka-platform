<!--
  PropLocationControl.svelte

  Location-specific labels and behavior for the shared prop cycle control.
-->
<script lang="ts">
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import PropCycleControl from "./PropCycleControl.svelte";

  type LocationRotationDirection = "clockwise" | "counterclockwise";

  interface Props {
    color: "blue" | "red";
    location: GridLocation;
    active?: boolean;
    disabled?: boolean;
    compact?: boolean;
    onRotate: (direction: LocationRotationDirection) => void;
    onChoose: () => void;
  }

  let {
    color,
    location,
    active = false,
    disabled = false,
    compact = false,
    onRotate,
    onChoose,
  }: Props = $props();

  const locationLabels: Record<GridLocation, { short: string; full: string }> =
    {
      n: { short: "N", full: "north" },
      ne: { short: "NE", full: "northeast" },
      e: { short: "E", full: "east" },
      se: { short: "SE", full: "southeast" },
      s: { short: "S", full: "south" },
      sw: { short: "SW", full: "southwest" },
      w: { short: "W", full: "west" },
      nw: { short: "NW", full: "northwest" },
      c: { short: "Center", full: "center" },
    };

  const currentLabel = $derived(locationLabels[location]);
</script>

<PropCycleControl
  valueLabel={currentLabel.short}
  previousLabel="Rotate {color} location counterclockwise"
  nextLabel="Rotate {color} location clockwise"
  selectLabel={disabled
    ? "Location changes are unavailable while a prop is at center"
    : `Choose ${color} location on the placement grid. Current location: ${currentLabel.full}`}
  {active}
  {disabled}
  {compact}
  onPrevious={() => onRotate("counterclockwise")}
  onNext={() => onRotate("clockwise")}
  onSelect={onChoose}
/>
