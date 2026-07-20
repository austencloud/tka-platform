<!--
  FuseModeBar — top-of-tab Fuse mode switch.

  A single-select SegmentedControl toggling the whole tab between `shuffle` (two
  independent paths) and `symmetry` (one driver path, the follower derived from
  it). The mode is owned + persisted by fuse-state; this bar just drives it.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseMode } from "../state/fuse-state.svelte";

  const { state: fuseState } = getFuseContext();

  // No icons: SegmentedControl renders the icon in place of the label, and the
  // two mode words carry the meaning here.
  const modeOptions: { value: FuseMode; label: string }[] = [
    { value: "shuffle", label: "Shuffle" },
    { value: "symmetry", label: "Symmetry" },
  ];

  // Mode swaps rebuild the preview; keep it inert mid-load so a switch can't race
  // an in-flight length load or fuse.
  const disabled = $derived(fuseState.isLoadingLength || fuseState.isFusing);

  const options = $derived(
    modeOptions.map((option) => ({ ...option, disabled })),
  );

  function handleSelect(value: FuseMode): void {
    fuseState.setMode(value);
  }
</script>

<div class="fuse-mode-bar" role="group" aria-label="Fuse mode">
  <SegmentedControl
    {options}
    value={fuseState.mode}
    onchange={handleSelect}
    color="accent"
    size="sm"
  />
</div>

<style>
  .fuse-mode-bar {
    display: flex;
    /* Sized for the two labels inline; min-width:0 lets it shrink on compact. */
    width: 18rem;
    max-width: 100%;
    min-width: 0;
  }

  .fuse-mode-bar :global(.segmented-control) {
    width: 100%;
  }
</style>
