<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnPopover.svelte
  Compact detail level and turn editor. The trigger shows the level as the
  shared difficulty badge and the pair's two hand turns (blue left, red
  right); it opens a popover anchored under it that holds the level
  selector, the notation toggle, and the canonical turn controls, sized to
  those controls and nothing more. An edit here stays on the detail pane,
  so the animator restages under the user's eyes and the matrix is already
  rebuilt when they go back. -->
<script lang="ts">
  import { Popover } from "bits-ui";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import {
    matrixTurnSpokenLabel,
    matrixTurnVisibleLabel,
    type MatrixLabelMode,
  } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import type {
    TurnLevel,
    TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import {
    SHAPE_MATRIX_LEVELS,
    SHAPE_MATRIX_LEVEL_DESCRIPTIONS,
  } from "../shape-matrix-levels";
  import { THEORY_LEVEL_DESCRIPTIONS } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import { spinRatioKey } from "@vtg/domain";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixTheoryControls from "./ShapeMatrixTheoryControls.svelte";
  import ShapeMatrixTurnControls from "./ShapeMatrixTurnControls.svelte";

  const appState = getShapeMatrixAppContext();
  let open = $state(false);

  /* One chip for both surfaces. What it edits changes with the surface; that
     it is the way into level and axis values does not. */
  const theory = $derived(appState.surface === "theory");
  const levelDescriptions = $derived(
    theory ? THEORY_LEVEL_DESCRIPTIONS : SHAPE_MATRIX_LEVEL_DESCRIPTIONS
  );

  const LABEL_OPTIONS = [
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
  ];

  function visible(turn: TurnValue): string {
    return matrixTurnVisibleLabel(turn, appState.labelMode);
  }
  function spoken(turn: TurnValue): string {
    return matrixTurnSpokenLabel(turn, appState.labelMode);
  }

  const leftVisible = $derived(
    theory ? spinRatioKey(appState.theoryLeftRatio) : visible(appState.leftTurn)
  );
  const rightVisible = $derived(
    theory
      ? spinRatioKey(appState.theoryRightRatio)
      : visible(appState.rightTurn)
  );
  const triggerLabel = $derived(
    theory
      ? `Edit level, ratios, timing and direction. Level ${appState.level}. Left ${leftVisible}, right ${rightVisible}.`
      : `Edit level and turns. Level ${appState.level}. Left ${spoken(appState.leftTurn)}, right ${spoken(appState.rightTurn)}.`
  );
  const popoverTitle = $derived(
    theory ? "Level and ratios" : "Level and turns"
  );

  function applyTurn(turn: TurnValue): void {
    appState.setTurn(turn, { stayOnDetail: true });
  }
  function applyLevel(level: TurnLevel): void {
    appState.setLevel(level, { stayOnDetail: true });
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="turn-trigger"
        aria-label={triggerLabel}
      >
        <DifficultyBadge level={appState.level} size="1.5rem" />
        <span class="hand blue" aria-hidden="true">{leftVisible}</span>
        <span class="divider" aria-hidden="true">·</span>
        <span class="hand red" aria-hidden="true">{rightVisible}</span>
        <i class="fas fa-sliders" aria-hidden="true"></i>
      </button>
    {/snippet}
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Content
      side="bottom"
      align="start"
      sideOffset={6}
      avoidCollisions={true}
      collisionPadding={8}
      forceMount
    >
      {#snippet child({ open: contentOpen, wrapperProps, props })}
        <div {...wrapperProps}>
          {#if contentOpen}
            <div
              {...props}
              class="turn-popover themed-scrollbar"
              role="dialog"
              aria-label={popoverTitle}
              transition:flyFade={{ y: -6, duration: DURATION.normal }}
            >
              <div class="popover-head">
                <span class="popover-title">{popoverTitle}</span>
                <button
                  type="button"
                  class="popover-close"
                  aria-label="Close level and turn editor"
                  onclick={() => (open = false)}
                >
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
              <div class="level-row">
                <span class="row-label">Level</span>
                <LevelSelector
                  value={appState.level}
                  levels={SHAPE_MATRIX_LEVELS}
                  describe={(level) => levelDescriptions[level]}
                  onchange={applyLevel}
                  compact={true}
                  ariaLabel="Kinetic Alphabet level"
                />
              </div>
              {#if theory}
                <ShapeMatrixTheoryControls layout="tray" />
              {:else}
                <div class="notation">
                  <span class="row-label">Notation</span>
                  <SegmentedControl
                    options={LABEL_OPTIONS}
                    value={appState.labelMode}
                    onchange={(mode: MatrixLabelMode) =>
                      appState.setLabelMode(mode)}
                    size="sm"
                    density="tight"
                    color="accent"
                    semantics="radiogroup"
                    ariaLabel="Turn label system"
                  />
                </div>
                <ShapeMatrixTurnControls layout="tray" onturn={applyTurn} />
              {/if}
            </div>
          {/if}
        </div>
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  .turn-trigger {
    display: inline-flex;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition:
      border-color var(--duration-fast, 150ms) var(--transition-easing, ease),
      background var(--duration-fast, 150ms) var(--transition-easing, ease);
  }

  .turn-trigger:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 8%,
      transparent
    );
  }

  .turn-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .hand {
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
  }

  .hand.blue {
    background: color-mix(
      in srgb,
      var(--dm-motion-blue, #3575e2) 24%,
      transparent
    );
    color: color-mix(in srgb, var(--dm-motion-blue, #3575e2) 55%, #fff);
  }

  .hand.red {
    background: color-mix(
      in srgb,
      var(--dm-motion-red, #e2353f) 24%,
      transparent
    );
    color: color-mix(in srgb, var(--dm-motion-red, #e2353f) 55%, #fff);
  }

  .divider {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.4));
  }

  .turn-trigger i {
    color: var(--theme-accent, #f59e0b);
    font-size: 0.8em;
  }

  /* Sized to the controls it holds; the viewport only caps it. */
  .turn-popover {
    display: grid;
    width: max-content;
    max-width: var(
      --bits-popover-content-available-width,
      calc(100vw - 16px)
    );
    max-height: var(
      --bits-popover-content-available-height,
      calc(100dvh - 16px)
    );
    gap: 0.55rem;
    padding: 0.4rem 0.6rem 0.7rem;
    border: 1px solid var(--theme-stroke-strong, rgb(255 255 255 / 0.18));
    border-radius: 12px;
    background-color: var(--theme-bg-deep, #0a0f17);
    background-image: linear-gradient(
      var(--theme-panel-bg, #101721),
      var(--theme-panel-bg, #101721)
    );
    box-shadow: 0 16px 42px var(--theme-shadow, rgb(0 0 0 / 0.42));
    overflow: auto;
    overscroll-behavior: contain;
    outline: none;
    transform-origin: var(--bits-popover-content-transform-origin, top left);
    z-index: var(--z-dropdown, 1000);
  }

  .popover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .popover-title {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .popover-close {
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    margin-inline-end: -0.3rem;
    padding: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    cursor: pointer;
    font: inherit;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .popover-close:hover {
    border-color: var(--theme-stroke-strong, rgb(255 255 255 / 0.2));
    background: var(--theme-card-hover-bg, rgb(255 255 255 / 0.08));
    color: var(--theme-text, #fff);
  }

  .popover-close:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .level-row,
  .notation {
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }

  .notation :global(.segmented-control) {
    width: 9rem;
  }

  .row-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .turn-trigger,
    .popover-close {
      transition: none;
    }
  }
</style>
