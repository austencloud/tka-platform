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

      calculatedData = {
        ...stepData,
        motions: calculated.motions,
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
    /* Use horizontal space on wide/4K screens instead of a narrow tall strip,
       but cap height so the modal never grows into a viewport-tall tower. */
    width: min(96vw, 1800px);
    max-height: min(90vh, 1040px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
    animation: slideUp var(--duration-normal, 0.3s) ease-out;
  }

  .modal-body {
    /* Hug content (no flex-grow) so the modal never letterboxes into a
       viewport-tall shell with a dead band below the panels. Shrinks + scrolls
       only when content exceeds the capped modal height. */
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke, #30363d) transparent;
  }

  /* Blue motion · pictograph · red motion. The pictograph sits centered
     between its two flanking motion columns. */
  .inspect-layout {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) minmax(280px, 420px) minmax(300px, 1fr);
    gap: 20px;
    align-items: start;
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
    position: sticky;
    top: 16px;
    align-self: center;
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
  }
  /* Three columns need ~920px; below that, stack with the pictograph on top. */
  @media (max-width: 1000px) {
    .inspect-layout { grid-template-columns: 1fr; }
    .pictograph-rail { position: static; order: -1; }
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
