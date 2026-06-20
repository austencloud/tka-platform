<!--
  CodexExplorer.svelte — the unified Codex tab.

  Top toolbar (grid mode · transforms · visibility · dark) over an adjustable
  split (shared PanelGroup primitive): the canonical codex picker on the left,
  the selected letter's variations on the right.

  Real render pipeline throughout (PictographContainer + letterQueryHandler):
  rotate/mirror/colorswap transforms animate via the built-in PropSvg/ArrowSvg
  transitions; TnD + Elemental are one merged "Glyph" toggle; dark mode follows
  the user's GLOBAL setting. View prefs (letter, grid mode, visibility, split)
  persist across reloads via createCodexExplorerState.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import CodexControlPanel from "./CodexControlPanel.svelte";
  import CodexSheetPicker from "./CodexSheetPicker.svelte";
  import { createCodexExplorerState } from "../state/codex-explorer-state.svelte";
  import type { CodexExplorerVisibility } from "../state/codex-explorer-persistence";
  import { getCodex } from "../get-codex";

  // Persisted view state (letter, grid mode, visibility, split sizes).
  const view = createCodexExplorerState();
  // Dark mode is the user's GLOBAL setting.
  const animVis = getAnimationVisibilityManager();
  let isDarkMode = $state(animVis.isDarkMode());

  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let transformed = $state<PictographData[] | null>(null);
  let transformedReps = $state<Map<string, PictographData> | null>(null);

  let variations = $derived(allPictographs.filter((p) => p.letter === view.selectedLetter));
  let shown = $derived(transformed ?? variations);

  let baseReps = $derived.by(() => {
    const m = new Map<string, PictographData>();
    for (const p of allPictographs) {
      if (p.letter && !m.has(p.letter)) m.set(p.letter, p);
    }
    return m;
  });
  let representatives = $derived(transformedReps ?? baseReps);

  const VISIBILITY_CHIPS: { key: keyof CodexExplorerVisibility; label: string; icon: string }[] = [
    { key: "showGlyph", label: "Glyph", icon: "fas fa-fire" },
    { key: "showGrid", label: "Grid", icon: "fas fa-border-all" },
    { key: "showTKA", label: "TKA", icon: "fas fa-font" },
    { key: "showPositions", label: "Positions", icon: "fas fa-location-dot" },
    { key: "showReversals", label: "Reversals", icon: "fas fa-left-right" },
    { key: "showNonRadialPoints", label: "Non-Radial", icon: "fas fa-circle-dot" },
  ];

  async function load() {
    isLoading = true;
    allPictographs = await letterQueryHandler.getAllPictographVariations(view.gridModeEnum);
    isLoading = false;
  }

  function selectLetter(letter: string) {
    view.selectedLetter = letter;
    transformed = null;
  }

  async function setGridMode(mode: GridMode) {
    if (mode === view.gridModeEnum) return;
    view.gridMode = mode === GridMode.BOX ? "box" : "diamond";
    transformed = null;
    transformedReps = null;
    await load();
  }

  // Transforms act on the whole codex — current variations AND every picker rep.
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

<!-- ============ Control snippets ============ -->

{#snippet gridModeControl()}
  <SegmentedControl
    options={[
      { value: GridMode.DIAMOND, label: "Diamond", icon: "fas fa-gem" },
      { value: GridMode.BOX, label: "Box", icon: "fas fa-square" },
    ]}
    value={view.gridModeEnum}
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
        active={view.visibility[chip.key]}
        onclick={() => view.toggleVisibility(chip.key)}
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

<!-- ============ Split panels ============ -->

{#snippet codexPanel()}
  <div class="codex-pane themed-scrollbar">
    <CodexSheetPicker
      selectedLetter={view.selectedLetter}
      {representatives}
      darkMode={isDarkMode}
      onSelect={selectLetter}
    />
  </div>
{/snippet}

{#snippet variationsPanel()}
  <div class="vars-pane themed-scrollbar">
    {#if isLoading}
      <div class="state"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading…</div>
    {:else if shown.length === 0}
      <div class="state">No variations for "{view.selectedLetter}"</div>
    {:else}
      <div class="pgrid">
        {#each shown as v, i (v.id ?? i)}
          <figure class="pcard" class:dark={isDarkMode}>
            <div class="pwrap">
              <PictographContainer
                pictographData={v}
                darkMode={isDarkMode}
                showGrid={view.visibility.showGrid}
                showTKA={view.visibility.showTKA}
                showTnD={view.visibility.showGlyph}
                showElemental={view.visibility.showGlyph}
                showPositions={view.visibility.showPositions}
                showReversals={view.visibility.showReversals}
                showNonRadialPoints={view.visibility.showNonRadialPoints}
              />
            </div>
          </figure>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<!-- ============ Tab ============ -->

<div class="codex-explorer" class:dark={isDarkMode}>
  <header class="topbar">
    <div class="lead">
      <h2>Codex</h2>
      <span class="sub">{view.selectedLetter} · {shown.length} variation{shown.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="controls">
      <div class="cg">{@render gridModeControl()}</div>
      <div class="cg">{@render transformControl()}</div>
      <div class="cg grow">{@render visibilityControl()}</div>
      <div class="cg">{@render darkControl()}</div>
    </div>
  </header>

  <div class="body">
    <PanelGroup
      direction="horizontal"
      sizes={view.splitSizes}
      onSizesChange={(s) => (view.splitSizes = s)}
      panels={[
        { id: "codex", content: codexPanel, defaultSize: 5, minSize: 320 },
        { id: "vars", content: variationsPanel, defaultSize: 6, minSize: 360 },
      ]}
    />
  </div>
</div>

<style>
  .codex-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
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
    flex-wrap: wrap;
  }
  .lead h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
  .sub {
    font-size: 0.78rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-variant-numeric: tabular-nums;
  }

  .controls { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .cg { display: flex; align-items: center; }

  .body { flex: 1; min-height: 0; display: flex; }

  .codex-pane {
    height: 100%;
    overflow-y: auto;
    padding: 16px 18px;
  }

  /* Variations centered both axes (safe = no clip when it overflows). */
  .vars-pane {
    height: 100%;
    overflow-y: auto;
    display: flex;
    align-items: safe center;
    justify-content: safe center;
    padding: 16px;
  }

  .vis-chips { display: flex; flex-wrap: wrap; gap: 6px; }

  /* Variations grid: a multiple of four columns (16 → 4×4). */
  .pgrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 170px));
    gap: 14px;
  }
  .pcard {
    margin: 0;
    padding: 8px;
    border-radius: 12px;
    background: #f6f7fb;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transition: transform 120ms, box-shadow 120ms;
  }
  .pcard:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28); }
  .pcard.dark { background: #0a0a12; }
  .pwrap { aspect-ratio: 1; width: 100%; }

  .state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
