<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnPopover.svelte
  Compact detail turn editor. The trigger names the pair by its two hand
  turns (blue left, red right); it opens a popover anchored under it that
  holds the canonical turn controls plus the notation toggle, sized to
  those controls and nothing more. An edit here stays on the detail pane,
  so the animator restages under the user's eyes and the matrix is already
  rebuilt when they go back. -->
<script lang="ts">
  import { Popover } from "bits-ui";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { ratioLabel } from "$lib/shared/shape-matrix/domain/flower-signature";
  import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import type { TurnValue } from "$lib/shared/create/services/level-turn-values";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixTurnControls from "./ShapeMatrixTurnControls.svelte";

  const appState = getShapeMatrixAppContext();
  let open = $state(false);

  const LABEL_OPTIONS = [
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
  ];

  function visible(turn: TurnValue): string {
    if (turn === "fl") return "Float";
    return appState.labelMode === "ratios" ? ratioLabel(turn) : String(turn);
  }
  function spoken(turn: TurnValue): string {
    if (turn === "fl") return "Float";
    return appState.labelMode === "ratios"
      ? `${ratioLabel(turn)} ratio`
      : `${turn} turn${turn === 1 ? "" : "s"}`;
  }

  const leftVisible = $derived(visible(appState.leftTurn));
  const rightVisible = $derived(visible(appState.rightTurn));
  const triggerLabel = $derived(
    `Edit turns. Level ${appState.level}. Left ${spoken(appState.leftTurn)}, right ${spoken(appState.rightTurn)}.`
  );

  function applyTurn(turn: TurnValue): void {
    appState.setTurn(turn, { stayOnDetail: true });
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
        <span class="level">L{appState.level}</span>
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
              aria-label="Edit turns"
              transition:flyFade={{ y: -6, duration: DURATION.normal }}
            >
              <div class="popover-head">
                <span class="popover-title">Turns</span>
                <button
                  type="button"
                  class="popover-close"
                  aria-label="Close turn editor"
                  onclick={() => (open = false)}
                >
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
              <div class="notation">
                <span class="notation-label">Notation</span>
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

  .level {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-weight: 650;
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

  .notation {
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }

  .notation :global(.segmented-control) {
    width: 9rem;
  }

  .notation-label {
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
