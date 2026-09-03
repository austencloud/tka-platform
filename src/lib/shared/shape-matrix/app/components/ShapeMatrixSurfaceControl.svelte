<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import type { ShapeMatrixSurface } from "../state/shape-matrix-app-state.svelte";

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();
  const state = getShapeMatrixAppContext();
  const options = [
    { value: "matrix" as const, label: "Level 4 matrix", shortLabel: "Matrix" },
    {
      value: "theory" as const,
      label: "Rational ratio theory",
      shortLabel: "Theory",
    },
  ];
</script>

<div class:compact class="surface-control">
  <SegmentedControl
    {options}
    value={state.surface}
    onchange={(surface: ShapeMatrixSurface) => state.setSurface(surface)}
    size="sm"
    density="tight"
    color="accent"
    semantics="radiogroup"
    ariaLabel="Shape Matrix surface"
  />
</div>

<style>
  .surface-control {
    width: 8.25rem;
  }

  .surface-control.compact {
    width: 7.25rem;
  }
</style>
