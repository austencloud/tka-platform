<!--
  PictographInspectModal.svelte

  Developer debug modal showing full pictograph metadata.
  Designed for widescreen desktop use with easy copy-paste for AI agents.
-->
<script lang="ts">
  import type { StepData } from "../../domain/models/StepData";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { IArrowPositioningOrchestrator } from "$lib/shared/pictograph/arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
  import type { ISpecialPlacer } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ISpecialPlacer";
  import type { IRotationAngleOverrideKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/RotationAngleOverrideKeyGenerator";
  import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import { SpecialPlacementOriKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
  import { container } from "$lib/shared/di";

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

  // Lookup keys for debugging
  let lookupKeys = $state<{
    gridMode: string;
    oriKey: string;
    turnsTuple: string;
    blueRotationOverrideKey: string | null;
    redRotationOverrideKey: string | null;
  } | null>(null);

  // Copy state for feedback
  let copiedSection = $state<string | null>(null);

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
    }
  });

  async function calculateArrowPositions() {
    if (!stepData) return;

    isCalculating = true;
    try {
      const arrowOrchestrator = container.items.arrowPositioningOrchestrator;

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
        await arrowOrchestrator.calculateAllArrowPoints(pictographData);

      calculatedData = {
        ...stepData,
        motions: calculated.motions,
      };

      await checkRotationOverrides(pictographData);
      calculateLookupKeys(pictographData);
    } catch (err) {
      console.error("Failed to calculate arrow positions:", err);
      calculatedData = stepData;
    } finally {
      isCalculating = false;
    }
  }

  function calculateLookupKeys(pictographData: PictographData) {
    try {
      const tupleGenerator = container.items.turnsTupleGenerator;
      const gridModeDeriver = container.items.gridModeDeriver;
      const rotationKeyGenerator = container.items.rotationAngleOverrideKeyGenerator;
      const oriKeyGenerator = new SpecialPlacementOriKeyGenerator();

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
        oriKey = oriKeyGenerator.generateOrientationKey(
          blueMotionData,
          pictographData
        );
      }

      const turnsTuple = tupleGenerator.generateTurnsTuple(pictographData);

      let blueRotationOverrideKey: string | null = null;
      let redRotationOverrideKey: string | null = null;

      if (blueMotionData) {
        const motionType = blueMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          blueRotationOverrideKey =
            rotationKeyGenerator.generateRotationAngleOverrideKey(
              blueMotionData,
              pictographData
            );
        }
      }

      if (redMotionData) {
        const motionType = redMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          redRotationOverrideKey =
            rotationKeyGenerator.generateRotationAngleOverrideKey(
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
      const specialPlacer = container.items.specialPlacer;
      const rotationKeyGenerator = container.items.rotationAngleOverrideKeyGenerator;

      const blueMotionData = pictographData.motions?.[MotionColor.BLUE];
      if (blueMotionData) {
        const motionType = blueMotionData.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          const blueKey = rotationKeyGenerator.generateRotationAngleOverrideKey(
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
          const redKey = rotationKeyGenerator.generateRotationAngleOverrideKey(
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

  async function copyToClipboard(text: string, section: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedSection = section;
      setTimeout(() => (copiedSection = null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  async function handleCopyAll() {
    const text = await formatAllForAI(
      displayData,
      blueMotion,
      redMotion,
      blueRotationOverride,
      redRotationOverride,
      pictographDataState ?? undefined
    );
    copyToClipboard(text, "all");
  }

  function handleCopyJson() {
    copyToClipboard(JSON.stringify(displayData ?? stepData, null, 2), "json");
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
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
        {copiedSection}
        onCopyAll={handleCopyAll}
        onCopyJson={handleCopyJson}
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
            {copiedSection}
            onCopy={copyToClipboard}
          />

          <MotionColumn
            color="red"
            motion={redMotion}
            rotationOverride={redRotationOverride}
            {copiedSection}
            onCopy={copyToClipboard}
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
    z-index: 1000;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.15s ease-out;
  }

  .modal-content {
    background: linear-gradient(
      135deg,
      rgba(25, 30, 40, 0.98),
      rgba(15, 20, 30, 0.98)
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.2s ease-out;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.5fr;
    gap: 20px;
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
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Responsive: stack columns on narrower screens */
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
      border-radius: 12px;
    }
  }
</style>
