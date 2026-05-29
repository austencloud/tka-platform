<!--
  PictographInspectModal.svelte

  Developer debug modal showing full pictograph metadata.
  Designed for widescreen desktop use with easy copy-paste for AI agents.
-->
<script lang="ts">
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { generateOrientationKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
  import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
  import { calculateAllArrowPoints } from "$lib/shared/pictograph/arrow/orchestration/services/arrow-positioning-orchestrator";
  import { specialPlacer } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer";
  import { generateRotationAngleOverrideKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/rotation-angle-override-key-generator";
  import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";

  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import { arrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
  import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator";

  import InspectModalHeader from "./pictograph-inspect/InspectModalHeader.svelte";
  import BasicInfoColumn from "./pictograph-inspect/BasicInfoColumn.svelte";
  import MotionColumn from "./pictograph-inspect/MotionColumn.svelte";
  import { formatAllForAI } from "./pictograph-inspect/formatters";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import PipelineEditorDock from "./pictograph-inspect/PipelineEditorDock.svelte";
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";

  interface Props {
    show: boolean;
    stepData: StepData | null;
    onClose: () => void;
  }

  let { show, stepData, onClose }: Props = $props();

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
  let basicOpen = $state(false);
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
      basicOpen = wide;
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
    basicOpen = false;
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
        gridMode = gridModeDeriver.deriveGridMode(
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

      <div class="modal-body">
        <div class="inspect-layout">
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

          <div class="detail-column themed-scrollbar">
            <BasicInfoColumn
              {displayData}
              {blueMotion}
              {redMotion}
              {lookupKeys}
              {copiedSection}
              onCopy={copyToClipboard}
              open={basicOpen}
              onToggle={(next) => (basicOpen = next)}
            />

            <MotionColumn
              color="blue"
              motion={blueMotion}
              rotationOverride={blueRotationOverride}
              diagnostics={blueDiagnostics}
              stepData={stepData}
              onDiagnosticsChanged={refreshDiagnostics}
              {copiedSection}
              onCopy={copyToClipboard}
              open={blueOpen}
              onToggle={(next) => (blueOpen = next)}
            />

            <MotionColumn
              color="red"
              motion={redMotion}
              rotationOverride={redRotationOverride}
              diagnostics={redDiagnostics}
              stepData={stepData}
              onDiagnosticsChanged={refreshDiagnostics}
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

  .inspect-layout {
    display: grid;
    grid-template-columns: minmax(280px, 420px) 1fr;
    gap: 20px;
    align-items: start;
  }
  /* Center the pictograph against the taller detail column so the focal
     element sits balanced instead of pinned to the top with a void beneath.
     Sticky keeps it in view if the detail side ever scrolls. */
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
  /* Sections pack side-by-side on wide screens, stack on narrow — keeps the
     modal short on a 4K landscape display instead of one tall column. */
  .detail-column {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    align-content: start;
    align-items: start;
    gap: 12px;
    min-width: 0;
  }
  @media (max-width: 720px) {
    .inspect-layout { grid-template-columns: 1fr; }
    .pictograph-rail { position: static; }
    .detail-column { grid-template-columns: 1fr; }
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
