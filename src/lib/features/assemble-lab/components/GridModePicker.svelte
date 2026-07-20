<!--
  GridModePicker.svelte - Grid mode pills + center toggle.
  Used in both the assemble flow and the orientation explainer.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

  let {
    gridMode,
    showCenter,
    disabled = false,
    onGridModeChange,
    onCenterChange,
  }: {
    gridMode: GridMode;
    showCenter: boolean;
    disabled?: boolean;
    onGridModeChange: (mode: GridMode) => void;
    onCenterChange: (show: boolean) => void;
  } = $props();

  const MODES: { value: GridMode; label: string }[] = [
    { value: GridMode.DIAMOND, label: "Diamond" },
    { value: GridMode.BOX, label: "Box" },
    { value: GridMode.SKEWED, label: "Merged" },
  ];
</script>

<div class="grid-mode-picker" class:disabled>
  <div class="mode-segment">
    <SegmentedControl
      options={MODES}
      value={gridMode}
      onchange={(mode) => onGridModeChange(mode)}
      size="sm"
      color="accent"
    />
  </div>

  <FilterChipBase
    label="Center"
    mode="toggle"
    size="sm"
    emphasis="solid"
    active={showCenter}
    {disabled}
    onclick={() => onCenterChange(!showCenter)}
  />
</div>

<style>
  .grid-mode-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .grid-mode-picker.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .mode-segment {
    /* Cap the segmented control so the trio of mode labels stays compact
       and the + Center chip can sit beside it instead of stretching full-width. */
    flex: 0 1 auto;
    min-width: 220px;
  }
</style>
