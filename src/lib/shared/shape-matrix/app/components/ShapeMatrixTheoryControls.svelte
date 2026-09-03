<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryControls.svelte
  The Theory ribbon. Same cells, same order, same behaviour as the Matrix
  ribbon: Apply to, then the value band for the chosen axis. Where the Matrix
  scrolls TKA turn values, Theory scrolls prop-to-hand ratios.

  Timing and direction are NOT here. They sit above the animation in the detail
  pane, which is where the Matrix has always kept them. -->
<script lang="ts">
  import { parseSpinRatio, spinRatioKey } from "@vtg/domain";
  import {
    theoryRatioSpokenLabel,
    theoryRatioVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import ShapeMatrixAxisControl from "./ShapeMatrixAxisControl.svelte";
  import ShapeMatrixValueScroller from "./ShapeMatrixValueScroller.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** Ribbon: the header band. Tray: the compact detail sheet. */
    layout?: "ribbon" | "tray";
  }
  let { layout = "ribbon" }: Props = $props();

  const appState = getShapeMatrixAppContext();

  const ratioOptions = $derived([
    ...(appState.activeAxis === "both" &&
    spinRatioKey(appState.theoryLeftRatio) !==
      spinRatioKey(appState.theoryRightRatio)
      ? [
          {
            value: "mixed",
            label: "Mixed axis ratios",
            shortLabel: "Mixed",
            disabled: true,
          },
        ]
      : []),
    ...appState.availableTheoryRatios.map((ratio) => ({
      value: spinRatioKey(ratio),
      label: theoryRatioSpokenLabel(ratio),
      shortLabel: theoryRatioVisibleLabel(ratio),
      tone:
        appState.activeAxis === "left"
          ? "blue"
          : appState.activeAxis === "right"
            ? "red"
            : "both",
    })),
  ]);
  const ratioKeys = $derived(
    appState.availableTheoryRatios.map((ratio) => spinRatioKey(ratio))
  );
  const selectedRatioKey = $derived(
    appState.activeAxis === "both" &&
      spinRatioKey(appState.theoryLeftRatio) !==
        spinRatioKey(appState.theoryRightRatio)
      ? "mixed"
      : spinRatioKey(appState.activeTheoryRatio)
  );

</script>

<div class="theory-editor" class:tray={layout === "tray"}>
  <ShapeMatrixAxisControl {layout} steers="the ratio control" />
  <ShapeMatrixValueScroller
    label="Ratio"
    options={ratioOptions}
    keys={ratioKeys}
    value={selectedRatioKey}
    onchange={(key) => {
      if (key === "mixed") return;
      const ratio = parseSpinRatio(key);
      if (ratio) appState.setTheoryRatio(ratio);
    }}
    ariaLabel="Prop rotations to hand cycles"
    {layout}
  />
</div>

<style>
  .theory-editor {
    display: flex;
    flex: 0 1 auto;
    align-items: stretch;
    gap: 0.5rem;
    min-width: 0;
  }

  .theory-editor.tray {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-editor:not(.tray) {
      gap: 0.4rem;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .theory-editor:not(.tray) {
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
</style>
