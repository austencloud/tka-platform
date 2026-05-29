<!--
  Thumbnail Generation Page

  Generates all prop-combination thumbnails for sequences using
  the existing ISequenceRenderService (full compositor with word header,
  beat grid, user info footer).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import {
    MotionType,
    RotationDirection,
    Orientation,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    GridLocation,
    GridMode,
    GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getSequenceRenderer } from "$lib/shared/render/get-sequence-renderer";
  import type { SequenceRenderer } from "$lib/shared/render/services/sequence-renderer";

  // Legacy data types from meta.json files
  interface LegacyMotionAttributes {
    motion_type: string;
    start_ori: string;
    end_ori: string;
    prop_rot_dir: string;
    start_loc: string;
    end_loc: string;
    turns: number;
  }

  interface LegacyBeat {
    beat: number;
    letter?: string;
    sequence_start_position?: string;
    start_pos?: string;
    end_pos?: string;
    blue_attributes: LegacyMotionAttributes;
    red_attributes: LegacyMotionAttributes;
  }

  interface LegacySequenceMetadata {
    metadata: {
      sequence: Array<Record<string, unknown> | LegacyBeat>;
    };
  }

  // Core prop types most users care about (can expand later)
  const CORE_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
    PropType.BUUGENG,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.BIGHOOP,
    PropType.DOUBLESTAR,
    PropType.HAND,
    PropType.SWORD,
    PropType.CHICKEN,
    PropType.QUIAD,
  ];

  // Mapping functions for legacy format -> modern format
  const LOCATION_MAP: Record<string, GridLocation> = {
    n: GridLocation.NORTH,
    e: GridLocation.EAST,
    s: GridLocation.SOUTH,
    w: GridLocation.WEST,
    ne: GridLocation.NORTHEAST,
    se: GridLocation.SOUTHEAST,
    sw: GridLocation.SOUTHWEST,
    nw: GridLocation.NORTHWEST,
  };

  const MOTION_TYPE_MAP: Record<string, MotionType> = {
    pro: MotionType.PRO,
    anti: MotionType.ANTI,
    static: MotionType.STATIC,
    dash: MotionType.DASH,
    float: MotionType.FLOAT,
  };

  const ROTATION_MAP: Record<string, RotationDirection> = {
    cw: RotationDirection.CLOCKWISE,
    ccw: RotationDirection.COUNTER_CLOCKWISE,
    no_rot: RotationDirection.NO_ROTATION,
  };

  const ORIENTATION_MAP: Record<string, Orientation> = {
    in: Orientation.IN,
    out: Orientation.OUT,
    clock: Orientation.CLOCK,
    counter: Orientation.COUNTER,
  };

  const POSITION_MAP: Record<string, GridPosition> = {
    alpha1: GridPosition.ALPHA1,
    alpha2: GridPosition.ALPHA2,
    alpha3: GridPosition.ALPHA3,
    alpha4: GridPosition.ALPHA4,
    alpha5: GridPosition.ALPHA5,
    alpha6: GridPosition.ALPHA6,
    alpha7: GridPosition.ALPHA7,
    alpha8: GridPosition.ALPHA8,
    beta1: GridPosition.BETA1,
    beta2: GridPosition.BETA2,
    beta3: GridPosition.BETA3,
    beta4: GridPosition.BETA4,
    beta5: GridPosition.BETA5,
    beta6: GridPosition.BETA6,
    beta7: GridPosition.BETA7,
    beta8: GridPosition.BETA8,
    gamma1: GridPosition.GAMMA1,
    gamma2: GridPosition.GAMMA2,
    gamma3: GridPosition.GAMMA3,
    gamma4: GridPosition.GAMMA4,
    gamma5: GridPosition.GAMMA5,
    gamma6: GridPosition.GAMMA6,
    gamma7: GridPosition.GAMMA7,
    gamma8: GridPosition.GAMMA8,
    gamma9: GridPosition.GAMMA9,
    gamma10: GridPosition.GAMMA10,
    gamma11: GridPosition.GAMMA11,
    gamma12: GridPosition.GAMMA12,
    gamma13: GridPosition.GAMMA13,
    gamma14: GridPosition.GAMMA14,
    gamma15: GridPosition.GAMMA15,
    gamma16: GridPosition.GAMMA16,
  };

  function transformLegacyMotion(
    attrs: LegacyMotionAttributes,
    color: MotionColor,
    propType: PropType,
    gridMode: GridMode
  ) {
    return createMotionData({
      motionType: MOTION_TYPE_MAP[attrs.motion_type] ?? MotionType.STATIC,
      rotationDirection:
        ROTATION_MAP[attrs.prop_rot_dir] ?? RotationDirection.NO_ROTATION,
      startLocation: LOCATION_MAP[attrs.start_loc] ?? GridLocation.NORTH,
      endLocation: LOCATION_MAP[attrs.end_loc] ?? GridLocation.NORTH,
      turns: attrs.turns ?? 0,
      startOrientation: ORIENTATION_MAP[attrs.start_ori] ?? Orientation.IN,
      endOrientation: ORIENTATION_MAP[attrs.end_ori] ?? Orientation.IN,
      isVisible: true,
      propType,
      color,
      gridMode,
    });
  }

  function transformLegacyBeat(
    legacy: LegacyBeat,
    propType: PropType,
    gridMode: GridMode
  ): StepData {
    return {
      id: `beat-${legacy.beat}`,
      letter: legacy.letter as any,
      startPosition: POSITION_MAP[legacy.start_pos ?? ""] ?? null,
      endPosition: POSITION_MAP[legacy.end_pos ?? ""] ?? null,
      motions: {
        [MotionColor.BLUE]: transformLegacyMotion(
          legacy.blue_attributes,
          MotionColor.BLUE,
          propType,
          gridMode
        ),
        [MotionColor.RED]: transformLegacyMotion(
          legacy.red_attributes,
          MotionColor.RED,
          propType,
          gridMode
        ),
      },
      stepNumber: legacy.beat,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    };
  }

  /**
   * Clone a sequence with different prop types for each motion color
   */
  function cloneSequenceWithProps(
    baseSequence: SequenceData,
    blueProp: PropType,
    redProp: PropType
  ): SequenceData {
    // Clone steps with new prop types
    const newSteps: StepData[] = baseSequence.steps.map((step) => ({
      ...step,
      motions: {
        [MotionColor.BLUE]: step.motions.blue
          ? {
              ...step.motions.blue,
              propType: blueProp,
            }
          : step.motions.blue,
        [MotionColor.RED]: step.motions.red
          ? {
              ...step.motions.red,
              propType: redProp,
            }
          : step.motions.red,
      },
    }));

    // Clone start position with new prop types
    let newStartPosition = baseSequence.startPosition;
    if (newStartPosition) {
      newStartPosition = {
        ...newStartPosition,
        motions: {
          [MotionColor.BLUE]: newStartPosition.motions.blue
            ? {
                ...newStartPosition.motions.blue,
                propType: blueProp,
              }
            : newStartPosition.motions.blue,
          [MotionColor.RED]: newStartPosition.motions.red
            ? {
                ...newStartPosition.motions.red,
                propType: redProp,
              }
            : newStartPosition.motions.red,
        },
      };
    }

    return createSequenceData({
      ...baseSequence,
      steps: newSteps,
      startPosition: newStartPosition,
    });
  }

  // State
  let sequences: SequenceData[] = $state([]);
  let isLoading = $state(true);
  let isGenerating = $state(false);
  let isPaused = $state(false);
  let errorMessage = $state<string | null>(null);
  let renderService: SequenceRenderer | null = $state(null);

  // Progress tracking
  let currentSequenceIndex = $state(0);
  let currentBlueProp = $state<PropType>(PropType.STAFF);
  let currentRedProp = $state<PropType>(PropType.STAFF);
  let totalCombinations = $state(0);
  let completedCombinations = $state(0);
  let generatedImages: Array<{ name: string; dataUrl: string }> = $state([]);
  let currentPreviewUrl = $state<string | null>(null);

  // Current sequence being rendered
  const currentSequence = $derived(sequences[currentSequenceIndex] ?? null);

  // Progress percentage
  const progressPercent = $derived(
    totalCombinations > 0
      ? Math.round((completedCombinations / totalCombinations) * 100)
      : 0
  );

  // Estimated time remaining
  let avgTimePerImage = $state(0);
  let startTime = $state(0);
  const estimatedRemaining = $derived(() => {
    if (avgTimePerImage === 0 || completedCombinations === 0)
      return "Calculating...";
    const remaining =
      (totalCombinations - completedCombinations) * avgTimePerImage;
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  });

  onMount(async () => {
    await loadRenderService();
    await loadSequences();
  });

  async function loadRenderService() {
    try {
      console.log("Loading render service...");
      // ITI container is ready synchronously - get service directly
      renderService = getSequenceRenderer();
      console.log("Render service loaded:", !!renderService);
    } catch (error) {
      console.error("Failed to load render service:", error);
      errorMessage = `Failed to load render service: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function loadSequences() {
    isLoading = true;
    errorMessage = null;
    try {
      console.log("Loading sequences from static gallery meta.json files...");

      // For testing, use a few sequences. In production, load from manifest.
      const testSequences = ["A", "AB", "ABC", "B", "C", "D", "E", "F"];
      const loadedSequences: SequenceData[] = [];

      for (const word of testSequences) {
        try {
          const response = await fetch(
            `/gallery/${word}/${word}_ver1.meta.json`
          );
          if (!response.ok) {
            console.warn(`No meta.json found for ${word}`);
            continue;
          }

          const metaData: LegacySequenceMetadata = await response.json();
          console.log(`Loaded meta.json for ${word}`);

          if (
            !metaData.metadata?.sequence ||
            metaData.metadata.sequence.length < 2
          ) {
            console.warn(`Invalid sequence data for ${word}`);
            continue;
          }

          const sequenceArray = metaData.metadata.sequence;
          const seqMeta = sequenceArray[0] as Record<string, unknown>;
          const gridMode =
            seqMeta.grid_mode === "box" ? GridMode.BOX : GridMode.DIAMOND;

          // Transform steps (skip first item: metadata)
          const steps: StepData[] = [];
          let startPosition: StartPositionData | undefined;

          for (let i = 1; i < sequenceArray.length; i++) {
            const item = sequenceArray[i] as LegacyBeat;
            if (item.beat === 0) {
              // Start position
              startPosition = {
                id: "start-position",
                letter: item.letter as any,
                startPosition: POSITION_MAP[item.end_pos ?? ""] ?? null,
                endPosition: POSITION_MAP[item.end_pos ?? ""] ?? null,
                motions: {
                  [MotionColor.BLUE]: transformLegacyMotion(
                    item.blue_attributes,
                    MotionColor.BLUE,
                    PropType.STAFF,
                    gridMode
                  ),
                  [MotionColor.RED]: transformLegacyMotion(
                    item.red_attributes,
                    MotionColor.RED,
                    PropType.STAFF,
                    gridMode
                  ),
                },
                isStartPosition: true,
              };
            } else {
              steps.push(transformLegacyBeat(item, PropType.STAFF, gridMode));
            }
          }

          if (steps.length > 0) {
            const sequenceData = createSequenceData({
              id: `gallery-${word}`,
              name: word,
              word,
              steps,
              startPosition,
              gridMode,
              author: "TKA Gallery",
            });
            loadedSequences.push(sequenceData);
            console.log(`Loaded ${word}: ${steps.length} steps`);
          }
        } catch (fetchError) {
          console.error(`Failed to load ${word}:`, fetchError);
        }
      }

      sequences = loadedSequences;

      if (sequences.length === 0) {
        errorMessage = "No sequences could be loaded from static files.";
        console.warn(errorMessage);
        return;
      }

      // Calculate total combinations
      totalCombinations =
        sequences.length * CORE_PROPS.length * CORE_PROPS.length;

      console.log(`Loaded ${sequences.length} sequences`);
      console.log(`Total combinations to generate: ${totalCombinations}`);
    } catch (error) {
      console.error("Failed to load sequences:", error);
      errorMessage = `Failed to load sequences: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  async function startGeneration() {
    if (isGenerating) return;
    if (sequences.length === 0) {
      errorMessage = "No sequences loaded. Cannot start generation.";
      return;
    }
    if (!renderService) {
      errorMessage = "Render service not loaded. Cannot start generation.";
      return;
    }

    console.log(`Starting generation for ${sequences.length} sequences...`);
    isGenerating = true;
    isPaused = false;
    startTime = Date.now();
    completedCombinations = 0;
    generatedImages = [];

    for (let seqIdx = 0; seqIdx < sequences.length && !isPaused; seqIdx++) {
      currentSequenceIndex = seqIdx;
      const seq = sequences[seqIdx];
      if (!seq) continue;
      console.log(
        `Processing sequence ${seqIdx + 1}/${sequences.length}: ${seq.word}`
      );

      for (const blueProp of CORE_PROPS) {
        if (isPaused) break;

        for (const redProp of CORE_PROPS) {
          if (isPaused) break;

          currentBlueProp = blueProp;
          currentRedProp = redProp;

          try {
            // Clone sequence with the specific prop types
            const proppedSequence = cloneSequenceWithProps(
              seq,
              blueProp,
              redProp
            );

            // Render using the full compositor
            const blob = await renderService!.renderSequenceToBlob(
              proppedSequence,
              {
                includeStartPosition: true,
                addStepNumbers: true,
                addWord: true,
                addUserInfo: false, // No user info for gallery thumbnails
                addDifficultyLevel: true,
                addReversalSymbols: true,
                stepScale: 0.8, // Slightly smaller for thumbnails
              }
            );

            // Convert to data URL for preview
            const dataUrl = await blobToDataUrl(blob);
            const fileName = `${seq.word}_${blueProp}_${redProp}.png`;

            // Update preview
            currentPreviewUrl = dataUrl;

            // Store for download/preview (keep last 10)
            generatedImages = [
              { name: fileName, dataUrl },
              ...generatedImages.slice(0, 9),
            ];

            console.log(
              `Generated: ${fileName} (${Math.round(blob.size / 1024)}KB)`
            );
          } catch (error) {
            console.error(
              `Failed to render ${seq.word} with ${blueProp}/${redProp}:`,
              error
            );
          }

          completedCombinations++;

          // Update average time
          const elapsed = Date.now() - startTime;
          avgTimePerImage = elapsed / completedCombinations;

          // Small delay to allow UI to update
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }

    isGenerating = false;
    console.log("Generation complete!");
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function pauseGeneration() {
    isPaused = true;
  }

  function downloadAllImages() {
    for (const img of generatedImages) {
      const link = document.createElement("a");
      link.download = img.name;
      link.href = img.dataUrl;
      link.click();
    }
  }
</script>

<div class="generator-page">
  <header class="header">
    <h1>Thumbnail Generator</h1>
    <p class="subtitle">
      Generate prop-specific thumbnails using full compositor
    </p>
  </header>

  {#if isLoading}
    <div class="loading">Loading sequences and render service...</div>
  {:else if errorMessage}
    <div class="error-message">
      <h2>Error</h2>
      <p>{errorMessage}</p>
      <button class="btn secondary" onclick={loadSequences}>Retry</button>
    </div>
  {:else}
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-value">{sequences.length}</span>
        <span class="stat-label">Sequences</span>
      </div>
      <div class="stat">
        <span class="stat-value">{CORE_PROPS.length}</span>
        <span class="stat-label">Prop Types</span>
      </div>
      <div class="stat">
        <span class="stat-value">{totalCombinations.toLocaleString()}</span>
        <span class="stat-label">Total Images</span>
      </div>
      <div class="stat">
        <span class="stat-value">{renderService ? "Ready" : "Loading..."}</span>
        <span class="stat-label">Render Service</span>
      </div>
    </div>

    <div class="controls">
      {#if !isGenerating}
        <button
          class="btn primary"
          onclick={startGeneration}
          disabled={!renderService}
        >
          Start Generation
        </button>
      {:else}
        <button class="btn danger" onclick={pauseGeneration}> Pause </button>
      {/if}

      {#if generatedImages.length > 0}
        <button class="btn secondary" onclick={downloadAllImages}>
          Download Recent ({generatedImages.length})
        </button>
      {/if}
    </div>

    {#if isGenerating || completedCombinations > 0}
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progressPercent}%"></div>
        </div>
        <div class="progress-stats">
          <span
            >{completedCombinations.toLocaleString()} / {totalCombinations.toLocaleString()}</span
          >
          <span>{progressPercent}%</span>
          <span>ETA: {estimatedRemaining()}</span>
        </div>
      </div>
    {/if}

    <div class="workspace">
      <!-- Live render preview -->
      <div class="render-panel">
        <h2>Current Render</h2>
        {#if currentSequence}
          <div class="render-info">
            <span class="sequence-name">{currentSequence.word}</span>
            <span class="prop-combo">{currentBlueProp} / {currentRedProp}</span>
          </div>
          <div class="render-container">
            {#if currentPreviewUrl}
              <img
                src={currentPreviewUrl}
                alt="Current render preview"
                class="preview-image"
              />
            {:else}
              <div class="no-preview">Waiting for first render...</div>
            {/if}
          </div>
        {:else}
          <div class="no-sequence">No sequence selected</div>
        {/if}
      </div>

      <!-- Recent captures -->
      <div class="captures-panel">
        <h2>Recent Captures</h2>
        <div class="captures-grid">
          {#each generatedImages as img (img.name)}
            <div class="capture-item">
              <img src={img.dataUrl} alt={img.name} />
              <span class="capture-name">{img.name}</span>
            </div>
          {/each}
          {#if generatedImages.length === 0}
            <div class="no-captures">No captures yet</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .generator-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    padding: 2rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2.5rem;
    margin: 0;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: var(--theme-text-dim);
    margin-top: 0.5rem;
  }

  .loading {
    text-align: center;
    padding: 4rem;
    font-size: 1.5rem;
    color: var(--theme-text-dim);
  }

  .error-message {
    text-align: center;
    padding: 2rem;
    max-width: 600px;
    margin: 2rem auto;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
  }

  .error-message h2 {
    color: var(--semantic-error);
    margin: 0 0 1rem;
  }

  .error-message p {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 1.5rem;
  }

  .stats-bar {
    display: flex;
    justify-content: center;
    gap: 3rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: #667eea;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .btn {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }

  .btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn.danger {
    background: linear-gradient(
      135deg,
      var(--semantic-error),
      var(--semantic-error)
    );
    color: white;
  }

  .progress-section {
    max-width: 600px;
    margin: 0 auto 2rem;
  }

  .progress-bar {
    height: 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    transition: width var(--duration-emphasis);
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .workspace {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .render-panel,
  .captures-panel {
    background: var(--theme-card-bg);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .render-panel h2,
  .captures-panel h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: var(--theme-text);
  }

  .render-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .sequence-name {
    color: #667eea;
    font-weight: 600;
  }

  .prop-combo {
    color: var(--theme-text-dim);
  }

  .render-container {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 1rem;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .preview-image {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: 4px;
  }

  .no-sequence,
  .no-captures,
  .no-preview {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .captures-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .capture-item {
    background: var(--theme-card-bg);
    border-radius: 8px;
    overflow: hidden;
  }

  .capture-item img {
    width: 100%;
    height: auto;
    display: block;
  }

  .capture-name {
    display: block;
    padding: 0.5rem;
    font-size: 0.7rem;
    color: var(--theme-text-dim);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }
</style>
