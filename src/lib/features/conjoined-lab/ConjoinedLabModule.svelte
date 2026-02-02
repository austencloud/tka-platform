<!--
  ConjoinedLabModule.svelte - Main module for Conjoined Lab experiment

  Visualizes a single TKA pictograph with red and blue props on separate adjacent grids.
  The grids share a "conjoined" point where they meet.

  - Grid A shows only the blue prop
  - Grid B shows only the red prop
  - Layout arrangements (left-right, top-bottom, diagonals)
  - Letter selector loads real pictograph data from CSV
-->
<script lang="ts">
  import type { ConjoinedLayout, GridArrangement } from "./domain/types";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { DEFAULT_CONJOINED_LAYOUT } from "./domain/types";
  import { getDefaultEdgeForArrangement } from "./domain/layout-presets";
  import ConjoinedCanvas from "./components/ConjoinedCanvas.svelte";
  import ConjoinedControls from "./components/ConjoinedControls.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { ConjoinedLayoutCalculator } from "./services/implementations/ConjoinedLayoutCalculator";
  import { onMount } from "svelte";

  // Strict hand point coordinates for overlap detection (from gridCoordinates.ts)
  const STRICT_COORDS: Record<string, { x: number; y: number }> = {
    n: { x: 475, y: 325 }, e: { x: 625, y: 475 },
    s: { x: 475, y: 625 }, w: { x: 325, y: 475 },
    ne: { x: 581.1, y: 368.9 }, se: { x: 581.1, y: 581.1 },
    sw: { x: 368.9, y: 581.1 }, nw: { x: 368.9, y: 368.9 },
  };

  const layoutCalc = new ConjoinedLayoutCalculator();

  // State
  let layout = $state<ConjoinedLayout>({ ...DEFAULT_CONJOINED_LAYOUT });
  let preparedPictograph = $state<PreparedPictographData | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // All available pictographs loaded from CSV
  let allPictographs = $state<PictographData[]>([]);
  let selectedIndex = $state(0);

  // Derived: unique letters available
  const availableLetters = $derived(
    [...new Set(allPictographs.map((p) => p.letter).filter(Boolean))]
  );

  // Derived: current pictograph info
  const currentPictograph = $derived(allPictographs[selectedIndex] ?? null);
  const currentLetter = $derived(currentPictograph?.letter ?? "—");

  // Load all pictograph variations from CSV on mount
  onMount(async () => {
    try {
      const pictographs = await letterQueryHandler.getAllPictographVariations(
        GridMode.DIAMOND
      );
      allPictographs = pictographs;

      if (pictographs.length > 0) {
        await preparePictograph(pictographs[0]!);
      } else {
        error = "No pictograph data found";
        isLoading = false;
      }
    } catch (e) {
      console.error("Failed to load pictograph data:", e);
      error = e instanceof Error ? e.message : "Failed to load data";
      isLoading = false;
    }
  });

  // Prepare a pictograph for rendering
  async function preparePictograph(pictograph: PictographData) {
    isLoading = true;
    error = null;
    try {
      preparedPictograph = await pictographPreparer.prepareSingle(pictograph, {
        themeMode: "dark",
        useAnimatedVersion: true,
      });
    } catch (e) {
      console.error("Failed to prepare pictograph:", e);
      error = e instanceof Error ? e.message : "Failed to prepare pictograph";
    } finally {
      isLoading = false;
    }
  }

  // When selected index changes, prepare the new pictograph
  $effect(() => {
    const pictograph = allPictographs[selectedIndex];
    if (pictograph) {
      preparePictograph(pictograph);
    }
  });

  // Handlers
  function handleLayoutChange(newLayout: ConjoinedLayout) {
    layout = newLayout;
  }

  function handleArrangementChange(arrangement: GridArrangement) {
    layout = {
      ...layout,
      arrangement,
      conjoinedEdge: getDefaultEdgeForArrangement(arrangement),
    };
  }

  function handleSpacingChange(spacing: number) {
    layout = {
      ...layout,
      spacing: Math.max(0, Math.min(200, spacing)),
    };
  }

  function handlePrev() {
    if (selectedIndex > 0) {
      selectedIndex--;
    }
  }

  function handleNext() {
    if (selectedIndex < allPictographs.length - 1) {
      selectedIndex++;
    }
  }

  // Copy pictograph data to clipboard
  let copyFeedback = $state("");

  function buildConjoinedSummary(): string {
    const p = currentPictograph;
    if (!p) return "No pictograph loaded";

    const blue = p.motions?.blue;
    const red = p.motions?.red;
    const gridPositions = layoutCalc.calculateGridPositions(layout);

    const lines: string[] = [
      `CONJOINED: ${p.letter ?? "?"} (${selectedIndex + 1}/${allPictographs.length}) | ${p.gridMode ?? "diamond"} | ${layout.arrangement}:${layout.conjoinedEdge} spacing:${layout.spacing}`,
    ];

    if (blue) {
      lines.push(`BLUE@GridA: ${blue.motionType} ${blue.startLocation}→${blue.endLocation} ori:${blue.startOrientation}→${blue.endOrientation} ${blue.turns}t ${blue.rotationDirection}`);
    }
    if (red) {
      lines.push(`RED@GridB: ${red.motionType} ${red.startLocation}→${red.endLocation} ori:${red.startOrientation}→${red.endOrientation} ${red.turns}t ${red.rotationDirection}`);
    }

    // Check for conjoined overlap: do the props occupy the same physical point?
    if (blue && red) {
      const blueEnd = blue.endLocation?.toLowerCase();
      const redEnd = red.endLocation?.toLowerCase();
      const blueCoord = STRICT_COORDS[blueEnd];
      const redCoord = STRICT_COORDS[redEnd];

      if (blueCoord && redCoord) {
        const blueGlobal = {
          x: gridPositions.gridA.x + blueCoord.x,
          y: gridPositions.gridA.y + blueCoord.y,
        };
        const redGlobal = {
          x: gridPositions.gridB.x + redCoord.x,
          y: gridPositions.gridB.y + redCoord.y,
        };
        const dist = Math.hypot(blueGlobal.x - redGlobal.x, blueGlobal.y - redGlobal.y);
        if (dist < 5) {
          lines.push(`OVERLAP: blue:${blueEnd} + red:${redEnd} → same physical point (${blueGlobal.x}, ${blueGlobal.y}) — needs conjoined beta separation`);
        }
      }
    }

    // Start/end positions if available
    if (p.startPosition) lines.push(`startPos: ${p.startPosition}`);
    if (p.endPosition) lines.push(`endPos: ${p.endPosition}`);

    return lines.join("\n");
  }

  async function handleCopy() {
    const text = buildConjoinedSummary();
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = "Copied!";
      setTimeout(() => { copyFeedback = ""; }, 1500);
    } catch {
      copyFeedback = "Failed";
      setTimeout(() => { copyFeedback = ""; }, 1500);
    }
  }
</script>

<div class="conjoined-lab">
  <header class="lab-header">
    <h1>Conjoined Lab</h1>
    <p>Single pictograph split across two grids — blue on left, red on right</p>
  </header>

  <div class="lab-content">
    <!-- Main canvas area -->
    <div class="canvas-area">
      {#if isLoading}
        <div class="loading-state">
          <i class="fas fa-circle-notch fa-spin"></i>
          <span>Preparing pictograph...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{error}</span>
        </div>
      {:else}
        <ConjoinedCanvas
          pictograph={preparedPictograph}
          {layout}
          darkMode={true}
          showGrid={true}
          showArrows={true}
        />
      {/if}
    </div>

    <!-- Controls sidebar -->
    <aside class="controls-sidebar">
      <ConjoinedControls
        {layout}
        onLayoutChange={handleLayoutChange}
        onArrangementChange={handleArrangementChange}
        onSpacingChange={handleSpacingChange}
      />

      <!-- Pictograph selector -->
      <div class="pictograph-selector">
        <h3>Pictograph</h3>
        <div class="selector-display">
          <span class="letter-label">{currentLetter}</span>
          <span class="variation-label">
            {selectedIndex + 1} / {allPictographs.length}
          </span>
        </div>
        <div class="selector-nav">
          <button
            class="nav-btn"
            onclick={handlePrev}
            disabled={selectedIndex === 0}
            title="Previous variation"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <button
            class="nav-btn"
            onclick={handleNext}
            disabled={selectedIndex >= allPictographs.length - 1}
            title="Next variation"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        <button
          class="copy-btn"
          onclick={handleCopy}
          disabled={!currentPictograph}
          title="Copy pictograph data to clipboard"
        >
          <i class="fas {copyFeedback === 'Copied!' ? 'fa-check' : 'fa-copy'}"></i>
          <span>{copyFeedback || "Copy Data"}</span>
        </button>
      </div>
    </aside>
  </div>
</div>

<style>
  .conjoined-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .lab-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .lab-header h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--theme-text, #ffffff);
  }

  .lab-header p {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .lab-content {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 16px;
    padding: 16px;
  }

  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
    min-height: 400px;
  }

  .controls-sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 240px;
    flex-shrink: 0;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .loading-state i,
  .error-state i {
    font-size: 24px;
  }

  .error-state {
    color: var(--semantic-error, #ef4444);
  }

  .pictograph-selector {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pictograph-selector h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .selector-display {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .letter-label {
    font-size: 28px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .variation-label {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .selector-nav {
    display: flex;
    gap: 8px;
  }

  .nav-btn {
    flex: 1;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--theme-accent, #10b981);
    border-color: var(--theme-accent, #10b981);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-btn i {
    font-size: 14px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover:not(:disabled) {
    background: var(--theme-accent, #10b981);
    border-color: var(--theme-accent, #10b981);
  }

  .copy-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .copy-btn i {
    font-size: 13px;
  }

  /* Responsive: stack on smaller screens */
  @media (max-width: 768px) {
    .lab-content {
      flex-direction: column;
    }

    .controls-sidebar {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .canvas-area {
      min-height: 300px;
    }
  }
</style>
