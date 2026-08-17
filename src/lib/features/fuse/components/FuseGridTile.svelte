<!--
  FuseGridTile — the Grid slot on the header's recipe rail.

  Grid has exactly two values, so the tile IS the picker. It was a word plus a
  glyph that swapped what it named on every press, which told you the current
  value but never that a second one existed. The same SegmentedControl the
  Pairing tile uses shows both values at once, marks the live one, and takes one
  press to reach either — no popover holding a two-item menu.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getFuseContext } from "../context/fuse-context";
  import FuseRailTile from "./FuseRailTile.svelte";

  let {
    color,
    shadowColor,
    textColor = "white",
    disabled = false,
  }: {
    color: string;
    shadowColor: string;
    textColor?: string;
    disabled?: boolean;
  } = $props();

  const { state: fuseState } = getFuseContext();

  const options = $derived(
    (
      [
        { value: GridMode.DIAMOND, label: "Diamond" },
        { value: GridMode.BOX, label: "Box" },
      ] as { value: GridMode; label: string }[]
    ).map((option) => ({ ...option, disabled }))
  );

  function select(value: GridMode): void {
    if (disabled) return;
    fuseState.setGridMode(value);
  }
</script>

<FuseRailTile label="Grid" {color} {shadowColor} {textColor}>
  <div class="grid-switch">
    <SegmentedControl
      {options}
      value={fuseState.gridMode}
      onchange={select}
      color="accent"
      size="md"
    />
  </div>
</FuseRailTile>

<style>
  /* The switch is the tile's subject, so it spans the tile. */
  .grid-switch {
    display: flex;
    min-width: 0;
  }

  .grid-switch :global(.segmented-control) {
    width: 100%;
  }
</style>
