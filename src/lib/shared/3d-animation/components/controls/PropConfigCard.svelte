<script lang="ts">
  /**
   * PropConfigCard - Motion configuration panel for a single prop
   *
   * Composes primitive controls into a cohesive configuration interface.
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   */

  import type { MotionConfig3D } from "../../domain/models/MotionData3D";
  import { MOTION_PRESETS } from "../../domain/models/MotionData3D";
  import {
    PLANE_OPTIONS,
    MOTION_TYPE_OPTIONS,
    DIRECTION_OPTIONS,
    ORIENTATION_OPTIONS,
  } from "../../config/motion-options";
  import CardHeader from "./CardHeader.svelte";
  import IconButton from "./IconButton.svelte";
  import LabeledSection from "./LabeledSection.svelte";
  import PositionPairSelector from "./PositionPairSelector.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import TurnsStepper from "./TurnsStepper.svelte";
  import PresetButtonGroup from "./PresetButtonGroup.svelte";

  interface Props {
    color: "blue" | "red";
    config: MotionConfig3D;
    visible: boolean;
    onConfigChange: (config: MotionConfig3D) => void;
    onVisibilityChange: (visible: boolean) => void;
  }

  let { color, config, visible, onConfigChange, onVisibilityChange }: Props =
    $props();

  // Use semantic prop colors from CSS variables - derived from prop
  const colorLabel = $derived(color === "blue" ? "Blue" : "Red");

  function updateConfig(partial: Partial<MotionConfig3D>) {
    onConfigChange({ ...config, ...partial });
  }

  function applyPreset(presetName: string) {
    const preset = MOTION_PRESETS[presetName];
    if (preset) updateConfig(preset);
  }
</script>

<div
  class="config-card"
  class:blue={color === "blue"}
  class:red={color === "red"}
>
  <CardHeader title={colorLabel} {color}>
    {#snippet action()}
      <IconButton
        icon={visible ? "fas fa-eye" : "fas fa-eye-slash"}
        label={visible ? "Hide prop" : "Show prop"}
        dimmed={!visible}
        onclick={() => onVisibilityChange(!visible)}
      />
    {/snippet}
  </CardHeader>

  <div class="card-body">
    <SegmentedControl
      options={PLANE_OPTIONS}
      value={config.plane}
      onchange={(v) => updateConfig({ plane: v })}
      {color}
    />

    <PositionPairSelector
      startValue={config.startLocation}
      endValue={config.endLocation}
      onStartChange={(loc) => updateConfig({ startLocation: loc })}
      onEndChange={(loc) => updateConfig({ endLocation: loc })}
      {color}
    />

    <LabeledSection label="Motion">
      <SegmentedControl
        options={MOTION_TYPE_OPTIONS}
        value={config.motionType}
        onchange={(v) => updateConfig({ motionType: v })}
        {color}
      />
    </LabeledSection>

    <div class="row">
      <LabeledSection label="Direction">
        <SegmentedControl
          options={DIRECTION_OPTIONS}
          value={config.rotationDirection}
          onchange={(v) => updateConfig({ rotationDirection: v })}
          {color}
          size="sm"
        />
      </LabeledSection>

      <TurnsStepper
        label="Turns"
        value={config.turns}
        onchange={(v) => updateConfig({ turns: v })}
        {color}
      />
    </div>

    <div class="row">
      <LabeledSection label="Start Ori">
        <SegmentedControl
          options={ORIENTATION_OPTIONS}
          value={config.startOrientation}
          onchange={(v) => updateConfig({ startOrientation: v })}
          {color}
          size="sm"
        />
      </LabeledSection>

      <LabeledSection label="End Ori">
        <SegmentedControl
          options={ORIENTATION_OPTIONS}
          value={config.endOrientation}
          onchange={(v) => updateConfig({ endOrientation: v })}
          {color}
          size="sm"
        />
      </LabeledSection>
    </div>

    <PresetButtonGroup
      presets={Object.keys(MOTION_PRESETS)}
      onSelect={applyPreset}
      {color}
    />
  </div>
</div>

<style>
  .config-card {
    container-type: inline-size;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .config-card.blue {
    border-left: 3px solid var(--prop-blue);
  }

  .config-card.red {
    border-left: 3px solid var(--prop-red);
  }

  .card-body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  @container (min-width: 320px) {
    .row {
      flex-direction: row;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .row > :global(*) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
