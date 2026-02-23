<!--
  BuilderControls.svelte - Unified controls for the visual builder

  Shows: phase indicator, hand label, orientation picker, rotation direction,
  turn count, Done button, Undo button. Compact single-row toolbar.
-->
<script lang="ts">
  import {
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { VisualBuilderState } from "../state/visual-builder-state.svelte";

  let { builderState }: { builderState: VisualBuilderState } = $props();

  const handLabel = $derived(
    builderState.activeHand === MotionColor.BLUE ? "Blue" : "Red"
  );

  const handColor = $derived(
    builderState.activeHand === MotionColor.BLUE ? "var(--prop-blue, #2e8bf0)" : "var(--prop-red, #ed1c24)"
  );

  const phaseMessage = $derived.by(() => {
    switch (builderState.phase) {
      case "idle": return `Click to place ${handLabel.toLowerCase()} prop`;
      case "placing": return `Click destination for ${handLabel.toLowerCase()}`;
      case "building": return `Click next point or Done`;
      case "animating": return "Animating...";
      case "done": return `${handLabel} path locked`;
      case "complete": return "Sequence complete";
      default: return "";
    }
  });

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "In" },
    { value: Orientation.OUT, label: "Out" },
    { value: Orientation.CLOCK, label: "CW" },
    { value: Orientation.COUNTER, label: "CCW" },
  ] as const;

  const TURN_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

  function toggleRotation(): void {
    const next = builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
    builderState.setRotationDirection(next);
  }
</script>

<div class="builder-controls">
  <!-- Phase indicator with hand color -->
  <div class="phase-badge" style="--hand-color: {handColor}">
    <span class="hand-dot" style="background: {handColor}"></span>
    <span class="phase-text">{phaseMessage}</span>
  </div>

  <!-- Controls row — only shown when actively building -->
  {#if builderState.phase === "placing" || builderState.phase === "building"}
    <div class="controls-row">
      <!-- Orientation (only on first placement) -->
      {#if builderState.phase === "placing"}
        <div class="control-group">
          <span class="control-label">Ori</span>
          <div class="pill-group" role="radiogroup" aria-label="Starting orientation">
            {#each ORIENTATIONS as ori}
              <button
                class="pill"
                class:active={builderState.currentOrientation === ori.value}
                role="radio"
                aria-checked={builderState.currentOrientation === ori.value}
                aria-label="{ori.label} orientation"
                onclick={() => builderState.setOrientation(ori.value)}
              >
                {ori.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Rotation direction -->
      <button
        class="icon-btn"
        onclick={toggleRotation}
        aria-label="Rotation: {builderState.rotationDirection === RotationDirection.CLOCKWISE ? 'Clockwise' : 'Counter-clockwise'}"
      >
        <i
          class="fas fa-rotate-right"
          class:flipped={builderState.rotationDirection === RotationDirection.COUNTER_CLOCKWISE}
        ></i>
        <span>{builderState.rotationDirection === RotationDirection.CLOCKWISE ? "CW" : "CCW"}</span>
      </button>

      <!-- Turn count -->
      <div class="control-group">
        <span class="control-label">Turns</span>
        <div class="pill-group" role="radiogroup" aria-label="Turn count">
          {#each TURN_OPTIONS as t}
            <button
              class="pill"
              class:active={builderState.turnCount === t}
              role="radio"
              aria-checked={builderState.turnCount === t}
              aria-label="{t} turns"
              onclick={() => builderState.setTurnCount(t)}
            >
              {t}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="actions">
    {#if builderState.canUndo}
      <button class="action-btn" onclick={() => builderState.undoStep()} aria-label="Undo last step">
        <i class="fas fa-undo"></i> Undo
      </button>
    {/if}

    {#if builderState.canFinishHand}
      <button
        class="done-btn"
        style="--hand-color: {handColor}"
        onclick={() => builderState.finishHand()}
        aria-label="Done with {handLabel.toLowerCase()} hand"
      >
        Done with {handLabel}
      </button>
    {/if}

    {#if builderState.phase === "complete"}
      <button class="new-btn" onclick={() => builderState.reset()} aria-label="Start new sequence">
        <i class="fas fa-plus"></i> New Sequence
      </button>
    {:else if builderState.stepCount > 0}
      <button class="action-btn danger" onclick={() => builderState.reset()} aria-label="Reset all">
        <i class="fas fa-trash-alt"></i>
      </button>
    {/if}
  </div>
</div>

<style>
  .builder-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    max-width: 700px;
  }

  .phase-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    min-height: 44px;
  }

  .hand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .phase-text {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
    font-weight: 500;
    white-space: nowrap;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-weight: 500;
  }

  .pill-group {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 6px;
    padding: 2px;
  }

  .pill {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .pill:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  }

  .pill.active {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 44px;
    transition: border-color 0.15s ease;
  }

  .icon-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .icon-btn i.flipped {
    transform: scaleX(-1);
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 44px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .action-btn:hover {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .done-btn {
    padding: 8px 18px;
    border: 1.5px solid var(--hand-color);
    border-radius: 8px;
    background: color-mix(in srgb, var(--hand-color) 15%, transparent);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: background 0.15s ease;
  }

  .done-btn:hover {
    background: color-mix(in srgb, var(--hand-color) 25%, transparent);
  }

  .new-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: background 0.15s ease;
  }

  .new-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn i { transition: none; }
    .pill,
    .icon-btn,
    .action-btn,
    .done-btn,
    .new-btn { transition: none; }
  }
</style>
