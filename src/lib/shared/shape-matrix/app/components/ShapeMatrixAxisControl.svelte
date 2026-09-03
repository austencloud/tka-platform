<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixAxisControl.svelte
  The Apply-to cell: which axis the value control edits. Both surfaces use the
  same target, so a user who learns it on the Matrix already knows it on
  Theory. -->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import ShapeMatrixRibbonCell from "./ShapeMatrixRibbonCell.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import type { ShapeMatrixAxisTarget } from "../state/shape-matrix-app-state.svelte";

  interface Props {
    layout?: "ribbon" | "tray";
    /** What the axis choice steers, spoken for assistive technology. */
    steers?: string;
  }
  let { layout = "ribbon", steers = "the turn control" }: Props = $props();

  const appState = getShapeMatrixAppContext();

  const AXIS_OPTIONS = [
    {
      value: "left" as const,
      label: "Left-hand rows",
      shortLabel: "Left",
      tone: "blue" as const,
    },
    {
      value: "both" as const,
      label: "Both axes",
      shortLabel: "Both",
      tone: "both" as const,
    },
    {
      value: "right" as const,
      label: "Right-hand columns",
      shortLabel: "Right",
      tone: "red" as const,
    },
  ];
</script>

<ShapeMatrixRibbonCell
  label="Apply to"
  tray={layout === "tray"}
  controlWidth="9.75rem"
>
  <SegmentedControl
    options={AXIS_OPTIONS}
    value={appState.activeAxis}
    onchange={(axis: ShapeMatrixAxisTarget) => appState.setActiveAxis(axis)}
    size="sm"
    density="tight"
    color="accent"
    semantics="radiogroup"
    ariaLabel={`Axis edited by ${steers}`}
  />
</ShapeMatrixRibbonCell>
