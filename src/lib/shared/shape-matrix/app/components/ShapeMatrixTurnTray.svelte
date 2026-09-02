<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnTray.svelte
  Compact detail turn editor. The trigger names the pair by its two hand
  turns (blue left, red right); it opens the shared Drawer holding the
  canonical turn controls plus the notation toggle. An edit here stays on
  the detail pane, so the animator restages under the user's eyes and the
  matrix is already rebuilt when they go back. -->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
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

<button
  type="button"
  class="turn-trigger"
  aria-label={triggerLabel}
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={() => (open = true)}
>
  <span class="level">L{appState.level}</span>
  <span class="hand blue" aria-hidden="true">{leftVisible}</span>
  <span class="divider" aria-hidden="true">·</span>
  <span class="hand red" aria-hidden="true">{rightVisible}</span>
  <i class="fas fa-sliders" aria-hidden="true"></i>
</button>

<Drawer
  isOpen={open}
  placement="bottom"
  closeOnBackdrop={true}
  closeOnEscape={true}
  dismissible={true}
  showHandle={true}
  ariaLabel="Edit turns"
  class="shape-matrix-turn-drawer"
  onOpenChange={(next) => {
    open = next;
  }}
>
  <div class="tray">
    <DrawerHeader
      title="Turns"
      subtitle="Left is blue, right is red. The pair restages here; the matrix follows."
      onClose={() => (open = false)}
    />
    <div class="tray-body">
      <div class="notation">
        <span class="notation-label">Notation</span>
        <SegmentedControl
          options={LABEL_OPTIONS}
          value={appState.labelMode}
          onchange={(mode: MatrixLabelMode) => appState.setLabelMode(mode)}
          size="sm"
          density="tight"
          color="accent"
          semantics="radiogroup"
          ariaLabel="Turn label system"
        />
      </div>
      <ShapeMatrixTurnControls layout="tray" onturn={applyTurn} />
    </div>
  </div>
</Drawer>

<style>
  .turn-trigger {
    display: inline-flex;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    flex: 0 1 auto;
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

  .tray {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    max-height: min(80vh, 40rem);
  }

  .tray-body {
    display: grid;
    gap: 0.75rem;
    padding: 0 1.25rem 1.25rem;
    overflow-y: auto;
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
    .turn-trigger {
      transition: none;
    }
  }
</style>
