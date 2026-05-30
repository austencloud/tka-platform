<!--
  PictographExplorerLab.svelte — Pictograph variation explorer

  Pick a letter, flip between Diamond and Box grid modes, and see every
  rendered variation at once. The grid-mode toggle is the centerpiece: it
  reloads the dataframe and the elemental glyph reclassifies opposite-direction
  families live, so you can watch a letter's element change between modes.

  Reuses the same rendering pipeline the app ships with (Canvas2DDirectRenderer
  + pictographPreparer) and the letter-query-handler that powers the codex —
  this tab is a thin explorer shell over those services, not a new renderer.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { Canvas2DDirectRenderer } from "$lib/shared/render/services/canvas-2d-direct-renderer";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  // Letters grouped the way the alphabet is taught: Type 1 (A-V), the
  // Type 2-6 capitals, and the Greek letters used for the higher types.
  const TYPE1_LETTERS = "ABCDEFGHIJKLMNOPQRSTUV".split("");
  const TYPE2_6_LETTERS = ["W", "X", "Y", "Z"];
  const GREEK_LETTERS = ["α", "β", "γ", "Δ", "Θ", "Λ", "Σ", "Φ", "Ψ", "Ω"];

  let selectedLetter = $state("W");
  let isLoading = $state(true);
  let renderer: Canvas2DDirectRenderer | null = null;
  let allPictographs: PictographData[] = $state([]);

  // Variations of the selected letter, recomputed whenever the letter or the
  // loaded dataframe changes.
  let variations = $derived(allPictographs.filter((p) => p.letter === selectedLetter));

  // One canvas per variation in the grid.
  let canvasRefs: (HTMLCanvasElement | null)[] = $state([]);

  // Turns override applied to every variation at once.
  let blueTurnsOverride = $state<number | null>(null);
  let redTurnsOverride = $state<number | null>(null);

  // Visibility flags mirror the app's PictographPanel toggles. Elemental is on
  // by default because the elemental glyph is the headline of this explorer.
  let showGrid = $state(true);
  let showTKA = $state(true);
  let showTnD = $state(false);
  let showElemental = $state(true);
  // Diamond vs Box flips which dataframe loads and which tnd-calculator lookup
  // runs. The elemental glyph reclassifies opposite-direction families between
  // the two modes, so this is the most interesting control on the page.
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showPositions = $state(false);
  let showReversals = $state(false);
  let showNonRadialPoints = $state(false);
  let isDarkMode = $state(false);

  const PICTOGRAPH_SIZE = 220;

  const VISIBILITY_TOGGLES = [
    { key: "grid", label: "Grid", get: () => showGrid },
    { key: "tka", label: "TKA", get: () => showTKA },
    { key: "tnd", label: "TnD", get: () => showTnD },
    { key: "elemental", label: "Elemental", get: () => showElemental },
    { key: "positions", label: "Positions", get: () => showPositions },
    { key: "reversals", label: "Reversals", get: () => showReversals },
    { key: "nonradial", label: "Non-Radial", get: () => showNonRadialPoints },
  ] as const;

  async function init() {
    try {
      renderer = new Canvas2DDirectRenderer(pictographPreparer);
      await renderer.initialize();
      allPictographs = await letterQueryHandler.getAllPictographVariations(gridMode);
      isLoading = false;
      await tick();
      renderAll();
    } catch (err) {
      console.error("Pictograph explorer init failed:", err);
      isLoading = false;
    }
  }

  async function renderAll() {
    if (!renderer || variations.length === 0) return;

    for (let i = 0; i < variations.length; i++) {
      const canvas = canvasRefs[i];
      if (!canvas) continue;

      // Clone so the turns override never mutates the shared dataframe entry.
      const original = variations[i];
      const pictograph: any = JSON.parse(JSON.stringify(original));

      // When a turns override is active, recompute endOrientation so the prop
      // rotates to the correct angle for the new turns count.
      if (blueTurnsOverride !== null && pictograph.motions?.blue) {
        pictograph.motions.blue.turns = blueTurnsOverride;
        pictograph.motions.blue.endOrientation = calculateEndOrientation(
          pictograph.motions.blue,
          MotionColor.BLUE,
        );
      }
      if (redTurnsOverride !== null && pictograph.motions?.red) {
        pictograph.motions.red.turns = redTurnsOverride;
        pictograph.motions.red.endOrientation = calculateEndOrientation(
          pictograph.motions.red,
          MotionColor.RED,
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
    isLoading = true;
    allPictographs = await letterQueryHandler.getAllPictographVariations(gridMode);
    isLoading = false;
    await tick();
    renderAll();
  }

  function adjustTurns(color: "blue" | "red", delta: number) {
    if (color === "blue") {
      const current = blueTurnsOverride ?? ((variations[0]?.motions?.blue?.turns as number) ?? 0);
      blueTurnsOverride = Math.max(0, Math.min(3, current + delta));
    } else {
      const current = redTurnsOverride ?? ((variations[0]?.motions?.red?.turns as number) ?? 0);
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
    }
    renderAll();
  }

  function getBlueTurns(): number | string {
    if (blueTurnsOverride !== null) return blueTurnsOverride;
    const t = variations[0]?.motions?.blue?.turns;
    return typeof t === "number" ? t : t ?? "—";
  }

  function getRedTurns(): number | string {
    if (redTurnsOverride !== null) return redTurnsOverride;
    const t = variations[0]?.motions?.red?.turns;
    return typeof t === "number" ? t : t ?? "—";
  }

  onMount(init);
</script>

<div class="explorer">
  <aside class="sidebar themed-scrollbar">
    <!-- Letter selection, grouped by type -->
    <section class="panel">
      <h2 class="panel-title">Letter</h2>
      <div class="letter-groups">
        {#each [{ label: "Type 1", letters: TYPE1_LETTERS }, { label: "Type 2–6", letters: TYPE2_6_LETTERS }, { label: "Greek", letters: GREEK_LETTERS }] as group}
          <div class="letter-group">
            <span class="group-label">{group.label}</span>
            <div class="letter-grid">
              {#each group.letters as letter}
                <button
                  type="button"
                  class="letter-btn"
                  class:active={selectedLetter === letter}
                  aria-pressed={selectedLetter === letter}
                  onclick={() => selectLetter(letter)}
                >{letter}</button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Centerpiece: Diamond / Box grid mode -->
    <section class="panel panel-feature">
      <h2 class="panel-title">
        Grid Mode
        <span class="panel-hint">elemental glyph reclassifies live</span>
      </h2>
      <SegmentedControl
        options={[
          { value: GridMode.DIAMOND, label: "Diamond", icon: "fas fa-gem" },
          { value: GridMode.BOX, label: "Box", icon: "fas fa-square" },
        ]}
        value={gridMode}
        onchange={setGridMode}
        color="accent"
      />
    </section>

    <!-- Visibility toggles -->
    <section class="panel">
      <h2 class="panel-title">Visibility</h2>
      <div class="toggle-grid">
        {#each VISIBILITY_TOGGLES as toggle}
          <button
            type="button"
            class="toggle-btn"
            class:active={toggle.get()}
            aria-pressed={toggle.get()}
            onclick={() => toggleVisibility(toggle.key)}
          >{toggle.label}</button>
        {/each}
      </div>
      <div class="appearance-toggle">
        <SegmentedControl
          options={[
            { value: "light", label: "Light", icon: "fas fa-sun" },
            { value: "dark", label: "Dark", icon: "fas fa-moon" },
          ]}
          value={isDarkMode ? "dark" : "light"}
          onchange={(v) => {
            isDarkMode = v === "dark";
            renderAll();
          }}
          color="accent"
          size="sm"
        />
      </div>
    </section>

    <!-- Turns override, applied to every variation at once -->
    <section class="panel">
      <h2 class="panel-title">Turns Override</h2>
      <div class="turns-controls">
        <div class="turns-row">
          <span class="turns-label blue">Blue</span>
          <div class="turns-stepper">
            <button type="button" aria-label="Decrease blue turns" onclick={() => adjustTurns("blue", -0.5)}>−</button>
            <span class="turns-value">{getBlueTurns()}</span>
            <button type="button" aria-label="Increase blue turns" onclick={() => adjustTurns("blue", 0.5)}>+</button>
          </div>
        </div>
        <div class="turns-row">
          <span class="turns-label red">Red</span>
          <div class="turns-stepper">
            <button type="button" aria-label="Decrease red turns" onclick={() => adjustTurns("red", -0.5)}>−</button>
            <span class="turns-value">{getRedTurns()}</span>
            <button type="button" aria-label="Increase red turns" onclick={() => adjustTurns("red", 0.5)}>+</button>
          </div>
        </div>
      </div>
    </section>
  </aside>

  <main class="canvas-area themed-scrollbar">
    <header class="header">
      <div class="header-lead">
        <span class="header-letter">{selectedLetter}</span>
        <div class="header-meta">
          <h1 class="header-title">Pictograph Explorer</h1>
          <span class="header-sub">
            {variations.length} variation{variations.length !== 1 ? "s" : ""}
            · {gridMode === GridMode.DIAMOND ? "Diamond" : "Box"} mode
          </span>
        </div>
      </div>
    </header>

    {#if isLoading}
      <div class="state-block">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <span>Loading pictographs…</span>
      </div>
    {:else if variations.length === 0}
      <div class="state-block">
        <i class="fas fa-circle-question" aria-hidden="true"></i>
        <span>No variations found for "{selectedLetter}"</span>
      </div>
    {:else}
      <div class="pictograph-grid">
        {#each variations as variation, i}
          <figure class="pictograph-card" class:dark={isDarkMode}>
            <canvas
              bind:this={canvasRefs[i]}
              width={PICTOGRAPH_SIZE}
              height={PICTOGRAPH_SIZE}
            ></canvas>
            <figcaption class="card-info">
              {variation.motions?.blue?.startLocation}→{variation.motions?.blue?.endLocation}
              <span class="card-sep">/</span>
              {variation.motions?.red?.startLocation}→{variation.motions?.red?.endLocation}
            </figcaption>
          </figure>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .explorer {
    display: grid;
    grid-template-columns: clamp(260px, 22cqw, 320px) 1fr;
    height: 100%;
    container-type: inline-size;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #f0f0f5);
  }

  /* Sidebar */
  .sidebar {
    padding: var(--spacing-md, 16px);
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    overflow-y: auto;
  }

  .panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 14px);
    padding: var(--spacing-sm, 12px);
  }

  /* The grid-mode panel is the headline control, so it gets an accent edge. */
  .panel-feature {
    border-color: color-mix(in srgb, var(--theme-accent, #50c878) 45%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #50c878) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
  }

  .panel-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    margin: 0 0 10px 0;
  }

  .panel-hint {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--theme-accent, #50c878);
    opacity: 0.85;
  }

  /* Letter picker */
  .letter-groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-label {
    display: block;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin-bottom: 6px;
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .letter-btn {
    aspect-ratio: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid transparent;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 120ms),
      color var(--duration-fast, 120ms),
      transform var(--duration-fast, 120ms);
  }

  .letter-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .letter-btn:active {
    transform: scale(0.94);
  }

  .letter-btn.active {
    background: var(--theme-accent, #50c878);
    color: var(--theme-text-on-accent, #06120b);
    font-weight: 700;
    box-shadow: 0 0 0 1px var(--theme-accent, #50c878);
  }

  /* Visibility toggles */
  .toggle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .toggle-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 8px 10px;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 120ms),
      border-color var(--duration-fast, 120ms),
      color var(--duration-fast, 120ms);
  }

  .toggle-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  .toggle-btn.active {
    background: var(--theme-accent, #50c878);
    border-color: var(--theme-accent, #50c878);
    color: var(--theme-text-on-accent, #06120b);
  }

  .appearance-toggle {
    margin-top: 10px;
  }

  /* Turns override */
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
    width: 40px;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }

  .turns-label.blue { color: var(--prop-blue, #3b82f6); }
  .turns-label.red { color: var(--prop-red, #ef4444); }

  .turns-stepper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.25));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 8px);
    padding: 4px;
  }

  .turns-stepper button {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font-size: 1.1rem;
    cursor: pointer;
    transition: background var(--duration-fast, 120ms);
  }

  .turns-stepper button:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .turns-value {
    min-width: 36px;
    text-align: center;
    font-size: 1.15rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* Canvas area */
  .canvas-area {
    padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
    overflow-y: auto;
  }

  .header {
    margin-bottom: var(--spacing-md, 16px);
  }

  .header-lead {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: var(--radius-lg, 14px);
    background: color-mix(in srgb, var(--theme-accent, #50c878) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #50c878) 40%, transparent);
    color: var(--theme-accent, #50c878);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1;
  }

  .header-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .header-sub {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .state-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 80px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .state-block i {
    font-size: 1.5rem;
  }

  /* Pictograph grid */
  .pictograph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
    gap: var(--spacing-md, 16px);
  }

  .pictograph-card {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: var(--radius-lg, 14px);
    background: #f6f7fb;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transition:
      transform var(--duration-fast, 120ms),
      box-shadow var(--duration-fast, 120ms),
      background var(--duration-normal, 200ms);
  }

  .pictograph-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  }

  .pictograph-card.dark {
    background: #0a0a12;
  }

  .pictograph-card canvas {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius-sm, 8px);
  }

  .card-info {
    font-size: var(--font-size-compact, 0.75rem);
    font-family: var(--font-mono, ui-monospace, monospace);
    color: rgba(0, 0, 0, 0.55);
    text-align: center;
  }

  .pictograph-card.dark .card-info {
    color: rgba(255, 255, 255, 0.5);
  }

  .card-sep {
    opacity: 0.4;
    margin: 0 2px;
  }

  /* Stack the sidebar above the grid on narrow viewports. */
  @container (max-width: 720px) {
    .explorer {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .letter-grid {
      grid-template-columns: repeat(11, 1fr);
    }
  }
</style>
