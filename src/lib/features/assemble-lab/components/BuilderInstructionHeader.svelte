<!--
  Assemble's desktop control header. The instruction, grid, active hand,
  keyboard input, orientation, and motion settings share one glass surface.
-->
<script lang="ts">
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import { getBuilderPhaseInstruction } from "../services/builder-phase-presentation";
  import BuilderHandPicker from "./BuilderHandPicker.svelte";
  import BuilderKeyboardControl from "./BuilderKeyboardControl.svelte";
  import BuilderTurnBar from "./BuilderTurnBar.svelte";
  import GridModePicker from "./GridModePicker.svelte";

  let { builderState }: { builderState: AssembleState } = $props();

  const isBlueHand = $derived(builderState.activeHand === MotionColor.BLUE);
  const activeHandLabel = $derived(isBlueHand ? "Blue hand" : "Red hand");
  const otherHandLabel = $derived(isBlueHand ? "Red" : "Blue");
  const otherHandSteps = $derived(
    isBlueHand ? builderState.redSteps.length : builderState.blueSteps.length
  );
  const activeStepCount = $derived(
    isBlueHand ? builderState.blueSteps.length : builderState.redSteps.length
  );
  const phaseMessage = $derived(getBuilderPhaseInstruction(builderState.phase));
  const controlsDisabled = $derived(builderState.phase === "complete");

  const otherHandHint = $derived.by(() => {
    if (builderState.phase === "complete" || builderState.phase === "idle") {
      return "";
    }
    if (otherHandSteps === 0 && activeStepCount > 0) {
      return `Switch to ${otherHandLabel} when ready`;
    }
    if (otherHandSteps > 0 && activeStepCount > otherHandSteps) {
      const difference = activeStepCount - otherHandSteps;
      return `${otherHandLabel} needs ${difference} more step${difference === 1 ? "" : "s"}`;
    }
    return "";
  });
</script>

<section class="control-header" aria-label="Assemble controls">
  <div class="primary-row">
    <div class="instruction-block" aria-live="polite" aria-atomic="true">
      <span class="active-hand" class:blue={isBlueHand} class:red={!isBlueHand}>
        {activeHandLabel}
      </span>
      <strong class="instruction">{phaseMessage}</strong>
      <span class="hand-hint" class:empty={!otherHandHint}>
        {otherHandHint || "\u00A0"}
      </span>
    </div>

    <div class="control-cell grid-control">
      <span class="control-label">Grid</span>
      <GridModePicker
        gridMode={builderState.gridMode}
        showCenter={builderState.showCenter}
        disabled={!builderState.canChangeGridMode}
        onGridModeChange={(mode) => builderState.setGridMode(mode)}
        onCenterChange={(show) => builderState.setShowCenter(show)}
      />
    </div>

    <div class="control-cell hand-control">
      <span class="control-label">Hand</span>
      <BuilderHandPicker
        activeHand={builderState.activeHand}
        blueCount={builderState.blueSteps.length}
        redCount={builderState.redSteps.length}
        disabled={controlsDisabled}
        onchange={(hand) => builderState.switchToHand(hand)}
      />
    </div>

    <div class="control-cell input-control">
      <span class="control-label">Input</span>
      <BuilderKeyboardControl {builderState} />
    </div>
  </div>

  <div class="motion-row">
    <BuilderTurnBar {builderState} />
  </div>
</section>

<style>
  .control-header {
    width: min(100%, 1040px);
    margin-inline: auto;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 16px);
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--theme-panel-bg, rgba(14, 18, 28, 0.88)) 86%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--theme-accent, #8b6cff) 7%,
        var(--theme-panel-bg, rgba(14, 18, 28, 0.82))
      )
    );
    box-shadow:
      0 16px 36px color-mix(in srgb, var(--theme-shadow, #000) 24%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(22px) saturate(145%);
    -webkit-backdrop-filter: blur(22px) saturate(145%);
  }

  .primary-row {
    display: grid;
    grid-template-columns: minmax(190px, 1fr) auto auto auto;
    align-items: end;
    gap: 10px;
    min-width: 0;
  }

  .instruction-block {
    align-self: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 2px 4px;
  }

  .active-hand {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
  }

  .active-hand.blue {
    color: color-mix(in srgb, var(--prop-blue, #2e8bf0) 76%, white);
  }

  .active-hand.red {
    color: color-mix(in srgb, var(--prop-red, #ed1c24) 76%, white);
  }

  .instruction {
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: clamp(14px, 1.5cqi, 17px);
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hand-hint {
    min-height: 16px;
    overflow: hidden;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: opacity var(--duration-fast, 150ms) ease;
  }

  .hand-hint.empty {
    opacity: 0;
  }

  .control-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .control-label {
    padding-left: 4px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .grid-control {
    width: 300px;
  }

  .hand-control {
    width: 180px;
  }

  .input-control {
    width: max-content;
  }

  .motion-row {
    margin-top: 9px;
    padding-top: 9px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.09));
  }

  @container tool-panel (max-width: 920px) {
    .primary-row {
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: end;
    }

    .instruction-block {
      grid-column: 1 / -1;
      align-items: center;
      text-align: center;
    }

    .grid-control {
      width: auto;
    }
  }

  @container tool-panel (max-width: 768px) {
    .control-header {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-hint {
      transition: none;
    }
  }
</style>
