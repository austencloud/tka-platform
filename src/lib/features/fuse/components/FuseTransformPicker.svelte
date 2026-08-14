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

  let {
    embedded = false,
    driver,
    transform,
    onDriverChange,
    onTransformChange,
    relationshipLayout = false,
  }: {
    embedded?: boolean;
    driver?: FuseSide;
    transform?: FuseTransformId;
    onDriverChange?: (side: FuseSide) => void;
    onTransformChange?: (id: FuseTransformId) => void;
    relationshipLayout?: boolean;
  } = $props();
  const { state: fuseState } = getFuseContext();
  const selectedDriver = $derived(driver ?? fuseState.driverSide);
  const selectedTransform = $derived(transform ?? fuseState.transformId);

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
      description: transform.description,
      icon: TRANSFORM_ICONS[transform.id],
    }))
  );

  const followerLabel = $derived(selectedDriver === "blue" ? "Red" : "Blue");
  const driverLabel = $derived(selectedDriver === "blue" ? "Blue" : "Red");
  const followerColor = $derived(
    selectedDriver === "blue"
      ? "var(--prop-red, #f44336)"
      : "var(--prop-blue, #2196f3)"
  );

  function handleDriver(value: FuseSide): void {
    if (onDriverChange) onDriverChange(value);
    else fuseState.setDriver(value);
  }

  function handleTransform(value: FuseTransformId): void {
    if (onTransformChange) onTransformChange(value);
    else fuseState.setTransform(value);
  }
</script>

<div
  class="transform-picker"
  class:embedded
  class:relationship-layout={relationshipLayout}
>
  <div class="field" role="group" aria-label="Path you will edit">
    <div class="field-heading">
      {#if relationshipLayout}<span class="step-number">1</span>{/if}
      <div>
        <span class="field-label">
          {relationshipLayout ? "Path you will edit" : "Driver"}
        </span>
        {#if relationshipLayout}
          <span class="field-help">{driverLabel} stays editable</span>
        {/if}
      </div>
    </div>
    <div class="field-control driver-control">
      <SegmentedControl
        options={driverOptions}
        value={selectedDriver}
        onchange={handleDriver}
        color="accent"
        size="md"
      />
    </div>
  </div>

  <div class="transform-options">
    {#if relationshipLayout}
      <div class="field-heading">
        <span class="step-number">2</span>
        <div>
          <span class="field-label">How the other path is rebuilt</span>
          <span class="field-help">
            Each choice previews a new {followerLabel} path
          </span>
        </div>
      </div>
    {/if}
    <OptionChipRow
      label={relationshipLayout
        ? `Rule applied to ${followerLabel}`
        : `${followerLabel} follows ${driverLabel}`}
      ariaLabel="Follower transformation"
      options={transformOptions}
      value={selectedTransform}
      onChange={handleTransform}
      color={followerColor}
      {disabled}
      layout={relationshipLayout ? "tiles" : "stacked"}
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

  .transform-picker.embedded.relationship-layout {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    max-width: 34rem;
    margin-inline: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .relationship-layout .field,
  .relationship-layout .transform-options {
    padding: clamp(12px, 0.45cqw, 17px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .relationship-layout .transform-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .field-heading > div {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .step-number {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b6cff) 55%, transparent);
    border-radius: 50%;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 18%,
      transparent
    );
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
  }

  .field-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .relationship-layout .field-label {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
  }

  .field-help {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .field-control {
    display: flex;
    min-width: 0;
  }

  .driver-control {
    width: 100%;
  }

  .relationship-layout .driver-control {
    padding-block: 8px;
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

    .transform-picker.embedded.relationship-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @container fuse (min-width: 1181px) and (max-width: 1679px) and (min-height: 780px) {
    .relationship-layout .field,
    .relationship-layout .transform-options {
      padding: 10px;
    }

    .relationship-layout .field-help,
    .relationship-layout .transform-options :global(.option-label) {
      display: none;
    }

    .relationship-layout .driver-control {
      margin-block: auto;
      padding-block: 4px;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .relationship-layout .field,
    .relationship-layout .transform-options {
      padding: 20px;
    }

    .step-number {
      width: 36px;
      height: 36px;
    }
  }
</style>
