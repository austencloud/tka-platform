<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_LENGTHS, type FuseLength } from "../state/fuse-state.svelte";

  const { state: fuseState } = getFuseContext();

  function isFuseLength(value: number): value is FuseLength {
    return (FUSE_LENGTHS as readonly number[]).includes(value);
  }

  const options = $derived(
    FUSE_LENGTHS.map((length) => ({
      value: String(length),
      label: String(length),
      disabled: fuseState.isLoadingLength || fuseState.isFusing,
    }))
  );

  function handleSelect(value: string): void {
    const length = Number(value);
    if (isFuseLength(length)) void fuseState.setLength(length);
  }
</script>

<div class="length-picker" role="group" aria-label="Length in steps">
  <SegmentedControl
    {options}
    value={String(fuseState.requestedLength)}
    onchange={handleSelect}
    color="accent"
    size="md"
  />
</div>

<style>
  .length-picker {
    display: flex;
    width: 100%;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .length-picker :global(.segmented-control) {
    width: 100%;
  }
</style>
