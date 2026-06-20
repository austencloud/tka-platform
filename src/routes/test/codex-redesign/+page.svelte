<!--
  Codex redesign prototypes — pick the sidebar/layout direction for the unified
  Codex tab. Throwaway harness for the brainstorm (visualization-routing: real
  components, not mockups).

  Demonstrates, in all three layouts:
    - LIVE PictographContainer rendering (canvas → Svelte component switch), so
      rotate/mirror/colorswap transforms ANIMATE via the built-in PropSvg/ArrowSvg
      transitions.
    - The MERGED glyph toggle (TnD + Elemental are one glyph → one control).

  Layout variants:
    Toolbar = controls in a top bar, sidebar is a focused letter map.
    Sidebar = reorganized left sidebar, controls grouped within it.
    Hybrid  = letter-map sidebar + a slim transform/glyph toolbar over the grid.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import CodexControlPanel from "$lib/features/learn/codex/components/CodexControlPanel.svelte";
  import { getCodex } from "$lib/features/learn/codex/get-codex";
  import CodexSheetPicker from "./CodexSheetPicker.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  type Layout = "toolbar" | "sidebar" | "hybrid";
  let layout = $state<Layout>("toolbar");

  // Dark mode is the user's GLOBAL setting — read and write it through the
  // animation visibility manager so the codex honors (and persists) it.
  const animVis = getAnimationVisibilityManager();

  let selectedLetter = $state("A");
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let transformed = $state<PictographData[] | null>(null);
  let transformedReps = $state<Map<string, PictographData> | null>(null);

  // Merged glyph toggle — TnD and Elemental are one glyph, so one control.
  let showGlyph = $state(true);
  let showGrid = $state(true);
  let showTKA = $state(true);
  let showPositions = $state(false);
  let showReversals = $state(false);
  let showNonRadialPoints = $state(false);
  let isDarkMode = $state(animVis.isDarkMode());

  let variations = $derived(allPictographs.filter((p) => p.letter === selectedLetter));
  let shown = $derived(transformed ?? variations);

  // One representative pictograph per letter (first variation) for the picker.
  let baseReps = $derived.by(() => {
    const m = new Map<string, PictographData>();
    for (const p of allPictographs) {
      if (p.letter && !m.has(p.letter)) m.set(p.letter, p);
    }
    return m;
  });
  let representatives = $derived(transformedReps ?? baseReps);

  const VISIBILITY_CHIPS = [
    { key: "glyph", label: "Glyph", icon: "fas fa-fire", get: () => showGlyph },
    { key: "grid", label: "Grid", icon: "fas fa-border-all", get: () => showGrid },
    { key: "tka", label: "TKA", icon: "fas fa-font", get: () => showTKA },
    { key: "positions", label: "Positions", icon: "fas fa-location-dot", get: () => showPositions },
    { key: "reversals", label: "Reversals", icon: "fas fa-left-right", get: () => showReversals },
    { key: "nonradial", label: "Non-Radial", icon: "fas fa-circle-dot", get: () => showNonRadialPoints },
  ];

  function toggle(key: string) {
    if (key === "glyph") showGlyph = !showGlyph;
    else if (key === "grid") showGrid = !showGrid;
    else if (key === "tka") showTKA = !showTKA;
    else if (key === "positions") showPositions = !showPositions;
    else if (key === "reversals") showReversals = !showReversals;
    else if (key === "nonradial") showNonRadialPoints = !showNonRadialPoints;
  }

  async function load() {
    isLoading = true;
    allPictographs = await letterQueryHandler.getAllPictographVariations(gridMode);
    isLoading = false;
  }

  function selectLetter(letter: string) {
    selectedLetter = letter;
    transformed = null;
  }

  async function setGridMode(mode: GridMode) {
    if (mode === gridMode) return;
    gridMode = mode;
    transformed = null;
    transformedReps = null;
    await load();
  }

  // Transforms act on the whole codex — both the current letter's variations
  // (right) and every representative in the picker (left).
  async function applyTransform(op: "rotate" | "mirror" | "colorswap") {
    const codex = getCodex();
    const run = (arr: PictographData[]) =>
      op === "rotate"
        ? codex.rotateAllPictographs(arr)
        : op === "mirror"
          ? codex.mirrorAllPictographs(arr)
          : codex.colorSwapAllPictographs(arr);

    const baseVars = transformed ?? variations;
    if (baseVars.length > 0) transformed = await run(baseVars);

    const repArr = [...representatives.values()];
    if (repArr.length > 0) {
      const out = await run(repArr);
      const m = new Map<string, PictographData>();
      for (const p of out) if (p.letter) m.set(p.letter, p);
      transformedReps = m;
    }
  }

  function setDark(dark: boolean) {
    isDarkMode = dark;
    animVis.setDarkMode(dark);
  }

  onMount(load);
</script>

<svelte:head><title>Codex Redesign — layout prototypes</title></svelte:head>

<!-- ============ Reusable control snippets ============ -->

{#snippet letterMap(compact = false)}
  <CodexSheetPicker {selectedLetter} {representatives} darkMode={isDarkMode} onSelect={selectLetter} />
{/snippet}

{#snippet gridModeControl()}
  <SegmentedControl
    options={[
      { value: GridMode.DIAMOND, label: "Diamond", icon: "fas fa-gem" },
      { value: GridMode.BOX, label: "Box", icon: "fas fa-square" },
    ]}
    value={gridMode}
    onchange={setGridMode}
    color="accent"
    size="sm"
  />
{/snippet}

{#snippet transformControl()}
  <CodexControlPanel
    showOrientation={false}
    onRotate={() => applyTransform("rotate")}
    onMirror={() => applyTransform("mirror")}
    onColorSwap={() => applyTransform("colorswap")}
  />
{/snippet}

{#snippet visibilityControl()}
  <div class="vis-chips">
    {#each VISIBILITY_CHIPS as chip}
      <FilterChipBase
        mode="toggle"
        size="sm"
        label={chip.label}
        icon={chip.icon}
        active={chip.get()}
        onclick={() => toggle(chip.key)}
      />
    {/each}
  </div>
{/snippet}

{#snippet darkControl()}
  <SegmentedControl
    options={[
      { value: "light", label: "Light", icon: "fas fa-sun" },
      { value: "dark", label: "Dark", icon: "fas fa-moon" },
    ]}
    value={isDarkMode ? "dark" : "light"}
    onchange={(v) => setDark(v === "dark")}
    color="accent"
    size="sm"
  />
{/snippet}

{#snippet pictographGrid()}
  {#if isLoading}
    <div class="state"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>
  {:else if shown.length === 0}
    <div class="state">No variations for "{selectedLetter}"</div>
  {:else}
    <div class="pgrid">
      {#each shown as v, i (v.id ?? i)}
        <figure class="pcard" class:dark={isDarkMode}>
          <div class="pwrap">
            <PictographContainer
              pictographData={v}
              darkMode={isDarkMode}
              {showGrid}
              {showTKA}
              showTnD={showGlyph}
              showElemental={showGlyph}
              {showPositions}
              {showReversals}
              {showNonRadialPoints}
            />
          </div>
        </figure>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- ============ Page ============ -->

<div class="page" class:dark={isDarkMode}>
  <header class="topbar">
    <div class="lead">
      <h1>Codex Redesign</h1>
      <span class="sub">{selectedLetter} · {shown.length} variation{shown.length !== 1 ? "s" : ""} · live render + animated transforms</span>
    </div>
    <SegmentedControl
      options={[
        { value: "toolbar", label: "A · Toolbar", icon: "fas fa-grip-lines" },
        { value: "sidebar", label: "B · Sidebar", icon: "fas fa-table-columns" },
        { value: "hybrid", label: "C · Hybrid", icon: "fas fa-object-group" },
      ]}
      value={layout}
      onchange={(v) => (layout = v)}
      color="accent"
    />
  </header>

  {#if layout === "toolbar"}
    <!-- A: controls in a top toolbar; sidebar = focused letter map -->
    <div class="toolbar-strip">
      <div class="tg">{@render gridModeControl()}</div>
      <div class="tg">{@render transformControl()}</div>
      <div class="tg grow">{@render visibilityControl()}</div>
      <div class="tg">{@render darkControl()}</div>
    </div>
    <div class="body two-col">
      <aside class="rail">{@render letterMap()}</aside>
      <main class="stage">{@render pictographGrid()}</main>
    </div>

  {:else if layout === "sidebar"}
    <!-- B: reorganized left sidebar, controls grouped within -->
    <div class="body two-col">
      <aside class="rail wide">
        <section class="panel">{@render letterMap()}</section>
        <section class="panel"><h3>Grid Mode</h3>{@render gridModeControl()}</section>
        <section class="panel"><h3>Transform</h3>{@render transformControl()}</section>
        <section class="panel"><h3>Visibility</h3>{@render visibilityControl()}<div class="spacer"></div>{@render darkControl()}</section>
      </aside>
      <main class="stage">{@render pictographGrid()}</main>
    </div>

  {:else}
    <!-- C: letter-map sidebar + slim transform/glyph toolbar over the grid -->
    <div class="body two-col">
      <aside class="rail">
        {@render letterMap()}
        <section class="panel tight"><h3>Grid Mode</h3>{@render gridModeControl()}{@render darkControl()}</section>
      </aside>
      <main class="stage">
        <div class="stage-toolbar">
          <div class="tg">{@render transformControl()}</div>
          <div class="tg grow">{@render visibilityControl()}</div>
        </div>
        <div class="stage-scroll">{@render pictographGrid()}</div>
      </main>
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--theme-panel-bg, #12121c);
    color: var(--theme-text, #f0f0f5);
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
  }
  .lead h1 { margin: 0; font-size: 1.05rem; font-weight: 700; }
  .sub { font-size: 0.78rem; color: var(--theme-text-dim, rgba(255, 255, 255, 0.55)); font-variant-numeric: tabular-nums; }

  /* Top toolbar (variant A) */
  .toolbar-strip {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-wrap: wrap;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }
  .tg { display: flex; align-items: center; }
  .tg.grow { flex: 1; }

  .body { flex: 1; min-height: 0; display: flex; }
  /* Codex column hugs its content (no swimming); variations take the rest. */
  .two-col { display: grid; grid-template-columns: auto 1fr; }

  .rail {
    padding: 14px;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .rail.wide { width: 100%; }

  .panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 12px;
  }
  .panel.tight { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .panel h3 {
    margin: 0 0 8px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .spacer { height: 10px; }

  .vis-chips { display: flex; flex-wrap: wrap; gap: 6px; }

  /* Stage */
  .stage { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .stage-toolbar {
    display: flex; align-items: center; gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-wrap: wrap; flex-shrink: 0;
  }
  .stage-scroll { flex: 1; min-height: 0; overflow-y: auto; }

  /* Variations grid: a multiple of four columns (16 variations → 4×4), centered. */
  .pgrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 170px));
    justify-content: center;
    gap: 14px;
    padding: 16px;
  }
  .pcard {
    margin: 0; padding: 8px;
    border-radius: 12px;
    background: #f6f7fb;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transition: transform 120ms, box-shadow 120ms;
  }
  .pcard:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.28); }
  .pcard.dark { background: #0a0a12; }
  .pwrap { aspect-ratio: 1; width: 100%; }

  .stage .pgrid { padding: 16px; }
  main.stage { overflow-y: auto; }
  main.stage > .pgrid { }

  .state {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 60px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
