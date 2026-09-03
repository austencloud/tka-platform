<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryControls.svelte
  The Theory ribbon. Same cells, same order, same behaviour as the Matrix
  ribbon: Apply to, then the value band for the chosen axis. Where the Matrix
  scrolls TKA turn values, Theory scrolls prop-to-hand ratios.

  The pairing is the six elements, the same row the Matrix detail already
  shows: split against together against quarter, same against opposite. It is
  in the ribbon here because on Theory it changes every cell in the grid at
  once. The ratio is what one HAND does; the pairing is what the two hands do
  to EACH OTHER. -->
<script lang="ts">
  import ElementChipRow from "$lib/shared/shape-matrix/components/ElementChipRow.svelte";
  import type { VtgMode } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
  import { parseSpinRatio, spinRatioKey } from "@vtg/domain";
  import {
    theoryRatioSpokenLabel,
    theoryRatioVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import ShapeMatrixAxisControl from "./ShapeMatrixAxisControl.svelte";
  import ShapeMatrixRibbonCell from "./ShapeMatrixRibbonCell.svelte";
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
  <ShapeMatrixRibbonCell
    label="Timing and direction"
    tray={layout === "tray"}
  >
    <ElementChipRow
      selected={appState.theoryMode}
      columns={layout === "tray" ? 3 : 6}
      onpick={(mode: VtgMode | null) => {
        // The row clears on a second click, which the Matrix wants and Theory
        // cannot use: the grid is always drawn at some pairing. Re-picking the
        // chosen element keeps it.
        if (mode) appState.setTheoryMode(mode);
      }}
    />
  </ShapeMatrixRibbonCell>
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

  /* The element row is a six-track grid with no width of its own. The ribbon
     gives it a definite one so the six chips stay equal and the row does not
     collapse onto the ratio band; the tray lets it fill the popover. */
  .theory-editor:not(.tray) :global(.chip-row) {
    width: 27rem;
  }

  .theory-editor.tray :global(.chip-row) {
    width: 100%;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-editor:not(.tray) :global(.chip-row) {
      width: 22.5rem;
      gap: 0.35rem;
    }
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
