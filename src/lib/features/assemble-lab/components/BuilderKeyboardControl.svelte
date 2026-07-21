<script lang="ts">
  import { Popover } from "bits-ui";
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import {
    ASSEMBLE_NUMPAD_POSITIONS,
    isAssembleKeyboardLocationAvailable,
  } from "../services/assemble-keyboard-handler";

  let { builderState }: { builderState: AssembleState } = $props();

  let guideOpen = $state(false);

  const handLabel = $derived(
    builderState.activeHand === MotionColor.BLUE ? "Blue hand" : "Red hand"
  );
  const rotationLabel = $derived(
    builderState.rotationDirection === RotationDirection.CLOCKWISE
      ? "CW"
      : "CCW"
  );
  const turnLabel = $derived(
    builderState.turnCount === -0.5
      ? "Float"
      : `${builderState.turnCount} turn${builderState.turnCount === 1 ? "" : "s"}`
  );
  const gridLabel = $derived.by(() => {
    switch (builderState.gridMode) {
      case GridMode.BOX:
        return "Box";
      case GridMode.SKEWED:
        return "Merged";
      default:
        return "Diamond";
    }
  });

  function toggleKeyboardMode(): void {
    const enabling = !builderState.keyboardMode;
    builderState.toggleKeyboardMode();
    guideOpen = enabling;
  }
</script>

<div class="keyboard-control">
  <button
    type="button"
    class="mode-button"
    class:active={builderState.keyboardMode}
    aria-pressed={builderState.keyboardMode}
    aria-label={builderState.keyboardMode
      ? "Turn off numpad building"
      : "Turn on numpad building"}
    onclick={toggleKeyboardMode}
  >
    <i class="fas fa-keyboard" aria-hidden="true"></i>
    <span>Numpad</span>
    <span class="mode-state">{builderState.keyboardMode ? "On" : "Off"}</span>
  </button>

  <Popover.Root bind:open={guideOpen}>
    <Popover.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          class="guide-button"
          aria-label="Show numpad controls"
          title="Numpad controls"
        >
          <i class="fas fa-question" aria-hidden="true"></i>
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        class="keyboard-guide-panel"
        aria-label="Numpad controls"
      >
        <div class="guide-heading">
          <div>
            <strong>Build with the numpad</strong>
            <span>Number keys match the points on the grid.</span>
          </div>
          <span class="current-settings">
            {handLabel} / {rotationLabel} / {turnLabel}
          </span>
        </div>

        <div class="guide-layout">
          <section
            class="position-guide"
            aria-labelledby="position-guide-title"
          >
            <h3 id="position-guide-title">Pick the next point</h3>
            <div class="numpad-grid">
              {#each ASSEMBLE_NUMPAD_POSITIONS as position}
                {@const available = isAssembleKeyboardLocationAvailable(
                  position.location,
                  builderState.gridMode,
                  builderState.showCenter
                )}
                <div class="position-key" class:unavailable={!available}>
                  <kbd>{position.key}</kbd>
                  <span>{position.label}</span>
                </div>
              {/each}
            </div>
            <p>{gridLabel} points are bright. Unavailable keys are dimmed.</p>
          </section>

          <section class="action-guide" aria-labelledby="action-guide-title">
            <h3 id="action-guide-title">Shape the move</h3>
            <dl>
              <div>
                <dt><kbd>+</kbd><kbd>−</kbd></dt>
                <dd>Turns</dd>
              </div>
              <div>
                <dt><kbd>*</kbd></dt>
                <dd>Direction</dd>
              </div>
              <div>
                <dt><kbd>/</kbd></dt>
                <dd>Orientation</dd>
              </div>
              <div>
                <dt><kbd>0</kbd></dt>
                <dd>Switch hand</dd>
              </div>
              <div>
                <dt><kbd>.</kbd></dt>
                <dd>Undo</dd>
              </div>
              <div>
                <dt><kbd>Enter</kbd></dt>
                <dd>Complete hand</dd>
              </div>
            </dl>
          </section>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
</div>

<style>
  .keyboard-control {
    display: flex;
    align-items: stretch;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(15, 18, 28, 0.84)) 78%,
      transparent
    );
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  .mode-button,
  .guide-button {
    min-height: var(--min-touch-target, 44px);
    border: 1px solid transparent;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .mode-button {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: calc(var(--settings-radius-md, 12px) - 3px);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .mode-button.active {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 52%,
      transparent
    );
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #8b6cff) 26%, transparent),
      color-mix(in srgb, var(--theme-accent, #8b6cff) 10%, transparent)
    );
    color: var(--theme-text, #fff);
  }

  .mode-state {
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .active .mode-state {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 30%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  .guide-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    padding: 0;
    border-radius: calc(var(--settings-radius-md, 12px) - 3px);
  }

  .mode-button:hover,
  .guide-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  .mode-button:focus-visible,
  .guide-button:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  :global(.keyboard-guide-panel) {
    width: min(600px, calc(100vw - 24px));
    padding: 14px;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    border-radius: var(--settings-radius-lg, 16px);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #111520) 92%,
      transparent
    );
    box-shadow:
      0 22px 54px color-mix(in srgb, var(--theme-shadow, #000) 48%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    color: var(--theme-text, #fff);
    z-index: var(--z-dropdown, 100);
  }

  .guide-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 2px 2px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .guide-heading > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .guide-heading strong {
    font-size: 16px;
  }

  .guide-heading span,
  .position-guide p {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .current-settings {
    flex: 0 0 auto;
    padding: 5px 8px;
    border-radius: 8px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 14%,
      transparent
    );
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .guide-layout {
    display: grid;
    grid-template-columns: minmax(220px, 0.9fr) minmax(220px, 1.1fr);
    gap: 16px;
    padding-top: 12px;
  }

  .guide-layout h3 {
    margin: 0 0 8px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .numpad-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }

  .position-key {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 44px;
    padding: 5px 8px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b6cff) 34%, transparent);
    border-radius: 8px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 12%,
      transparent
    );
  }

  .position-key.unavailable {
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: transparent;
    opacity: 0.32;
  }

  .position-key span {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .position-guide p {
    margin: 7px 0 0;
    line-height: 1.35;
  }

  .action-guide dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
    margin: 0;
  }

  .action-guide dl > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    padding: 6px 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .action-guide dt {
    display: flex;
    gap: 3px;
  }

  .action-guide dd {
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-compact, 12px);
    text-align: right;
  }

  :global(.keyboard-guide-panel kbd) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    min-height: 28px;
    padding: 3px 6px;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, rgba(255, 255, 255, 0.08)) 82%,
      black
    );
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.22);
    color: var(--theme-text, #fff);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
  }

  @media (hover: none), (pointer: coarse) {
    .keyboard-control {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .guide-heading,
    .guide-layout {
      grid-template-columns: 1fr;
    }

    .guide-heading {
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-button,
    .guide-button {
      transition: none;
    }
  }
</style>
