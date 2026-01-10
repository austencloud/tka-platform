<script lang="ts">
  import type { SequenceEntry } from "../../domain/models/sequence-models";
  import type { LabeledSequence } from "../../domain/models/label-models";
  import type { LOOPDetectionResult } from "../../services/contracts/ILOOPDetector";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import {
    createMotionData,
    type MotionData,
  } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import BeatGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/BeatGrid.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionColor,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import { container } from "$lib/shared/di";
  import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";

  interface Props {
    sequence: SequenceEntry | null;
    parsedBeats: BeatData[];
    startPosition: StartPositionData | null;
    currentLabel: LabeledSequence | null;
    computedDetection?: LOOPDetectionResult | null;
    showStartPosition: boolean;
    manualColumnCount: number | null;
    onShowStartPositionChange: (value: boolean) => void;
    onColumnCountChange: (value: number | null) => void;
    onBeatClick?: (beatNumber: number) => void;
    selectedBeats?: Set<number>;
    labelingMode: "whole" | "section" | "beatpair";
    highlightedBeats?: Map<number, { bg: string; border: string }>;
    selectedBeatNumber?: number | null;
    onCopyJson?: () => void;
    copiedToast?: boolean;
    onDeleteLabel?: () => void;
  }

  let {
    sequence,
    parsedBeats,
    startPosition,
    currentLabel,
    computedDetection,
    showStartPosition,
    manualColumnCount,
    onShowStartPositionChange,
    onColumnCountChange,
    onBeatClick,
    selectedBeats,
    labelingMode,
    highlightedBeats,
    selectedBeatNumber,
    onCopyJson,
    copiedToast = false,
    onDeleteLabel,
  }: Props = $props();

  // Get authoritative grid mode
  const authoritativeGridMode = $derived(
    sequence?.fullMetadata?.sequence?.[0]?.gridMode ||
      sequence?.gridMode ||
      "diamond"
  );

  // Available column options based on sequence length
  const availableColumnOptions = $derived(() => {
    if (!sequence) return [];
    const length = sequence.sequenceLength;
    const options = [2, 3, 4, 5, 6, 8, 10, 12];
    return options.filter((col) => col <= length);
  });

  // Helper to extract intervals from a designation/candidate
  function getIntervalTypes(
    designation: {
      transformationIntervals?: {
        rotation?: string;
        swap?: string;
        mirror?: string;
        flip?: string;
        invert?: string;
      };
    } | null
  ): string[] {
    if (!designation?.transformationIntervals) return [];
    const intervals = designation.transformationIntervals;
    return [
      intervals.rotation,
      intervals.swap,
      intervals.mirror,
      intervals.flip,
      intervals.invert,
    ].filter(Boolean) as string[];
  }

  // Smart default column count based on LOOP detection
  const smartDefaultColumns = $derived(() => {
    if (!sequence) return null;
    const length = sequence.sequenceLength;

    // 1. Use computed detection candidates (on-the-fly detection)
    const allDesignations = computedDetection?.candidateDesignations || [];

    // 2. Check if ANY designation has quartered interval (prefer 90° over 180°)
    const hasQuartered = allDesignations.some((d) => {
      const intervals = getIntervalTypes(d);
      return intervals.includes("quartered");
    });

    if (hasQuartered) {
      const cols = length / 4;
      if (Number.isInteger(cols) && cols >= 2) return cols;
    }

    // 3. Only if no quartered, check for halved (180°)
    const hasHalved = allDesignations.some((d) => {
      const intervals = getIntervalTypes(d);
      return intervals.includes("halved");
    });

    if (hasHalved) {
      const cols = length / 2;
      if (Number.isInteger(cols) && cols >= 2) return cols;
    }

    // 4. Try auto-detected loopType from sequence metadata
    const loopType = sequence.loopType;
    if (loopType) {
      const loopTypeLower = loopType.toLowerCase();
      if (loopTypeLower.includes("quartered")) {
        const cols = length / 4;
        if (Number.isInteger(cols) && cols >= 2) return cols;
      }
      if (loopTypeLower.includes("halved")) {
        const cols = length / 2;
        if (Number.isInteger(cols) && cols >= 2) return cols;
      }
    }

    // 5. Intelligent fallback based on sequence length factors
    // Prefer 4-column layout for common lengths
    if (length === 16) return 4;
    if (length === 12) return 4;
    if (length === 8) return 4;
    if (length % 4 === 0 && length / 4 >= 2) return length / 4;
    if (length % 3 === 0 && length / 3 >= 2) return length / 3;
    if (length % 2 === 0 && length / 2 >= 2 && length / 2 <= 8)
      return length / 2;

    return null;
  });

  const effectiveColumnCount = $derived(
    manualColumnCount ?? smartDefaultColumns()
  );

  // Zero Turns toggle - temporary view that removes all turns
  let showZeroTurns = $state(false);

  // Lazy-load orientation calculator to avoid SSR issues
  let orientationCalculator: IOrientationCalculator | null = null;
  function getOrientationCalculator(): IOrientationCalculator {
    if (!orientationCalculator) {
      orientationCalculator =
        container.items.orientationCalculator as IOrientationCalculator;
    }
    return orientationCalculator;
  }

  /**
   * Create a zero-turns version of beats with proper orientation propagation.
   * Uses the existing OrientationCalculator service which correctly handles:
   * - PRO/STATIC with 0 turns: orientation unchanged
   * - ANTI/DASH with 0 turns: orientation FLIPS
   * - FLOAT: special handpath-based calculation
   *
   * This is VIEW-ONLY for analyzing LOOP patterns without turn confusion.
   */
  function createZeroTurnsBeats(
    beats: BeatData[],
    startPos: StartPositionData | null
  ): BeatData[] {
    if (!startPos) return beats;

    const calculator = getOrientationCalculator();

    // Get initial orientations from start position
    let blueOrientation =
      startPos.motions[MotionColor.BLUE]?.endOrientation ?? Orientation.IN;
    let redOrientation =
      startPos.motions[MotionColor.RED]?.endOrientation ?? Orientation.IN;

    return beats.map((beat) => {
      const newMotions: Record<MotionColor, MotionData> = {} as Record<
        MotionColor,
        MotionData
      >;

      // Process blue motion
      const blueMotion = beat.motions[MotionColor.BLUE];
      if (blueMotion) {
        // Create a temporary motion with 0 turns and current start orientation
        const tempMotion = createMotionData({
          ...blueMotion,
          turns: 0,
          startOrientation: blueOrientation,
        });
        // Use the canonical orientation calculator
        const endOri = calculator.calculateEndOrientation(
          tempMotion,
          MotionColor.BLUE
        );

        const zeroTurnMotion: MotionData = {
          ...blueMotion,
          turns: 0,
          startOrientation: blueOrientation,
          endOrientation: endOri,
        };
        newMotions[MotionColor.BLUE] = zeroTurnMotion;
        blueOrientation = endOri; // Propagate for next beat
      }

      // Process red motion
      const redMotion = beat.motions[MotionColor.RED];
      if (redMotion) {
        // Create a temporary motion with 0 turns and current start orientation
        const tempMotion = createMotionData({
          ...redMotion,
          turns: 0,
          startOrientation: redOrientation,
        });
        // Use the canonical orientation calculator
        const endOri = calculator.calculateEndOrientation(
          tempMotion,
          MotionColor.RED
        );

        const zeroTurnMotion: MotionData = {
          ...redMotion,
          turns: 0,
          startOrientation: redOrientation,
          endOrientation: endOri,
        };
        newMotions[MotionColor.RED] = zeroTurnMotion;
        redOrientation = endOri; // Propagate for next beat
      }

      return {
        ...beat,
        motions: newMotions,
      };
    });
  }

  // The beats to display (either original or zero-turns version)
  const displayBeats = $derived(
    showZeroTurns && startPosition
      ? createZeroTurnsBeats(parsedBeats, startPosition)
      : parsedBeats
  );
</script>

<div class="sequence-preview">
  <!-- Header -->
  <div class="sequence-header">
    <h2 class="sequence-word">{sequence?.word || "No sequence"}</h2>

    <div class="header-actions">
      {#if currentLabel && onDeleteLabel}
        <button
          class="action-btn danger"
          onclick={onDeleteLabel}
          title="Delete existing label"
        >
          <FontAwesomeIcon icon="trash" size="0.85em" />
        </button>
      {/if}
      {#if onCopyJson}
        <button
          class="action-btn"
          onclick={onCopyJson}
          title="Copy sequence JSON"
        >
          {#if copiedToast}
            <FontAwesomeIcon icon="check" size="0.85em" />
          {:else}
            <FontAwesomeIcon icon="copy" size="0.85em" />
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Metadata row -->
  {#if sequence}
    <div class="meta-row">
      <span class="meta-item">{sequence.sequenceLength} beats</span>
      <span
        class="meta-item grid-mode"
        class:box={authoritativeGridMode === GridMode.BOX}
      >
        {authoritativeGridMode === GridMode.BOX ? "BOX" : "DIAMOND"}
      </span>
      {#if sequence.fullMetadata?.sequence?.[0]?.gridMode && sequence.fullMetadata.sequence[0].gridMode !== sequence.gridMode}
        <span
          class="meta-item warning"
          title="Top-level gridMode differs from metadata"
        >
          Grid Mismatch
        </span>
      {/if}
    </div>
  {/if}

  <!-- Beat Grid -->
  {#if parsedBeats.length > 0}
    <div class="beat-grid-section">
      <!-- Grid controls -->
      <div class="grid-controls">
        <button
          class="control-chip"
          class:active={showStartPosition}
          onclick={() => onShowStartPositionChange(!showStartPosition)}
        >
          Start Pos
        </button>
        <button
          class="control-chip zero-turns"
          class:active={showZeroTurns}
          onclick={() => (showZeroTurns = !showZeroTurns)}
          title="View sequence with all turns set to 0"
        >
          0T
        </button>
        <span class="control-divider"></span>
        <span class="control-label">Columns:</span>
        <div class="chip-group">
          <button
            class="control-chip"
            class:active={manualColumnCount === null}
            onclick={() => onColumnCountChange(null)}
          >
            Auto{manualColumnCount === null && effectiveColumnCount !== null
              ? ` (${effectiveColumnCount})`
              : ""}
          </button>
          {#each availableColumnOptions() as colCount}
            <button
              class="control-chip"
              class:active={manualColumnCount === colCount}
              onclick={() => onColumnCountChange(colCount)}
            >
              {colCount}
            </button>
          {/each}
        </div>
      </div>

      <div
        class="beat-grid-wrapper"
        class:interactive={labelingMode !== "whole"}
      >
        <BeatGrid
          beats={displayBeats}
          startPosition={showStartPosition ? startPosition : null}
          {onBeatClick}
          selectedBeatNumber={labelingMode === "whole"
            ? selectedBeatNumber
            : null}
          manualColumnCount={effectiveColumnCount}
          {highlightedBeats}
          heightSizingRowThreshold={20}
        />
      </div>
    </div>
  {:else}
    <div class="no-data">No beat data available</div>
  {/if}
</div>

<style>
  .sequence-preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-glass);
    border-radius: 12px;
    padding: var(--spacing-lg);
    overflow: hidden;
  }

  /* Header */
  .sequence-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    flex-shrink: 0;
  }

  .sequence-word {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 700;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--surface-hover);
    color: var(--foreground);
  }

  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: var(--semantic-error);
  }

  /* Metadata row */
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    flex-shrink: 0;
  }

  .meta-item {
    padding: 2px var(--spacing-sm);
    background: var(--surface-color);
    border-radius: 4px;
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
  }

  .meta-item.grid-mode {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }

  .meta-item.grid-mode.box {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
  }

  .meta-item.warning {
    background: rgba(251, 191, 36, 0.15);
    color: var(--semantic-warning);
  }

  /* Beat Grid Section */
  .beat-grid-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .grid-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .control-label {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .control-divider {
    width: 1px;
    height: 16px;
    background: var(--theme-stroke);
  }

  .chip-group {
    display: flex;
    gap: 4px;
  }

  .control-chip {
    padding: 6px 12px;
    background: var(--surface-color);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: var(--transition-micro);
  }

  .control-chip:hover {
    background: var(--surface-hover);
    color: var(--foreground);
  }

  .control-chip.active {
    background: rgba(99, 102, 241, 0.25);
    border-color: var(--primary-color);
    color: var(--foreground);
  }

  .control-chip.zero-turns {
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .control-chip.zero-turns.active {
    background: rgba(251, 191, 36, 0.25);
    border-color: var(--semantic-warning);
    color: #fde047;
  }

  .beat-grid-wrapper {
    flex: 1;
    min-height: 0;
    background: var(--surface-dark);
    border-radius: 12px;
    padding: var(--spacing-md);
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .beat-grid-wrapper.interactive {
    border: 2px solid rgba(99, 102, 241, 0.3);
    cursor: pointer;
  }

  .no-data {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-dark);
    border-radius: 12px;
    color: var(--muted);
    font-size: var(--font-size-sm);
  }
</style>
