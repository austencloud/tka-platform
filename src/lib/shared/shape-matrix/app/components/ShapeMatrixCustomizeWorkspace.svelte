<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixCustomizeWorkspace.svelte
  Everything that changes how the animation plays, in one place over the grid
  pane. You are not choosing a shape while you tune its animation, so the grid
  is the one region that can be covered without losing anything you are
  watching: the hero, its relationships, the carousel and the dock stay put,
  and every change is judged against the live pair.

  The body is the canonical Animator inspector, the export sidebar's own
  grammar: a rail naming the four abilities (Effects, Props, Motion, Display)
  beside one page at a time, each page composed for a sidebar's width. The
  earlier overlay poured the dock tray's strips across a pane built for a
  grid, and every section read as a few controls adrift in an empty room.

  The dock under the animation and the rail here are two views of one
  section. A dock pill opens the workspace on its page, the rail moves the
  dock's highlight, and the highlighted pill closes it again. The way back to
  the grid is the same labelled button every time, plus Escape.

  Wide hosts only. Compact hosts show one pane at a time, so this pane is off
  screen while the dock is; the compact settings sheet and the canonical prop
  sheet take over there. -->
<script lang="ts">
  import { tick } from "svelte";
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import type { PillId } from "$lib/shared/animation-panel/pill-nav/pill-types";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { CANVAS2D_HOSTED_EFFECTS } from "$lib/shared/effects/services/canvas2d-effect-host";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { getShapeMatrixAnimationContext } from "../context/shape-matrix-animation-context";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /* Both surfaces stay mounted through the workspace transition, so the one
       that is showing owns the workspace. The other stays empty rather than
       registering a second Escape layer. */
    surface: "matrix" | "theory";
  }

  let { surface }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const animationState = getShapeMatrixAnimationContext();

  /* The dock's section is the workspace's page. A prop sheet left open on a
     compact host arrives here as the Props page when the host widens, so the
     request is honoured rather than stranded. */
  const section = $derived<PillId | null>(
    animationState.activeSection ?? (appState.propPickerOpen ? "props" : null)
  );
  const open = $derived(
    !appState.compact && appState.surface === surface && section !== null
  );

  const theoryEffects = ["trails", ...CANVAS2D_HOSTED_EFFECTS] as const;
  let backButton = $state<HTMLButtonElement | null>(null);

  function close(): void {
    appState.closePropPicker();
    animationState.showRelationships();
  }

  /* The rail's choice becomes the dock's, so the two never disagree. */
  function selectSection(next: PillId | null): void {
    if (next === null) {
      close();
      return;
    }
    appState.closePropPicker();
    animationState.setActiveSection(next);
  }

  function onKeydown(event: KeyboardEvent): void {
    // Focus inside a non-modal dialog owns the first Escape; the global
    // shortcut defers to it, so it is answered here.
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  $effect(() => {
    if (!open) return;

    const restoreTo = document.activeElement;
    const unregister = getEscapeLayerManager().register({
      id: `shape-matrix:${surface}-customize`,
      canDismiss: () => true,
      dismiss: close,
    });
    // Focus lands on the way back, not deep inside a page: the workspace
    // opened from a dock pill, and the next Tab reaches the rail.
    void tick().then(() => backButton?.focus({ preventScroll: true }));

    return () => {
      unregister();
      if (restoreTo instanceof HTMLElement && restoreTo.isConnected) {
        restoreTo.focus({ preventScroll: true });
      }
    };
  });
</script>

{#if open}
  <div
    class="customize-workspace"
    role="dialog"
    aria-label="Customize the animation"
    tabindex="-1"
    onkeydown={onKeydown}
    transition:flyFade={{ y: 8 }}
  >
    <header class="workspace-header">
      <PanelButton bind:ref={backButton} onclick={close}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back to grid</span>
      </PanelButton>
      <div class="workspace-title">
        <h2>Customize the animation</h2>
        <p>Every change plays live on the right, on the pair you chose.</p>
      </div>
    </header>
    <div class="workspace-body">
      <AnimationPanel
        isExporting={false}
        layout="sidebar"
        controlledSection={section}
        onActiveSectionChange={selectSection}
        isPlaying={animationState.playing}
        bpm={animationState.bpm}
        playbackMode={animationState.playbackMode}
        onPlaybackToggle={animationState.togglePlaying}
        onPlaybackModeChange={animationState.setPlaybackMode}
        onBpmChange={animationState.setBpm}
        showEffectsPlayback={false}
        selectedPropType={appState.propType}
        onPropChange={(propType) => void appState.setPropType(propType)}
        showPathShape={false}
        showMotionVisibility={true}
        showSequenceMarks={surface !== "theory"}
        availableEffects={surface === "theory" ? theoryEffects : undefined}
        regionLabel="Animation settings"
      />
    </div>
  </div>
{/if}

<style>
  .customize-workspace {
    position: absolute;
    inset: 0;
    /* Above the grid's sticky headers and corner. */
    z-index: 20;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    /* The theme panel color may be translucent. The semantic floor guarantees
       that grid labels cannot show through the workspace. */
    background:
      linear-gradient(
        var(--theme-panel-bg, rgb(16 23 33 / 0.96)),
        var(--theme-panel-bg, rgb(16 23 33 / 0.96))
      ),
      var(--theme-bg-deep, #0a0f14);
    color: var(--theme-text, #fff);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
  }

  .workspace-header :global(.panel-btn) {
    flex: 0 0 auto;
  }

  .workspace-title {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .workspace-title h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .workspace-title p {
    margin: 0;
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
  }

  .workspace-body {
    min-width: 0;
    min-height: 0;
  }

  /* The inspector draws itself as a sidebar: its own panel colour and a rule
     down its left edge. Here it is the whole pane, on the pane's own surface. */
  .workspace-body :global(.animator-inspector) {
    border-left: 0;
    background: transparent;
  }

  /* The sidebar floats a short page mid-column. On a pane this tall that
     strands the page far below its rail item and the header; the screen
     reads top-down, so every page starts under the header. */
  .workspace-body :global(.panel-center-inner) {
    margin-block: 0 auto;
  }
</style>
