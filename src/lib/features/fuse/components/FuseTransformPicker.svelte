<!--
  FuseTransformPicker — symmetry-mode controls.

  Two single-select SegmentedControls: which side drives (Blue/Red) and how the
  follower derives from it (five of the six LOOP components — Swapped omitted —
  with Rotated at 90°/180°, plus three curated pairs). Both are owned + persisted
  by fuse-state; this picker only drives them.
  Shown by FuseLayout only while the tab is in symmetry mode.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    FUSE_TRANSFORMS,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  const { state: fuseState } = getFuseContext();

  // Inert while a length load or a fuse is in flight, so a change can't race the
  // derive it would trigger.
  const disabled = $derived(
    fuseState.isLoadingLength || fuseState.pendingSide !== null || fuseState.isFusing,
  );

  const driverOptions = $derived(
    (
      [
        { value: "blue", label: "Blue" },
        { value: "red", label: "Red" },
      ] as { value: FuseSide; label: string }[]
    ).map((option) => ({ ...option, disabled })),
  );

  const transformOptions = $derived(
    FUSE_TRANSFORMS.map((transform) => ({
      value: transform.id,
      label: transform.label,
      disabled,
    })),
  );

  const followerLabel = $derived(fuseState.driverSide === "blue" ? "Red" : "Blue");
  const driverLabel = $derived(fuseState.driverSide === "blue" ? "Blue" : "Red");

  function handleDriver(value: FuseSide): void {
    fuseState.setDriver(value);
  }

  function handleTransform(value: FuseTransformId): void {
    fuseState.setTransform(value);
  }
</script>

<div class="transform-picker">
  <div class="field" role="group" aria-label="Driver hand">
    <span class="field-label">Driver</span>
    <div class="field-control driver-control">
      <SegmentedControl
        options={driverOptions}
        value={fuseState.driverSide}
        onchange={handleDriver}
        color="accent"
        size="sm"
      />
    </div>
  </div>

  <div class="field field-grow" role="group" aria-label="Follower transform">
    <span class="field-label">{followerLabel} follows {driverLabel}</span>
    <div class="field-control">
      <SegmentedControl
        options={transformOptions}
        value={fuseState.transformId}
        onchange={handleTransform}
        color="accent"
        size="sm"
      />
    </div>
  </div>
</div>

<style>
  .transform-picker {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--settings-spacing-md, 12px);
    width: 100%;
    min-width: 0;
    padding: var(--settings-spacing-sm, 10px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .field-grow {
    flex: 1 1 22rem;
  }

  .field-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .field-control {
    display: flex;
    min-width: 0;
  }

  .driver-control {
    width: 12rem;
    max-width: 100%;
  }

  .field-control :global(.segmented-control) {
    width: 100%;
  }
</style>
