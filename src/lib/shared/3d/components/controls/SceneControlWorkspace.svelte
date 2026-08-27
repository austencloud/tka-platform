<script lang="ts">
  import MobileSceneControls from "../MobileSceneControls.svelte";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import {
    resolveSceneControlLayout,
    type SceneControlLayout,
    type SceneControlTool,
  } from "../../domain/scene-control-layout";
  import type {
    ViewerActionSink,
    ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import { dockSlide } from "$lib/shared/transitions/dock-slide";
  import { createSheetDismiss } from "./sheet-dismiss";
  import SaveSceneModal from "$lib/features/scene-3d-collection/components/SaveSceneModal.svelte";
  import PerformerSpine from "./PerformerSpine.svelte";
  import SceneControlInspector from "./SceneControlInspector.svelte";
  import SceneControlRail from "./SceneControlRail.svelte";
  import type { PerformerEditSink } from "./performer-hub-types";

  interface Props {
    bpm?: number;
    onSettingChange?: ViewerControlSink;
    onAction?: ViewerActionSink;
    onLayoutChange?: (layout: SceneControlLayout) => void;
    showCompactPlayback?: boolean;
    isPlaying?: boolean;
    onPlaybackToggle?: () => void;
    onStepForward?: () => void;
    onStepBackward?: () => void;
    /** Leaves room for host-owned close/fullscreen controls above the rail. */
    topOffset?: string;
    /**
     * The same reservation, but for the top-LEFT corner alone, where the
     * performer bar pins itself. A host whose top band is occupied only on the
     * right — commands there, nothing over the corner — publishes a smaller
     * number here and lets the bar sit up in the corner while the inspector
     * still clears the chrome opposite it. Unset, the bar follows topOffset.
     */
    topLeftOffset?: string;
    /**
     * Leaves room for host-owned chrome below the rail, such as a transport.
     * Left unset, each surface keeps its own default sized for the sequence
     * viewer's bar.
     */
    bottomOffset?: string;
    /**
     * Leaves room for host-owned chrome in the stage's top-left corner, where
     * the performer bar sits. The Film Director's back-to-Films button lands
     * there; without this the bar renders underneath it.
     */
    leftOffset?: string;
    /**
     * Whether this host offers saving the live viewer state as a reusable look.
     * The Director turns it off: its artifact is the film document, and a
     * viewer snapshot taken there records one instant of a playing film with no
     * relationship to what is being authored.
     */
    allowSaveScene?: boolean;
    /** Forwarded to the performer tool — see PerformerHubDetail's Props. */
    onPerformerEdit?: PerformerEditSink;
    /** Fires with the tool being inspected, or null when the inspector closes. */
    onInspectorChange?: (tool: SceneControlTool | null) => void;
  }

  let {
    bpm,
    onSettingChange,
    onAction,
    onLayoutChange,
    showCompactPlayback = false,
    isPlaying = false,
    onPlaybackToggle,
    onStepForward,
    onStepBackward,
    topOffset = "12px",
    topLeftOffset,
    bottomOffset,
    leftOffset = "0.75rem",
    allowSaveScene = true,
    onPerformerEdit,
    onInspectorChange,
  }: Props = $props();

  let workspaceWidth = $state(0);
  let workspaceHeight = $state(0);
  let activeTool = $state<SceneControlTool | null>(null);
  let panelEl = $state<HTMLElement | null>(null);
  let saveSceneOpen = $state(false);
  const viewer = getViewer3DContext();

  function openSaveScene(): void {
    activeTool = null;
    saveSceneOpen = true;
  }
  const inspectorUsesDock = $derived(
    activeTool === "performer" || activeTool === "dev"
  );

  const layout = $derived(
    resolveSceneControlLayout(
      workspaceWidth,
      workspaceHeight,
      activeTool !== null,
      inspectorUsesDock
    )
  );

  function isModalTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest(
        "dialog, [role='dialog'], [role='alertdialog'], [data-dialog-content]"
      ) !== null
    );
  }

  function closeInspector(): void {
    activeTool = null;
  }

  const dismiss = createSheetDismiss(
    closeInspector,
    () => panelEl,
    isModalTarget
  );

  // activeTool moves from four places (rail selection, close, save-scene, and
  // the compact reset below), so the notification hangs off the value rather
  // than off each mutation site.
  let lastReportedTool: SceneControlTool | null = null;
  $effect(() => {
    const current = activeTool;
    if (current === lastReportedTool) return;
    lastReportedTool = current;
    onInspectorChange?.(current);
  });

  let lastLayoutSignature = "";
  $effect(() => {
    const current = layout;
    const signature = `${current.presentation}:${current.panelWidth}:${current.reservedWidth}`;
    if (signature === lastLayoutSignature) return;
    lastLayoutSignature = signature;
    onLayoutChange?.(current);
  });

  // A compact workspace has its own sheet state. Clearing the desktop tool
  // prevents a stale inspector from reopening when a split pane grows again.
  $effect(() => {
    if (layout.presentation === "compact") activeTool = null;
  });

  let dockWasOpen = false;
  $effect(() => {
    const dockIsOpen =
      layout.presentation === "docked" && layout.reservedWidth > 0;
    if (dockIsOpen !== dockWasOpen && workspaceHeight > 0) {
      const stageWidth = Math.max(
        1,
        workspaceWidth - (dockIsOpen ? layout.reservedWidth : 0)
      );
      viewer.frameAllPerformers(stageWidth / workspaceHeight, true);
    }
    dockWasOpen = dockIsOpen;
  });
</script>

<svelte:window
  onpointerdowncapture={(event) => {
    if (activeTool && layout.presentation === "overlay") {
      dismiss.onBackdropPointerDown(event);
    }
  }}
  onkeydown={(event) => {
    if (activeTool && !isModalTarget(event.target)) dismiss.onKeydown(event);
  }}
/>

<div
  class="scene-control-workspace"
  class:docked={layout.presentation === "docked"}
  class:overlay={layout.presentation === "overlay"}
  class:compact={layout.presentation === "compact"}
  bind:clientWidth={workspaceWidth}
  bind:clientHeight={workspaceHeight}
  data-scene-control-workspace
  data-presentation={layout.presentation}
  data-open={activeTool !== null || undefined}
  style:--scene-controls-top={topOffset}
  style:--scene-performer-bar-top={topLeftOffset ?? topOffset}
  style:--scene-controls-bottom={bottomOffset}
  style:--scene-controls-left={leftOffset}
  style:--scene-inspector-width="{layout.panelWidth}px"
  style:--scene-right-occupied={activeTool
    ? `calc(4.75rem + ${layout.panelWidth}px)`
    : "4.75rem"}
>
  {#if layout.presentation === "compact"}
    <div class="compact-controls">
      <MobileSceneControls
        showPlayback={showCompactPlayback}
        {isPlaying}
        {onPlaybackToggle}
        {onStepForward}
        {onStepBackward}
        {onSettingChange}
        {onPerformerEdit}
      />
    </div>
  {:else}
    <!-- Choosing who you are editing changes the 3D scene, not just a panel, so
         it lives beside the scene and stays put while tools come and go. The
         canvas already selects performers on click
         (Viewer3DScene's onPointerDown); this is the same act, reachable
         without hunting for a performer in the frame. -->
    <div class="performer-bar-anchor">
      <PerformerSpine {onSettingChange} />
    </div>

    <SceneControlRail
      renderMode="3d"
      {activeTool}
      {onSettingChange}
      {topOffset}
      {bottomOffset}
      onToolSelect={(tool) => (activeTool = tool)}
      onOpenSaveScene={allowSaveScene ? openSaveScene : undefined}
    />

    {#if activeTool}
      <div
        class="inspector-anchor"
        data-tool={activeTool}
        bind:this={panelEl}
        transition:dockSlide={{ duration: 280, distance: 24 }}
      >
        <SceneControlInspector
          tool={activeTool}
          onClose={closeInspector}
          {onSettingChange}
          {onPerformerEdit}
          onOpenSaveScene={allowSaveScene ? openSaveScene : undefined}
        />
      </div>
    {/if}
  {/if}
</div>

{#if allowSaveScene}
  <SaveSceneModal bind:open={saveSceneOpen} {bpm} {onSettingChange} {onAction} />
{/if}

<style>
  .scene-control-workspace {
    position: absolute;
    inset: 0;
    z-index: 20;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .scene-control-workspace :global(button),
  .scene-control-workspace :global([role="button"]),
  .scene-control-workspace :global([role="dialog"]),
  .inspector-anchor {
    pointer-events: auto;
  }

  /* Sits opposite the rail, clear of the inspector column when one is open, and
     content-sized so a solo scene shows two chips rather than an empty strip. */
  .performer-bar-anchor {
    position: absolute;
    top: var(--scene-performer-bar-top, var(--scene-controls-top, 0.75rem));
    left: var(--scene-controls-left, 0.75rem);
    z-index: 28;
    display: flex;
    max-width: calc(
      100% - var(--scene-controls-left, 0.75rem) -
        var(--scene-right-occupied, 4.75rem)
    );
    min-width: 0;
    padding: 0.5rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    background: var(--theme-panel-bg, #0c0e16);
    box-shadow: var(--theme-panel-shadow, 0 1.25rem 4rem rgba(0, 0, 0, 0.62));
    pointer-events: auto;
  }

  .performer-bar-anchor > :global(*) {
    min-width: 0;
  }

  .inspector-anchor {
    position: absolute;
    top: var(--scene-controls-top, 0.75rem);
    right: 4.75rem;
    bottom: var(--scene-controls-bottom, 5.5rem);
    z-index: 29;
    width: var(--scene-inspector-width);
    min-width: 0;
    overflow: visible;
  }

  .inspector-anchor > :global(*) {
    width: var(--scene-inspector-width);
    max-height: 100%;
  }

  /* Spans the workspace so the bottom sheets (absolute descendants) are
     bounded by the 3D pane, never the viewport — a viewport-fixed sheet
     slides under the app shell's side/bottom navigation. The action bar
     positions itself inside via MobileSceneControls' bar cluster. */
  .compact-controls {
    position: absolute;
    inset: 0;
    z-index: 30;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .inspector-anchor {
      transition: none;
    }
  }
</style>
