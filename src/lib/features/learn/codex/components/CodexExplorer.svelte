<!--
  The visual Kinetic Alphabet reference. This is the surviving Learn Codex
  capability restored as a shared component: the canonical grouped picker on
  the left, every dataframe variation for the selected letter on the right.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import CodexControlPanel from "./CodexControlPanel.svelte";
  import CodexSheetPicker from "./CodexSheetPicker.svelte";
  import { createCodexExplorerState } from "../state/codex-explorer-state.svelte";
  import type { CodexExplorerVisibility } from "../state/codex-explorer-persistence";
  import { getCodex } from "../get-codex";

  let { initialLetter = null }: { initialLetter?: string | null } = $props();

  const view = createCodexExplorerState();
  if (initialLetter) view.selectedLetter = initialLetter;

  const animationVisibility = getAnimationVisibilityManager();
  let isDarkMode = $state(animationVisibility.isDarkMode());
  let rootElement = $state<HTMLDivElement>();
  let variationsElement = $state<HTMLDivElement>();
  let stacked = $state(false);
  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let loadError = $state(false);
  let transformed = $state<PictographData[] | null>(null);
  let transformedRepresentatives = $state<Map<string, PictographData> | null>(
    null
  );

  const extensionSelected = $derived(view.selectedLetter === "τ-");
  const variations = $derived(
    allPictographs.filter(
      (pictograph) => pictograph.letter === view.selectedLetter
    )
  );
  const shown = $derived(transformed ?? variations);
  const representativeBaseline = $derived.by(() => {
    const byLetter = new Map<string, PictographData>();
    for (const pictograph of allPictographs) {
      if (pictograph.letter && !byLetter.has(pictograph.letter)) {
        byLetter.set(pictograph.letter, pictograph);
      }
    }
    return byLetter;
  });
  const representatives = $derived(
    transformedRepresentatives ?? representativeBaseline
  );

  const VISIBILITY_CHIPS: {
    key: keyof CodexExplorerVisibility;
    label: string;
    icon: string;
  }[] = [
    { key: "showGlyph", label: "Glyph", icon: "fas fa-fire" },
    { key: "showGrid", label: "Grid", icon: "fas fa-border-all" },
    { key: "showTKA", label: "TKA", icon: "fas fa-font" },
    { key: "showPositions", label: "Positions", icon: "fas fa-location-dot" },
    { key: "showReversals", label: "Reversals", icon: "fas fa-left-right" },
    {
      key: "showNonRadialPoints",
      label: "Non-Radial",
      icon: "fas fa-circle-dot",
    },
  ];

  function reportFailure(
    error: unknown,
    action: string,
    message: string
  ): void {
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    getErrorHandler().showUserError({
      message,
      technicalDetails: normalized.stack ?? normalized.message,
      error: normalized,
      severity: "error",
      context: {
        module: "learn-codex",
        tab: "visual-explorer",
        action,
      },
    });
  }

  async function load(): Promise<void> {
    isLoading = true;
    loadError = false;
    try {
      allPictographs = await letterQueryHandler.getAllPictographVariations(
        view.gridModeEnum
      );
    } catch (error) {
      loadError = true;
      reportFailure(error, "load-variations", "The Codex could not load.");
    } finally {
      isLoading = false;
    }
  }

  async function revealVariations(): Promise<void> {
    await tick();
    if (!stacked || !variationsElement) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    variationsElement.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }

  function selectLetter(letter: string): void {
    view.selectedLetter = letter;
    transformed = null;
    if (stacked) void revealVariations();
  }

  async function setGridMode(mode: GridMode): Promise<void> {
    if (mode === view.gridModeEnum) return;
    view.gridMode = mode === GridMode.BOX ? "box" : "diamond";
    transformed = null;
    transformedRepresentatives = null;
    await load();
  }

  async function applyTransform(
    operation: "rotate" | "mirror" | "colorswap"
  ): Promise<void> {
    try {
      const codex = getCodex();
      const run = (pictographs: PictographData[]) =>
        operation === "rotate"
          ? codex.rotateAllPictographs(pictographs)
          : operation === "mirror"
            ? codex.mirrorAllPictographs(pictographs)
            : codex.colorSwapAllPictographs(pictographs);

      const selectedBase = transformed ?? variations;
      if (selectedBase.length > 0) transformed = await run(selectedBase);

      const representativeArray = [...representatives.values()];
      if (representativeArray.length > 0) {
        const output = await run(representativeArray);
        const byLetter = new Map<string, PictographData>();
        for (const pictograph of output) {
          if (pictograph.letter) byLetter.set(pictograph.letter, pictograph);
        }
        transformedRepresentatives = byLetter;
      }
    } catch (error) {
      reportFailure(
        error,
        `transform-${operation}`,
        "That Codex transform could not be applied."
      );
    }
  }

  function setDarkMode(dark: boolean): void {
    isDarkMode = dark;
    animationVisibility.setDarkMode(dark);
  }

  onMount(() => {
    if (!rootElement) return;

    const updateLayout = () => {
      if (rootElement) stacked = rootElement.clientWidth < 860;
    };
    updateLayout();
    void load().then(() => {
      if (initialLetter && initialLetter !== "A") void revealVariations();
    });
    const observer = new ResizeObserver(updateLayout);
    observer.observe(rootElement);
    return () => observer.disconnect();
  });
</script>

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
  <div class="visibility-chips">
    {#each VISIBILITY_CHIPS as chip (chip.key)}
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

{#snippet darkModeControl()}
  <SegmentedControl
    options={[
      { value: "light", label: "Light", icon: "fas fa-sun" },
      { value: "dark", label: "Dark", icon: "fas fa-moon" },
    ]}
    value={isDarkMode ? "dark" : "light"}
    onchange={(value) => setDarkMode(value === "dark")}
    color="accent"
    size="sm"
  />
{/snippet}

{#snippet codexPanel()}
  <div class="codex-pane themed-scrollbar">
    <CodexSheetPicker
      selectedLetter={view.selectedLetter}
      {representatives}
      darkMode={isDarkMode}
      onSelect={selectLetter}
    />

    <button
      type="button"
      class="extension-card"
      class:active={extensionSelected}
      aria-pressed={extensionSelected}
      onclick={() => selectLetter("τ-")}
    >
      <span class="extension-symbol">τ-</span>
      <span class="extension-copy">
        <strong>Registered Type 4 extension</strong>
        <span>No dataframe variations.</span>
      </span>
      <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
    </button>
  </div>
{/snippet}

{#snippet variationsPanel()}
  <div
    class="variations-pane themed-scrollbar"
    aria-busy={isLoading}
    bind:this={variationsElement}
  >
    {#if isLoading}
      <div class="state-message">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        Loading pictographs…
      </div>
    {:else if loadError}
      <div class="state-message error-state">
        <span>The pictographs did not load.</span>
        <button type="button" onclick={load}>Try again</button>
      </div>
    {:else if extensionSelected}
      <div class="extension-detail">
        <span class="extension-detail-symbol">τ-</span>
        <h3>Registered Type 4 extension</h3>
        <p>No dataframe variations.</p>
      </div>
    {:else if shown.length === 0}
      <div class="state-message">
        No variations for “{view.selectedLetter}”.
      </div>
    {:else}
      <div class="pictograph-grid">
        {#each shown as pictograph, index (pictograph.id ?? index)}
          <figure class="pictograph-card" class:dark={isDarkMode}>
            <div class="pictograph-wrap">
              <PictographContainer
                pictographData={pictograph}
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
            <figcaption class="visually-hidden">
              {view.selectedLetter} variation {index + 1}
            </figcaption>
          </figure>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div
  class="codex-explorer"
  class:dark={isDarkMode}
  class:stacked
  bind:this={rootElement}
>
  <header class="topbar">
    <div class="lead">
      <h2>Codex</h2>
      <span class="selection-count">
        {#if extensionSelected}
          {view.selectedLetter} · extension
        {:else}
          {view.selectedLetter} · {shown.length} variation{shown.length === 1
            ? ""
            : "s"}
        {/if}
      </span>
    </div>
    <div class="controls">
      <div class="control-group">{@render gridModeControl()}</div>
      <div class="control-group">{@render transformControl()}</div>
      <div class="control-group grow">{@render visibilityControl()}</div>
      <div class="control-group">{@render darkModeControl()}</div>
    </div>
  </header>

  <div class="body" class:stacked>
    <PanelGroup
      direction="horizontal"
      sizes={view.splitSizes}
      onSizesChange={(sizes) => (view.splitSizes = sizes)}
      flattened={stacked}
      panels={[
        { id: "codex", content: codexPanel, defaultSize: 5, minSize: 420 },
        {
          id: "variations",
          content: variationsPanel,
          defaultSize: 6,
          minSize: 420,
        },
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
    overflow: hidden;
    background: var(--theme-panel-bg, oklch(0.14 0.02 270));
    color: var(--theme-text, #f0f0f5);
    container-type: inline-size;
  }
  .codex-explorer.stacked {
    height: auto;
    overflow: visible;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .lead {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .lead h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }
  .selection-count {
    font-size: var(--font-size-compact, 0.8rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-variant-numeric: tabular-nums;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .control-group {
    display: flex;
    align-items: center;
  }
  .control-group.grow {
    flex: 1 1 24rem;
  }
  .control-group :global(.codex-control-panel) {
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .visibility-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .body.stacked {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }
  .codex-pane,
  .variations-pane {
    height: 100%;
    min-width: 0;
    overflow-y: auto;
  }
  .codex-pane {
    padding: 1rem 1.1rem 1.5rem;
  }
  .variations-pane {
    display: flex;
    align-items: safe center;
    justify-content: safe center;
    padding: 1rem;
    container-type: inline-size;
  }
  .body.stacked .codex-pane,
  .body.stacked .variations-pane {
    height: auto;
    overflow: visible;
  }
  .body.stacked .codex-pane {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .extension-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    width: min(100%, 34rem);
    min-height: 44px;
    margin: 1.5rem auto 0;
    padding: 0.75rem 1rem;
    color: var(--theme-text, #f0f0f5);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }
  .extension-card:hover,
  .extension-card.active {
    border-color: var(--theme-accent, #7d75ff);
    background: color-mix(
      in oklab,
      var(--theme-accent, #7d75ff) 12%,
      var(--theme-card-bg, #191925)
    );
  }
  .extension-card:focus-visible {
    outline: 2px solid var(--theme-accent, #7d75ff);
    outline-offset: 2px;
  }
  .extension-symbol,
  .extension-detail-symbol {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.65rem;
    font-weight: 700;
  }
  .extension-copy {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .extension-copy strong {
    font-size: var(--font-size-min, 0.875rem);
  }
  .extension-copy span {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }
  .extension-card > i {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }

  .pictograph-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.85rem;
    width: 100%;
  }
  @container (min-width: 28rem) {
    .pictograph-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container (min-width: 48rem) {
    .pictograph-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @container (min-width: 68rem) {
    .pictograph-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .pictograph-card {
    margin: 0;
    padding: 0.5rem;
    border-radius: 0.8rem;
    background: #f6f7fb;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transition:
      transform var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }
  .pictograph-card.dark {
    background: #0a0a12;
  }
  .pictograph-wrap {
    aspect-ratio: 1;
    width: 100%;
  }

  .state-message,
  .extension-detail {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    min-height: 18rem;
    padding: 2rem 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    text-align: center;
  }
  .error-state,
  .extension-detail {
    flex-direction: column;
  }
  .state-message button {
    min-height: 44px;
    padding: 0.6rem 1rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.22));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #f0f0f5);
    cursor: pointer;
  }
  .extension-detail h3,
  .extension-detail p {
    margin: 0;
  }
  .extension-detail h3 {
    color: var(--theme-text, #f0f0f5);
    font-size: 1.15rem;
  }
  .extension-detail p {
    font-size: var(--font-size-min, 0.875rem);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .pictograph-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.28);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .extension-card,
    .pictograph-card {
      transition: none;
    }
    .pictograph-card:hover {
      transform: none;
    }
  }
</style>
