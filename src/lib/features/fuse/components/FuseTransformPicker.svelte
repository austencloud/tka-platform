<!--
  FuseTransformPicker — symmetry-mode controls.

  A color-coded SegmentedControl chooses the driver. The shared wrapping
  OptionChipRow handles the larger transform family without crushing nine labels
  into one equal-width row. Both values are owned + persisted by fuse-state.
  Shown by FuseLayout only while the tab is in symmetry mode.
-->
<script lang="ts">
  import OptionChipRow from "$lib/shared/animation-engine/components/effects-panel/OptionChipRow.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    FUSE_TRANSFORMS,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let { embedded = false }: { embedded?: boolean } = $props();
  const { state: fuseState } = getFuseContext();

  const TRANSFORM_ICONS: Record<FuseTransformId, string> = {
    mirror: "fa-left-right",
    flip: "fa-up-down",
    rotate90: "fa-rotate-right",
    rotate180: "fa-arrows-rotate",
    invert: "fa-circle-half-stroke",
    rewind: "fa-backward",
    "rotate-mirror": "fa-shuffle",
    "mirror-invert": "fa-code-compare",
    "rotate-invert": "fa-repeat",
  };

  // Inert while a length load or a fuse is in flight, so a change can't race the
  // derive it would trigger.
  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );

  const driverOptions = $derived(
    (
      [
        { value: "blue", label: "Blue", tone: "blue" },
        { value: "red", label: "Red", tone: "red" },
      ] as {
        value: FuseSide;
        label: string;
        tone: "blue" | "red";
      }[]
    ).map((option) => ({ ...option, disabled }))
  );

  const transformOptions = $derived(
    FUSE_TRANSFORMS.map((transform) => ({
      value: transform.id,
      label: transform.label,
      icon: TRANSFORM_ICONS[transform.id],
    }))
  );

  const followerLabel = $derived(
    fuseState.driverSide === "blue" ? "Red" : "Blue"
  );
  const driverLabel = $derived(
    fuseState.driverSide === "blue" ? "Blue" : "Red"
  );
  const followerColor = $derived(
    fuseState.driverSide === "blue"
      ? "var(--prop-red, #f44336)"
      : "var(--prop-blue, #2196f3)"
  );

  function handleDriver(value: FuseSide): void {
    fuseState.setDriver(value);
  }

  function handleTransform(value: FuseTransformId): void {
    fuseState.setTransform(value);
  }
</script>

<div class="transform-picker" class:embedded>
  <div class="field" role="group" aria-label="Driver hand">
    <span class="field-label">Driver</span>
    <div class="field-control driver-control">
      <SegmentedControl
        options={driverOptions}
        value={fuseState.driverSide}
        onchange={handleDriver}
        color="accent"
        size="md"
      />
    </div>
  </div>

  <div class="transform-options">
    <OptionChipRow
      label={`${followerLabel} follows ${driverLabel}`}
      ariaLabel="Follower transformation"
      options={transformOptions}
      value={fuseState.transformId}
      onChange={handleTransform}
      color={followerColor}
      {disabled}
      layout="stacked"
    />
  </div>
</div>

<style>
  .transform-picker {
    display: grid;
    grid-template-columns: minmax(11rem, 0.72fr) minmax(22rem, 3fr);
    align-items: flex-end;
    flex: 4 1 46rem;
    gap: var(--settings-spacing-md, 12px);
    width: auto;
    min-width: 0;
    padding: var(--settings-spacing-sm, 10px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  .transform-picker.embedded {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
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
    width: 100%;
  }

  .field-control :global(.segmented-control) {
    width: 100%;
  }

  .transform-options {
    min-width: 0;
  }

  .transform-options :global(.chip) {
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
  }

  @container fuse (max-width: 960px) {
    .transform-picker:not(.embedded) {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }
  }
</style>
