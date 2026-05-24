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
  let blueMotionColumnRef: MotionColumn | undefined = $state();
  let redMotionColumnRef: MotionColumn | undefined = $state();

  // Lookup keys for debugging
  let lookupKeys = $state<{
    gridMode: string;
    oriKey: string;
    turnsTuple: string;
    blueRotationOverrideKey: string | null;
    redRotationOverrideKey: string | null;
  } | null>(null);


  // Calculate arrow positions when modal opens
  $effect(() => {
    if (show && stepData) {
      calculateArrowPositions();
    } else if (!show) {
      calculatedData = null;
      pictographDataState = null;
      blueRotationOverride = null;
      redRotationOverride = null;
      lookupKeys = null;
      blueDiagnostics = null;
      redDiagnostics = null;
    }
  });

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
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    // Delegate WASD to the active pipeline editor
    if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
      const blueHandled = blueMotionColumnRef?.handleWASDKeydown(e);
      if (blueHandled) return;
      const redHandled = redMotionColumnRef?.handleWASDKeydown(e);
      if (redHandled) return;
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
        {onClose}
      />

      <div class="modal-body">
        <div class="columns">
          <BasicInfoColumn
            {displayData}
            {blueMotion}
            {redMotion}
            {lookupKeys}
            {copiedSection}
            onCopy={copyToClipboard}
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
            bind:this={blueMotionColumnRef}
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
            bind:this={redMotionColumnRef}
          />
        </div>
      </div>
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
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.7);
    animation: slideUp var(--duration-normal, 0.3s) ease-out;
    font-family: "SF Mono", "Cascadia Code", "Fira Code", Monaco, Consolas,
      monospace;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: #30363d transparent;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.5fr;
    gap: 12px;
    min-height: 0;
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

  @media (max-width: 900px) {
    .columns {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 600px) {
    .columns {
      grid-template-columns: 1fr;
    }

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
