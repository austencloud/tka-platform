<!--
  OptionPictograph - Visibility-aware wrapper around PictographRenderer.
  Subscribes to VisibilityStateManager so option picker pictographs
  reflect all user visibility preferences (motions, grid, glyphs, etc.).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PreparedPictographData } from "../shared/domain/models/prepared-pictograph-data";
  import PictographRenderer from "../shared/components/PictographRenderer.svelte";
  import { getVisibilityStateManager } from "../shared/state/visibility-state.svelte";
  import type { GridLocation } from "../grid/domain/enums/grid-enums";

  let {
    pictograph,
    blueReversal = false,
    redReversal = false,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
  }>();

  const vm = getVisibilityStateManager();

  let showGrid = $state(vm.getGridVisibility());
  let showTKA = $state(vm.getGlyphVisibility("tkaGlyph"));
  let showReversals = $state(vm.getGlyphVisibility("reversalIndicators"));
  let showNonRadialPoints = $state(vm.getNonRadialVisibility());
  let showTnD = $state(vm.getGlyphVisibility("tndGlyph"));
  let showElemental = $state(vm.getGlyphVisibility("elementalGlyph"));
  let showPositions = $state(vm.getGlyphVisibility("positionsGlyph"));
  let handPointVisibility = $state<"all" | "active" | "none">(vm.getHandPointVisibility());

  function syncAll() {
    showGrid = vm.getGridVisibility();
    showTKA = vm.getGlyphVisibility("tkaGlyph");
    showReversals = vm.getGlyphVisibility("reversalIndicators");
    showNonRadialPoints = vm.getNonRadialVisibility();
    showTnD = vm.getGlyphVisibility("tndGlyph");
    showElemental = vm.getGlyphVisibility("elementalGlyph");
    showPositions = vm.getGlyphVisibility("positionsGlyph");
    handPointVisibility = vm.getHandPointVisibility();
  }

  onMount(() => {
    vm.registerObserver(syncAll, ["all"]);
    return () => vm.unregisterObserver(syncAll);
  });

  // Compute active locations from motion end positions (where props are)
  const activeLocations = $derived.by(() => {
    const locations: GridLocation[] = [];
    const blue = pictograph.motions?.blue;
    const red = pictograph.motions?.red;
    if (blue?.endLocation) locations.push(blue.endLocation as GridLocation);
    if (red?.endLocation) locations.push(red.endLocation as GridLocation);
    return locations;
  });
</script>

<PictographRenderer
  {pictograph}
  {blueReversal}
  {redReversal}
  blueMotionVisible={true}
  redMotionVisible={true}
  {showGrid}
  {showTKA}
  {showReversals}
  {showNonRadialPoints}
  {showTnD}
  {showElemental}
  {showPositions}
  {handPointVisibility}
  {activeLocations}
/>
