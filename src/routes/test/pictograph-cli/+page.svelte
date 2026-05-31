<script lang="ts">
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { Canvas2DDirectRenderer } from "$lib/shared/render/services/canvas-2d-direct-renderer";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  // All letters organized by type
  const TYPE1_LETTERS = "ABCDEFGHIJKLMNOPQRSTUV".split("");
  const TYPE2_6_LETTERS = ["W", "X", "Y", "Z"];
  const GREEK_LETTERS = ["α", "β", "γ", "Δ", "Θ", "Λ", "Σ", "Φ", "Ψ", "Ω"];

  // State
  let selectedLetter = $state("W");
  let isLoading = $state(true);
  let renderer: Canvas2DDirectRenderer | null = null;
  let allPictographs: PictographData[] = $state([]);

  // Variations of the selected letter
  let variations = $derived(allPictographs.filter(p => p.letter === selectedLetter));

  // Canvas refs for each variation
  let canvasRefs: (HTMLCanvasElement | null)[] = $state([]);

  // Turns override (applies to all)
  let blueTurnsOverride = $state<number | null>(null);
  let redTurnsOverride = $state<number | null>(null);

  // Visibility (using same pattern as PictographPanel)
  let showGrid = $state(true);
  let showTKA = $state(true);
  let showTnD = $state(false);
  let showElemental = $state(true);
  // Diamond vs Box — flips which dataframe + which tnd-calculator lookup runs.
  // The elemental glyph reclassifies opposite-direction families between modes.
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showPositions = $state(false);
  let showReversals = $state(false);
  let showNonRadialPoints = $state(false);
  let isDarkMode = $state(false);

  // Canvas size per pictograph
  const PICTOGRAPH_SIZE = 200;

  async function init() {
    try {
      renderer = new Canvas2DDirectRenderer(pictographPreparer);
      await renderer.initialize();

      allPictographs = await letterQueryHandler.getAllPictographVariations(gridMode);

      isLoading = false;
      await tick();
      renderAll();
    } catch (err) {
      console.error("Init failed:", err);
      isLoading = false;
    }
  }

  async function renderAll() {
    if (!renderer || variations.length === 0) return;

    for (let i = 0; i < variations.length; i++) {
      const canvas = canvasRefs[i];
      if (!canvas) continue;

      // Deep clone to get a mutable copy
      const original = variations[i];
      const pictograph: any = JSON.parse(JSON.stringify(original));

      // Apply turns overrides and recalculate endOrientation
      // (endOrientation determines prop rotation angle)
      if (blueTurnsOverride !== null && pictograph.motions?.blue) {
        pictograph.motions.blue.turns = blueTurnsOverride;
        // Recalculate endOrientation based on new turns value
        pictograph.motions.blue.endOrientation = calculateEndOrientation(
          pictograph.motions.blue,
          MotionColor.BLUE
        );
      }
      if (redTurnsOverride !== null && pictograph.motions?.red) {
        pictograph.motions.red.turns = redTurnsOverride;
        // Recalculate endOrientation based on new turns value
        pictograph.motions.red.endOrientation = calculateEndOrientation(
          pictograph.motions.red,
          MotionColor.RED
        );
      }

      try {
        const result = await renderer.renderPictograph(pictograph, {
          size: PICTOGRAPH_SIZE,
          visibility: {
            showGrid,
            showTKA,
            showTnD,
            showElemental,
            showPositions,
            showReversals,
            showNonRadialPoints,
            darkMode: isDarkMode,
            handPointVisibility: "active",
          },
        });

        const ctx = canvas.getContext("2d");
        if (ctx && result) {
          canvas.width = result.width;
          canvas.height = result.height;
          ctx.drawImage(result, 0, 0);
        }
      } catch (err) {
        console.error(`Failed to render variation ${i}:`, err);
      }
    }
  }

  function selectLetter(letter: string) {
    selectedLetter = letter;
    blueTurnsOverride = null;
    redTurnsOverride = null;
    tick().then(renderAll);
  }

  async function setGridMode(mode: GridMode) {
    if (mode === gridMode) return;
    gridMode = mode;
    blueTurnsOverride = null;
    redTurnsOverride = null;
    allPictographs = await letterQueryHandler.getAllPictographVariations(gridMode);
    await tick();
    renderAll();
  }

  function adjustTurns(color: "blue" | "red", delta: number) {
    if (color === "blue") {
      const current = blueTurnsOverride ?? (variations[0]?.motions?.blue?.turns as number ?? 0);
      blueTurnsOverride = Math.max(0, Math.min(3, current + delta));
    } else {
      const current = redTurnsOverride ?? (variations[0]?.motions?.red?.turns as number ?? 0);
      redTurnsOverride = Math.max(0, Math.min(3, current + delta));
    }
    renderAll();
  }

  function toggleVisibility(which: string) {
    switch (which) {
      case "grid": showGrid = !showGrid; break;
      case "tka": showTKA = !showTKA; break;
      case "tnd": showTnD = !showTnD; break;
      case "elemental": showElemental = !showElemental; break;
      case "positions": showPositions = !showPositions; break;
      case "reversals": showReversals = !showReversals; break;
      case "nonradial": showNonRadialPoints = !showNonRadialPoints; break;
      case "dark": isDarkMode = !isDarkMode; break;
    }
    renderAll();
  }

  // Get display value for turns
  function getBlueTurns(): number | string {
    if (blueTurnsOverride !== null) return blueTurnsOverride;
    const t = variations[0]?.motions?.blue?.turns;
    return typeof t === "number" ? t : t ?? "-";
  }

  function getRedTurns(): number | string {
    if (redTurnsOverride !== null) return redTurnsOverride;
    const t = variations[0]?.motions?.red?.turns;
    return typeof t === "number" ? t : t ?? "-";
  }

  onMount(init);
</script>

<svelte:head>
  <title>Pictograph Test Lab</title>
</svelte:head>

<div class="lab">
  <!-- Sidebar -->
  <aside class="sidebar">
    <!-- Letter Selection -->
    <section class="panel">
      <h2>Letter</h2>
      <div class="letter-groups">
        <div class="letter-group">
          <span class="group-label">Type 1</span>
          <div class="letter-grid">
            {#each TYPE1_LETTERS as letter}
              <button
                class="letter-btn"
                class:active={selectedLetter === letter}
                onclick={() => selectLetter(letter)}
              >{letter}</button>
            {/each}
          </div>
        </div>
        <div class="letter-group">
          <span class="group-label">Type 2-6</span>
          <div class="letter-grid">
            {#each TYPE2_6_LETTERS as letter}
              <button
                class="letter-btn"
                class:active={selectedLetter === letter}
                onclick={() => selectLetter(letter)}
              >{letter}</button>
            {/each}
          </div>
        </div>
        <div class="letter-group">
          <span class="group-label">Greek</span>
          <div class="letter-grid">
            {#each GREEK_LETTERS as letter}
              <button
                class="letter-btn"
                class:active={selectedLetter === letter}
                onclick={() => selectLetter(letter)}
              >{letter}</button>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <!-- Grid Mode — flips Diamond↔Box; elemental glyph reclassifies live -->
    <section class="panel">
      <h2>Grid Mode</h2>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={gridMode === GridMode.DIAMOND}
          onclick={() => setGridMode(GridMode.DIAMOND)}
        >Diamond</button>
        <button
          class="toggle-btn"
          class:active={gridMode === GridMode.BOX}
          onclick={() => setGridMode(GridMode.BOX)}
        >Box</button>
      </div>
    </section>

    <!-- Visibility Toggles (matching PictographPanel pattern) -->
    <section class="panel">
      <h2>Visibility</h2>
      <div class="toggle-grid">
        <button class="toggle-btn" class:active={showGrid} onclick={() => toggleVisibility("grid")}>Grid</button>
        <button class="toggle-btn" class:active={showTKA} onclick={() => toggleVisibility("tka")}>TKA</button>
        <button class="toggle-btn" class:active={showTnD} onclick={() => toggleVisibility("tnd")}>TnD</button>
        <button class="toggle-btn" class:active={showElemental} onclick={() => toggleVisibility("elemental")}>Elemental</button>
        <button class="toggle-btn" class:active={showPositions} onclick={() => toggleVisibility("positions")}>Positions</button>
        <button class="toggle-btn" class:active={showReversals} onclick={() => toggleVisibility("reversals")}>Reversals</button>
        <button class="toggle-btn" class:active={showNonRadialPoints} onclick={() => toggleVisibility("nonradial")}>Non-Radial</button>
      </div>
      <button class="toggle-btn wide" class:active={isDarkMode} onclick={() => toggleVisibility("dark")}>
        {isDarkMode ? "Dark Mode" : "Light Mode"}
      </button>
    </section>

    <!-- Turns Controls -->
    <section class="panel">
      <h2>Turns Override</h2>
      <div class="turns-controls">
        <div class="turns-row">
          <span class="turns-label blue">Blue</span>
          <div class="turns-stepper">
            <button onclick={() => adjustTurns("blue", -0.5)}>−</button>
            <span class="turns-value">{getBlueTurns()}</span>
            <button onclick={() => adjustTurns("blue", 0.5)}>+</button>
          </div>
        </div>
        <div class="turns-row">
          <span class="turns-label red">Red</span>
          <div class="turns-stepper">
            <button onclick={() => adjustTurns("red", -0.5)}>−</button>
            <span class="turns-value">{getRedTurns()}</span>
            <button onclick={() => adjustTurns("red", 0.5)}>+</button>
          </div>
        </div>
      </div>
    </section>
  </aside>

  <!-- Main Content -->
  <main class="main">
    <header class="header">
      <h1>Pictograph Test Lab</h1>
      <span class="variation-count">{variations.length} variation{variations.length !== 1 ? "s" : ""}</span>
    </header>

    <div class="mission-banner">
      <div class="mission-icon">🎯</div>
      <div class="mission-text">
        <strong>Purpose:</strong> This lab validates the MCP (Model Context Protocol) pictograph rendering pipeline.
        It's the first step toward enabling AI agents to work with TKA images and sequences intelligently-
        not just as data, but as actual rendered visuals that can be reasoned about, compared, and manipulated
        programmatically through a CLI tool.
      </div>
    </div>

    {#if isLoading}
      <div class="loading">
        <span>Loading pictographs...</span>
      </div>
    {:else if variations.length === 0}
      <div class="empty">
        <span>No variations found for letter "{selectedLetter}"</span>
      </div>
    {:else}
      <div class="pictograph-grid">
        {#each variations as variation, i}
          <div class="pictograph-card" class:dark={isDarkMode}>
            <canvas
              bind:this={canvasRefs[i]}
              width={PICTOGRAPH_SIZE}
              height={PICTOGRAPH_SIZE}
            ></canvas>
            <div class="card-info">
              <span class="motion-info">
                {variation.motions?.blue?.startLocation}→{variation.motions?.blue?.endLocation}
                /
                {variation.motions?.red?.startLocation}→{variation.motions?.red?.endLocation}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .lab {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
    background: var(--theme-panel-bg, #12121c);
    color: var(--theme-text, #f0f0f5);
  }

  /* Sidebar */
  .sidebar {
    padding: 16px;
    border-right: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .panel {
    background: var(--theme-card-bg, rgba(255,255,255,0.03));
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.08));
    border-radius: 12px;
    padding: 12px;
  }

  .panel h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
    margin: 0 0 10px 0;
  }

  /* Letter Grid */
  .letter-groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-muted, rgba(255,255,255,0.4));
    display: block;
    margin-bottom: 4px;
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .letter-btn {
    aspect-ratio: 1;
    border-radius: 4px;
    border: 1px solid transparent;
    background: rgba(255,255,255,0.05);
    color: var(--theme-text, #fff);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .letter-btn:hover {
    background: rgba(255,255,255,0.1);
  }

  .letter-btn.active {
    background: var(--theme-accent, #50c878);
    color: #000;
    font-weight: 600;
  }

  /* Toggle Buttons (matching PictographPanel pattern) */
  .toggle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .toggle-btn {
    padding: 10px 8px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    background: rgba(255,255,255,0.03);
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .toggle-btn:hover {
    background: rgba(255,255,255,0.06);
    color: var(--theme-text, #fff);
  }

  .toggle-btn.active {
    background: var(--theme-accent, #50c878);
    border-color: var(--theme-accent, #50c878);
    color: #000;
  }

  .toggle-btn.wide {
    grid-column: 1 / -1;
    margin-top: 6px;
  }

  /* Turns Controls */
  .turns-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .turns-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .turns-label {
    font-size: 12px;
    font-weight: 600;
    width: 40px;
  }

  .turns-label.blue { color: #3b82f6; }
  .turns-label.red { color: #ef4444; }

  .turns-stepper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    padding: 6px;
  }

  .turns-stepper button {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15));
    background: rgba(255,255,255,0.05);
    color: var(--theme-text, #fff);
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .turns-stepper button:hover {
    background: rgba(255,255,255,0.1);
  }

  .turns-value {
    font-size: 18px;
    font-weight: 700;
    min-width: 36px;
    text-align: center;
  }

  /* Main Content */
  .main {
    padding: 16px;
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 16px;
  }

  .header h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-accent, #50c878);
  }

  .variation-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
  }

  .mission-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(80, 200, 120, 0.08);
    border: 1px solid rgba(80, 200, 120, 0.2);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }

  .mission-icon {
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
  }

  .mission-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--theme-text-muted, rgba(255,255,255,0.7));
  }

  .mission-text strong {
    color: var(--theme-accent, #50c878);
  }

  .loading, .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
  }

  /* Pictograph Grid */
  .pictograph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .pictograph-card {
    background: #f8f8fc;
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: background var(--duration-normal);
  }

  .pictograph-card.dark {
    background: #0a0a12;
  }

  .pictograph-card canvas {
    display: block;
    border-radius: 8px;
  }

  .card-info {
    text-align: center;
  }

  .motion-info {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
    font-family: monospace;
  }

  .pictograph-card.dark .motion-info {
    color: rgba(255,255,255,0.4);
  }

  .pictograph-card:not(.dark) .motion-info {
    color: rgba(0,0,0,0.5);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .lab {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    }

    .letter-grid {
      grid-template-columns: repeat(11, 1fr);
    }

    .pictograph-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }
</style>
