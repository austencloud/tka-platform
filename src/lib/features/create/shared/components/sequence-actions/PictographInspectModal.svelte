<!--
  PictographInspectModal.svelte

  Developer debug modal showing full pictograph metadata.
  Designed for widescreen desktop use with easy copy-paste for AI agents.
-->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { generateOrientationKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
  import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
  import { calculateAllArrowPoints } from "$lib/shared/pictograph/arrow/orchestration/services/arrow-positioning-orchestrator";
  import { specialPlacer } from "$lib/shared/pictograph/arrow/positioning/placement/services/special-placer";
  import { generateRotationAngleOverrideKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/rotation-angle-override-key-generator";
  import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/turns-tuple-generator";

  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/pipeline-diagnostics";
  import { arrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator";
  import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator";

  import InspectModalHeader from "./pictograph-inspect/InspectModalHeader.svelte";
  import BasicInfoBar from "./pictograph-inspect/BasicInfoBar.svelte";
  import MotionColumn from "./pictograph-inspect/MotionColumn.svelte";
  import { formatAllForAI } from "./pictograph-inspect/formatters";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import PipelineEditorDock from "./pictograph-inspect/PipelineEditorDock.svelte";
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";

  interface Props {
    show: boolean;
    stepData: StepData | null;
    onClose: () => void;
    /** When set, the editor dock shows a single "Done" button that persists the
        edit then calls this (one-shot flows like choreo-card Fix Arrows). */
    onDone?: () => void;
  }

  let { show, stepData, onClose, onDone }: Props = $props();

  // Calculated data with arrow positions populated
  let calculatedData = $state<StepData | null>(null);
  let pictographDataState = $state<PictographData | null>(null);
  let isCalculating = $state(false);

  // Rotation override status for each color (only applies to STATIC/DASH)
  let blueRotationOverride = $state<{ hasOverride: boolean } | null>(null);
  let redRotationOverride = $state<{ hasOverride: boolean } | null>(null);

  let blueDiagnostics = $state<PipelineDiagnostics | null>(null);
  let redDiagnostics = $state<PipelineDiagnostics | null>(null);

  // Lookup keys for debugging
  let lookupKeys = $state<{
    gridMode: string;
    oriKey: string;
    turnsTuple: string;
    blueRotationOverrideKey: string | null;
    redRotationOverrideKey: string | null;
  } | null>(null);

  // Accordion open state — all collapsed on open (spec: AAA, no overload)
  let blueOpen = $state(false);
  let redOpen = $state(false);

  // When an arrow is clicked in the live pictograph, expand + edit that section.
  // Driven imperatively via the selection observer (same pattern ArrowSvg uses),
  // NOT a reactive $effect — reading the global selection inside an effect that
  // also writes open-state participates in cross-component update loops.
  let lastSelectedColor: string | null = null;
  $effect(() => {
    const unsubscribe = selectedArrowState.subscribe(() => {
      const color = selectedArrowState.selectedArrow?.color ?? null;
      if (color === lastSelectedColor) return;
      lastSelectedColor = color;
      if (color === "blue") {
        blueOpen = true;
      } else if (color === "red") {
        redOpen = true;
      }
    });
    return unsubscribe;
  });


  // Calculate arrow positions when modal opens. Reset stale state on the OPEN
  // transition (these writes aren't effect deps, so they don't re-trigger).
  // Close-side teardown — especially the GLOBAL selectedArrowState.clearSelection()
  // — must NOT live here: mutating global state inside a reactive effect fires
  // observers mid-flush, re-entering the effect graph and throwing
  // effect_update_depth_exceeded. Teardown lives in requestClose() instead.
  $effect(() => {
    if (show && stepData) {
      calculatedData = null;
      pictographDataState = null;
      blueRotationOverride = null;
      redRotationOverride = null;
      lookupKeys = null;
      blueDiagnostics = null;
      redDiagnostics = null;
      // Wide desktop / 4K: the columns pack side-by-side, so start everything
      // expanded — no reason to make the user click through on a big screen.
      // Narrow: start collapsed to avoid a tall scroll tower.
      const wide =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 1600px)").matches;
      blueOpen = wide;
      redOpen = wide;
      lastSelectedColor = null;
      calculateArrowPositions();
    }
  });

  // Imperative close: clear global selection + collapse sections, THEN ask the
  // parent to hide. Runs in an event handler (not a reactive flush), so the
  // global notifyObservers() cascade is processed in a normal, non-re-entrant
  // update cycle.
  function requestClose() {
    selectedArrowState.clearSelection();
    blueOpen = false;
    redOpen = false;
    lastSelectedColor = null;
    onClose();
  }

  async function calculateArrowPositions() {
    if (!stepData) return;

    isCalculating = true;
    try {
      const pictographData: PictographData = {
        id: stepData.id,
        letter: stepData.letter,
        startPosition: stepData.startPosition,
        endPosition: stepData.endPosition,
        motions: stepData.motions,
      };

      // Store for use in formatAllForAI
      pictographDataState = pictographData;

      const calculated =
        await calculateAllArrowPoints(pictographData);

      // Arrow-point calculation returns partial motions (it only computes
      // present/visible hands); keep the step's original motion for any hand
      // it skipped so the both-required Step shape holds.
      calculatedData = {
        ...stepData,
        motions: {
          blue: calculated.motions.blue ?? stepData.motions.blue,
          red: calculated.motions.red ?? stepData.motions.red,
        },
      };

      await checkRotationOverrides(pictographData);
      calculateLookupKeys(pictographData);
      await calculateDiagnostics(pictographData);
    } catch (err) {
      console.error("Failed to calculate arrow positions:", err);
      calculatedData = stepData;
    } finally {
      isCalculating = false;
    }
  }

  async function calculateDiagnostics(pictographData: PictographData) {
    const blueMotionData = pictographData.motions?.[MotionColor.BLUE];
    const redMotionData = pictographData.motions?.[MotionColor.RED];

    if (blueMotionData) {
      try {
        const location = arrowLocationCalculator.calculateLocation(blueMotionData, pictographData);
        blueDiagnostics = await arrowAdjustmentCalculator.getDiagnostics(
          pictographData, blueMotionData, pictographData.letter || "", location, "blue"
        );
      } catch (err) {
        console.error("Blue diagnostics failed:", err);
        blueDiagnostics = null;
      }
    }

    if (redMotionData) {
      try {
        const location = arrowLocationCalculator.calculateLocation(redMotionData, pictographData);
        redDiagnostics = await arrowAdjustmentCalculator.getDiagnostics(
          pictographData, redMotionData, pictographData.letter || "", location, "red"
        );
      } catch (err) {
        console.error("Red diagnostics failed:", err);
        redDiagnostics = null;
      }
    }
  }

  async function refreshDiagnostics() {
    if (pictographDataState) {
      await calculateDiagnostics(pictographDataState);
    }
  }

  function calculateLookupKeys(pictographData: PictographData) {
    try {
      const blueMotionData = pictographData.motions?.[MotionColor.BLUE];
      const redMotionData = pictographData.motions?.[MotionColor.RED];

      let gridMode = "diamond";
      if (blueMotionData && redMotionData) {
        gridMode = deriveGridMode(
          blueMotionData,
          redMotionData
        );
      }

      let oriKey = "unknown";
      if (blueMotionData) {
        oriKey = generateOrientationKey(blueMotionData, pictographData);
      }

      const turnsTuple = turnsTupleGenerator.generateTurnsTuple(pictographData);

      let blueRotationOverrideKey: string | null = null;
      let redRotationOverrideKey: string | null = null;

      if (blueMotionData) {
        const motionType = blueMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          blueRotationOverrideKey =
            generateRotationAngleOverrideKey(
              blueMotionData,
              pictographData
            );
        }
      }

      if (redMotionData) {
        const motionType = redMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          redRotationOverrideKey =
            generateRotationAngleOverrideKey(
              redMotionData,
              pictographData
            );
        }
      }

      lookupKeys = {
        gridMode,
        oriKey,
        turnsTuple,
        blueRotationOverrideKey,
        redRotationOverrideKey,
      };
    } catch (err) {
      console.error("Failed to calculate lookup keys:", err);
      lookupKeys = null;
    }
  }

  async function checkRotationOverrides(pictographData: PictographData) {
    try {
      const blueMotionData = pictographData.motions?.[MotionColor.BLUE];
      if (blueMotionData) {
        const motionType = blueMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          const blueKey = generateRotationAngleOverrideKey(
            blueMotionData,
            pictographData
          );
          const blueHasOverride = await specialPlacer.hasRotationAngleOverride(
            blueMotionData,
            pictographData,
            blueKey
          );
          blueRotationOverride = { hasOverride: blueHasOverride };
        } else {
          blueRotationOverride = null;
        }
      }

      const redMotionData = pictographData.motions?.[MotionColor.RED];
      if (redMotionData) {
        const motionType = redMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          const redKey = generateRotationAngleOverrideKey(
            redMotionData,
            pictographData
          );
          const redHasOverride = await specialPlacer.hasRotationAngleOverride(
            redMotionData,
            pictographData,
            redKey
          );
          redRotationOverride = { hasOverride: redHasOverride };
        } else {
          redRotationOverride = null;
        }
      }
    } catch (err) {
      console.error("Failed to check rotation overrides:", err);
    }
  }

  // The currently-selected arrow color, used to dim the non-selected motion
  // so focus sits on the one being edited. Pure read — safe in a $derived
  // (the warned-against case is reading selection inside an effect that writes).
  const selectedColor = $derived(selectedArrowState.selectedArrow?.color ?? null);

  // Select a motion by clicking anywhere in its column — easier than hitting the
  // small arrow in the pictograph. Mirrors what an arrow-click selects (same
  // motionData + pictographData), so isSelected() stays consistent.
  function selectMotion(color: "blue" | "red") {
    if (!stepData) return;
    const motion = color === "blue" ? blueMotion : redMotion;
    if (!motion) return;
    const pictographData: PictographData = pictographDataState ?? {
      id: stepData.id,
      letter: stepData.letter,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions,
    };
    selectedArrowState.selectArrow(motion, color, pictographData);
  }

  function handleRailKeydown(e: KeyboardEvent, color: "blue" | "red") {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectMotion(color);
    }
  }

  // Derived display values
  const displayData = $derived(calculatedData ?? stepData);
  const blueMotion = $derived(displayData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(displayData?.motions?.[MotionColor.RED]);

  // Prop type for the rendered pictograph. Two callers, opposite needs:
  //  - Choreo-card Fix Arrows (onDone set) stamps the card's EFFECTIVE prop onto
  //    motion.propType via withEffectivePropTypes, so the stored value IS the
  //    prop to render — pass it through so the preview matches the card bake.
  //  - Step Editor (onDone unset) passes raw sequence data whose motion.propType
  //    is the baked/stored prop (often staff), NOT the user's live selection.
  //    Passing it would override the live prop (e.g. club). Leave undefined so
  //    PictographContainer falls back to global settings — identical to how the
  //    Step Editor's own PictographContainer resolves the prop.
  const bluePropTypeForRender = $derived(
    onDone ? stepData?.motions?.[MotionColor.BLUE]?.propType : undefined
  );
  const redPropTypeForRender = $derived(
    onDone ? stepData?.motions?.[MotionColor.RED]?.propType : undefined
  );

  // Get formatted data for AI
  async function getCopyAllData(): Promise<string> {
    return await formatAllForAI(
      displayData,
      blueMotion,
      redMotion,
      blueRotationOverride,
      redRotationOverride,
      pictographDataState ?? undefined
    );
  }

  // Get raw JSON data
  function getCopyJsonData(): string {
    return JSON.stringify(displayData ?? stepData, null, 2);
  }

  // Track copied section for visual feedback
  let copiedSection = $state<string | null>(null);

  async function copyToClipboard(text: string, section: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copiedSection = section;
      setTimeout(() => {
        copiedSection = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      requestClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (selectedArrowState.selectedArrow) {
        selectedArrowState.clearSelection();
      } else {
        requestClose();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && stepData}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Pictograph Inspector"
    tabindex="-1"
  >
    <div class="modal-content">
      <InspectModalHeader
        {displayData}
        {stepData}
        {isCalculating}
        {getCopyAllData}
        {getCopyJsonData}
        onClose={requestClose}
      />

      <BasicInfoBar
        {displayData}
        {blueMotion}
        {redMotion}
        {lookupKeys}
        {copiedSection}
        onCopy={copyToClipboard}
      />

      <div class="modal-body">
        <div class="inspect-layout">
          <!-- Blue left · pictograph center · red right. The non-selected
               motion dims so the eye lands on the one being edited. Clicking
               anywhere in a column selects that motion (no need to hit the
               small arrow in the pictograph). -->
          <div
            class="motion-rail"
            class:dimmed={selectedColor === "red"}
            class:selected={selectedColor === "blue"}
            role="button"
            tabindex="0"
            aria-pressed={selectedColor === "blue"}
            aria-label="Select blue motion"
            onclick={() => selectMotion("blue")}
            onkeydown={(e) => handleRailKeydown(e, "blue")}
          >
            <MotionColumn
              color="blue"
              motion={blueMotion}
              rotationOverride={blueRotationOverride}
              diagnostics={blueDiagnostics}
              {copiedSection}
              onCopy={copyToClipboard}
              open={blueOpen}
              onToggle={(next) => (blueOpen = next)}
            />
          </div>

          <div class="pictograph-rail">
            {#if displayData}
              <div class="pictograph-frame">
                <PictographContainer
                  pictographData={displayData}
                  arrowsClickable={true}
                  disableTransitions={true}
                  bluePropTypeOverride={bluePropTypeForRender}
                  redPropTypeOverride={redPropTypeForRender}
                />
              </div>
            {/if}
          </div>

          <div
            class="motion-rail"
            class:dimmed={selectedColor === "blue"}
            class:selected={selectedColor === "red"}
            role="button"
            tabindex="0"
            aria-pressed={selectedColor === "red"}
            aria-label="Select red motion"
            onclick={() => selectMotion("red")}
            onkeydown={(e) => handleRailKeydown(e, "red")}
          >
            <MotionColumn
              color="red"
              motion={redMotion}
              rotationOverride={redRotationOverride}
              diagnostics={redDiagnostics}
              {copiedSection}
              onCopy={copyToClipboard}
              open={redOpen}
              onToggle={(next) => (redOpen = next)}
            />
          </div>
        </div>
      </div>

      <PipelineEditorDock
        {stepData}
        {blueDiagnostics}
        {redDiagnostics}
        onDiagnosticsChanged={refreshDiagnostics}
        {onDone}
      />
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn var(--duration-fast, 0.15s) ease-out;
  }

  .modal-content {
    background: var(--theme-panel-bg, rgba(13, 17, 23, 0.98));
    border: 1px solid var(--theme-stroke, #30363d);
    border-radius: 8px;
    /* Use horizontal space on wide/4K screens instead of a narrow tall strip. */
    width: min(96vw, 1800px);
    /* Fill the host, capped. This panel is usually rendered inside the step-editor
       drawer, whose <dialog> carries transform + will-change and is therefore the
       containing block for the fixed backdrop — so "the host" is a ~910px-wide
       column, not the viewport. Hugging content there centered a 594px box in
       1005px of space and threw away 41% of the height. */
    /* The cap scales with the screen instead of freezing at 1040px, which used
       less than half the column on a 2160-tall display. */
    height: min(100%, max(1040px, 78vh));
    overflow: hidden;
    /* Everything below sizes off THIS box, not the viewport. Without it the
       responsive tier keyed to the panel's own width can never fire. */
    container-type: inline-size;
    container-name: inspect;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
    animation: slideUp var(--duration-normal, 0.3s) ease-out;
  }

  .modal-body {
    /* Take the space between the info bar and the dock. The old rule hugged
       content to avoid letterboxing — correct back when nothing inside could
       grow. Now the pictograph absorbs the slack, so filling is the right call
       and the dead band is gone. */
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke, #30363d) transparent;
  }

  /*
   * DEFAULT: hero left, the two motion columns standing in a side rail.
   *
   * Three-across used to be the default and is now reserved for a genuinely wide
   * host. In the step-editor drawer — the panel's usual home, ~900-1000px — it
   * put a short blue column, a floating square, and a short red column in one
   * ragged row and left a dead band under all three. Side-rail bounds the square
   * by the wider axis and stacks the reference data to fill the height.
   */
  .inspect-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
    grid-template-areas:
      "picto blue"
      "picto red";
    grid-template-rows: auto auto;
    gap: 20px;
    align-content: start;
    /* Claim the body's full height so the pictograph has something to grow into. */
    height: 100%;
    min-height: 0;
  }
  .inspect-layout > .motion-rail:first-child {
    grid-area: blue;
  }
  .inspect-layout > .motion-rail:last-child {
    grid-area: red;
  }
  .motion-rail {
    min-width: 0;
    cursor: pointer;
    border-radius: 16px;
    /* Click anywhere in the column to select; ring marks the selected one. */
    border: 1px solid transparent;
    transition:
      opacity var(--duration-normal, 0.3s) ease,
      border-color var(--duration-fast, 0.15s) ease;
  }
  .motion-rail.selected {
    border-color: color-mix(in srgb, var(--theme-accent, #58a6ff) 55%, transparent);
  }
  .motion-rail:focus-visible {
    outline: 2px solid var(--theme-accent, #58a6ff);
    outline-offset: 2px;
  }
  /* The motion not currently selected recedes so focus stays on the edited one. */
  .motion-rail.dimmed {
    opacity: 0.4;
  }
  /* Center the pictograph against the taller motion columns so the focal
     element sits balanced instead of pinned to the top with a void beneath.
     Sticky keeps it in view if the sides ever scroll. */
  .pictograph-rail {
    grid-area: picto;
    align-self: center;
    /* Size to whichever of the two axes runs out first, so the pictograph is as
       large as the panel allows and still square. */
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    height: 100%;
    /* A size container so the frame can read this rail's HEIGHT in CSS (cqh).
       Without it the square has no way to know which axis runs out first: a
       width-driven rule stretched to 826x722 once the panel passed ~1050px,
       and a height-driven one stretched to 458x618 when the panel was narrow. */
    container-type: size;
  }
  .pictograph-frame {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 16px;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    /* The largest square that fits BOTH axes, stated once: the smaller of the
       column's width and the rail's height. `aspect-ratio` then supplies the
       height, so no rule can fight it into a rectangle. */
    width: min(100%, 100cqh);
    height: auto;
    margin-inline: auto;
  }

  /*
   * Three columns need ~940px of PANEL width. The old rule asked the VIEWPORT,
   * which is ~1900px while this panel is ~840px inside the drawer — so it never
   * fired and all three columns sat crushed on their minmax floors, rendering
   * the pictograph at its 280px minimum. Asking the container is the fix.
   *
   * Narrow: the pictograph takes the full width on top (the tall drawer has
   * height to spare) and the two motion columns share the row beneath, which is
   * how they both fit at a readable width instead of at 300px.
   */
  /*
   * Hero beside the data, not above it. Stacking the pictograph on top consumed
   * the height but left ~570px of empty rail either side of the square — the same
   * dead-space complaint on the other axis. Standing the two motion columns in a
   * side rail means the square is bounded by the wider of the two axes and BOTH
   * get consumed: measured 280px -> 470px on the same panel.
   */
  /*
   * Three-across earns its keep only when all three columns can be full-width at
   * once — roughly 1200px of PANEL. Below that it degrades into the ragged row
   * described above, which is exactly what the drawer was getting.
   */
  @container inspect (min-width: 1200px) {
    .inspect-layout {
      /* Ratios, not a hard cap. A `min(40cqw, 46vh)` middle column collapsed the
         hero from 706px to 462px the instant this tier took over — a visible
         cliff at the boundary. The frame's own cqh rule already guarantees the
         square, so the column only has to claim its share. */
      grid-template-columns:
        minmax(280px, 1fr)
        minmax(360px, 1.6fr)
        minmax(280px, 1fr);
      grid-template-areas: "blue picto red";
      grid-template-rows: minmax(0, 1fr);
      /* Center the row rather than pinning it to the top — a short blue column,
         a square, and a short red column hugging the top is what left the dead
         band underneath. */
      align-content: center;
      align-items: center;
    }
  }
  /* One column only when even two motion columns can't be read side by side. */
  @container inspect (max-width: 560px) {
    .inspect-layout {
      grid-template-columns: 1fr;
      grid-template-areas:
        "picto"
        "blue"
        "red";
      grid-template-rows: auto auto auto;
    }
    /* Rows are content-sized here, so the base `height: 100%` on the rail has
       nothing definite to resolve against and collapsed the square to 283x33.
       Let content drive the height and let the body scroll. */
    /* Rows are content-sized here, so the base `height: 100%` on the rail has
       nothing definite to resolve against and collapsed the square to 283x33.
       Content drives the height and the body scrolls — which also means the rail
       has no definite height, so `cqh` would resolve to 0. Width alone governs. */
    .pictograph-rail {
      height: auto;
      container-type: normal;
    }
    .pictograph-frame {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .motion-rail { transition: none; }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 600px) {
    .modal-content {
      max-width: 100%;
      border-radius: 6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop {
      animation: none;
    }
    .modal-content {
      animation: none;
    }
  }
</style>
