<!-- src/lib/shared/shape-matrix/components/ShapeMatrixCustomizeDock.svelte
  The wide host's dock under the animation: one way into the customize
  workspace, and the transport. The five ability pills belong to hosts where
  each ability opens on its own in a tray or a sheet. On a wide host every
  ability is a page of the workspace over the grid, so a row of pills here
  listed the same five things twice, once under the animation and once on the
  workspace rail. One button names the mode; the rail names the pages.

  Compact hosts keep the pill dock and its sheets, since the grid pane is off
  screen there and there is no workspace to open. -->
<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getShapeMatrixAnimationContext } from "../app/context/shape-matrix-animation-context";
  import { getShapeMatrixAppContext } from "../app/context/shape-matrix-app-context";

  const appState = getShapeMatrixAppContext();
  const animationState = getShapeMatrixAnimationContext();

  /* A prop sheet left open on a compact host arrives on the wide host as the
     workspace's Props page, so it counts as open here too. */
  const open = $derived(
    animationState.activeSection !== null || appState.propPickerOpen
  );

  /* The button is the mode's switch in both directions. The workspace also
     has its own labelled way back, so the grid is never more than one press
     away from either side. */
  function toggle(): void {
    if (open) {
      appState.closePropPicker();
      animationState.showRelationships();
      return;
    }
    animationState.openCustomize();
  }
</script>

<div class="customize-dock">
  <PanelButton
    variant={open ? "primary" : "secondary"}
    ariaPressed={open}
    onclick={toggle}
  >
    <i class="fas fa-sliders" aria-hidden="true"></i>
    <span>Customize</span>
  </PanelButton>
  <PanelButton
    ariaLabel={animationState.playing ? "Pause" : "Play"}
    onclick={animationState.togglePlaying}
  >
    <i
      class="fas {animationState.playing ? 'fa-pause' : 'fa-play'}"
      aria-hidden="true"
    ></i>
  </PanelButton>
</div>

<style>
  .customize-dock {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
    padding-top: 0.5rem;
  }
</style>
