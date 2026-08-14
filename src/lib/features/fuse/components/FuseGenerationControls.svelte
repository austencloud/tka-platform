<script lang="ts">
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    GridMode,
    type GridMode as GridModeValue,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    maxTurnIntensitiesForLevel,
    type TurnLevel,
  } from "$lib/shared/create/services/level-turn-values";
  import { getFuseContext } from "../context/fuse-context";
  import FuseLengthPicker from "./FuseLengthPicker.svelte";

  let {
    layout = "header",
    showHelper = false,
  }: {
    layout?: "header" | "drawer";
    showHelper?: boolean;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const gridOptions = [
    { value: GridMode.DIAMOND, label: "Diamond" },
    { value: GridMode.BOX, label: "Box" },
  ];
  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );
  const maxTurnOptions = $derived.by(() => {
    return maxTurnIntensitiesForLevel(fuseState.generationLevel).map(
      (value) => ({
        value: String(value),
        label: `≤${value}`,
        ariaLabel: `Up to ${value} ${value === 1 ? "turn" : "turns"}`,
        disabled,
      })
    );
  });
  const selectedMaxTurn = $derived(String(fuseState.maxTurnIntensity));

  function selectLevel(level: TurnLevel): void {
    fuseState.setGenerationLevel(level);
  }

  function selectMaxTurn(value: string): void {
    fuseState.setMaxTurnIntensity(Number(value));
  }

  function selectGridMode(value: GridModeValue): void {
    fuseState.setGridMode(value);
  }
</script>

<div class="generation-controls" class:drawer={layout === "drawer"}>
  <div class="control-field length-field">
    <span class="control-label">Length</span>
    <FuseLengthPicker />
  </div>

  <div class="control-field level-field">
    <span class="control-label">Level</span>
    <LevelSelector
      value={fuseState.generationLevel}
      compact={true}
      onchange={selectLevel}
      ariaLabel="Generated path level"
      {disabled}
    />
  </div>

  <div class="control-field grid-field">
    <span class="control-label">Grid</span>
    <SegmentedControl
      options={gridOptions}
      value={fuseState.gridMode}
      onchange={selectGridMode}
      color="accent"
      size="sm"
      ariaLabel="Generated path grid"
      semantics="radiogroup"
    />
  </div>

  {#if fuseState.generationLevel > 1}
    <div class="control-field max-field">
      <span class="control-label">Max turns</span>
      <SegmentedControl
        options={maxTurnOptions}
        value={selectedMaxTurn}
        onchange={selectMaxTurn}
        color="accent"
        size="sm"
        ariaLabel="Maximum turn intensity"
        semantics="radiogroup"
      />
    </div>
  {/if}

  {#if showHelper}
    <p class="recipe-helper">
      Level sets the available motion types. Higher levels can also set a turn
      ceiling.
    </p>
  {/if}
</div>

<style>
  .generation-controls {
    display: flex;
    align-items: end;
    gap: var(--settings-spacing-sm, 10px);
    min-width: 0;
  }

  .control-field {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }

  .control-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    line-height: 1;
  }

  .level-field :global(.level-selector) {
    gap: 0.3rem;
  }

  .length-field {
    width: clamp(20rem, 23cqw, 27rem);
  }

  .grid-field {
    width: clamp(9rem, 10cqw, 12rem);
  }

  .max-field {
    width: clamp(15rem, 17cqw, 21rem);
  }

  .length-field :global(.segmented-control),
  .grid-field :global(.segmented-control),
  .max-field :global(.segmented-control) {
    width: 100%;
    font-variant-numeric: tabular-nums;
  }

  .generation-controls.drawer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--settings-spacing-md, 14px);
  }

  .drawer .length-field,
  .drawer .grid-field,
  .drawer .max-field {
    width: auto;
  }

  .recipe-helper {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.45;
  }

  @media (max-width: 560px) {
    .generation-controls.drawer {
      grid-template-columns: minmax(0, 1fr);
    }

    .recipe-helper {
      grid-column: 1;
    }
  }

  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .generation-controls:not(.drawer) {
      gap: 0.8rem;
    }

    .max-field {
      width: 24rem;
    }

    .length-field {
      width: 29rem;
    }

    .grid-field {
      width: 12rem;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .generation-controls:not(.drawer) {
      gap: 1rem;
    }

    .max-field {
      width: 31rem;
    }

    .length-field {
      width: 38rem;
    }

    .grid-field {
      width: 16rem;
    }

    .control-label {
      font-size: var(--font-size-compact, 16px);
    }
  }
</style>
