<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { FireflyForestLayers } from "$lib/shared/background/firefly-forest/services/FireflyForestBackgroundSystem";
  import type { TreeTypeVisibility, TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import {
    getFireflyForestSettings,
    updateFireflyForestSettings,
  } from "../state/background-builder-state.svelte";
  import { container } from "$lib/shared/di";
  import type {
    SmoothParams,
    WhorlParams,
    SpruceAlgorithm,
    TieredParams,
    WindsweptParams,
    PineAlgorithm,
    TreeAlgorithmParams,
  } from "../services/contracts/ITreeLabRenderer";
  import type { TreeFeedback, TreeSample } from "../services/contracts/ITreeFeedbackPersister";
  import type { PreviewStats } from "../services/contracts/IPreviewAnimationController";

  // Child components
  import PreviewControls from "./PreviewControls.svelte";
  import TreeLabControls from "./TreeLabControls.svelte";
  import SpruceParameterControls from "./SpruceParameterControls.svelte";
  import PineParameterControls from "./PineParameterControls.svelte";
  import TreeLabGrid from "./TreeLabGrid.svelte";
  import SpruceTuningGrid from "./SpruceTuningGrid.svelte";
  import PineTuningGrid from "./PineTuningGrid.svelte";

  // Get services from DI container
  const treeLabRenderer = container.items.treeLabRenderer;
  const treeFeedbackPersister = container.items.treeFeedbackPersister;
  const previewController = container.items.previewAnimationController;

  // ============================================================================
  // STATE
  // ============================================================================

  type LabMode = "preview" | "treeLab";
  let mode: LabMode = $state("preview");

  // Tree Lab state
  const TREE_TYPES: TreeType[] = ["pine", "fir", "spruce", "oak", "maple", "poplar"];
  let labTreeType: TreeType = $state("spruce");
  let treeSamples = $state<TreeSample[]>([]);
  let treeFeedback = $state<TreeFeedback>(treeFeedbackPersister.load());

  // Spruce algorithm state
  let spruceAlgorithm = $state<SpruceAlgorithm>("whorl");
  let spruceSampleSeeds = $state<number[]>([123456, 789012, 345678]);
  let smoothParams = $state<SmoothParams>({
    spread: 0.55, taperPower: 0.58, waveFreq: 6, waveAmp: 5, jitter: 2,
  });
  let whorlParams = $state<WhorlParams>({
    spread: 0.52, taperExponent: 1.5, layers: 8, droop: 0.18, jaggedness: 1.0,
  });

  // Pine algorithm state
  let pineAlgorithm = $state<PineAlgorithm>("tiered");
  let pineSampleSeeds = $state<number[]>([234567, 890123, 456789]);
  let tieredParams = $state<TieredParams>({
    tierCount: 7, tierSpacing: 1.0, spread: 0.55, uplift: 0.25, gapVisibility: 0.15,
  });
  let windsweptParams = $state<WindsweptParams>({
    windAngle: 0.4, windStrength: 0.35, tierCount: 6, asymmetry: 0.45, branchCurve: 0.3,
  });

  // Combined params for new API
  let treeParams = $derived<TreeAlgorithmParams>({
    spruce: { algorithm: spruceAlgorithm, smooth: smoothParams, whorl: whorlParams },
    pine: { algorithm: pineAlgorithm, tiered: tieredParams, windswept: windsweptParams },
  });

  // Preview state
  let canvas: HTMLCanvasElement | null = $state(null);
  const savedSettings = getFireflyForestSettings();
  let layers = $state<FireflyForestLayers>({ ...savedSettings.layers });
  let treeTypes = $state<TreeTypeVisibility>({ ...savedSettings.treeTypes });
  let quality: QualityLevel = $state(savedSettings.quality);
  let density = $state(0.5);
  let style = $state(0.5);
  let stats = $state<PreviewStats>({
    fireflies: 0, stars: 0, ambientParticles: 0, hasShootingStar: false,
  });

  // Stats polling
  let statsInterval: ReturnType<typeof setInterval> | null = null;

  // ============================================================================
  // PREVIEW HANDLERS
  // ============================================================================

  function initializePreview() {
    if (!canvas) return;
    previewController.initialize(canvas, quality, layers);
    previewController.start();
    stats = previewController.getStats();
    startStatsPolling();
  }

  function startStatsPolling() {
    statsInterval = setInterval(() => {
      if (previewController.isInitialized()) {
        stats = previewController.getStats();
      }
    }, 1000);
  }

  function stopStatsPolling() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  }

  function handleQualityChange(q: QualityLevel) {
    quality = q;
    updateFireflyForestSettings({ quality: q });
    previewController.setQuality(q);
    stats = previewController.getStats();
  }

  function handleLayerToggle(layer: keyof FireflyForestLayers) {
    layers[layer] = !layers[layer];
    updateFireflyForestSettings({ layers: { ...layers } });
    previewController.setLayerVisibility(layers);
  }

  function handleTreeTypeToggle(type: keyof TreeTypeVisibility) {
    treeTypes[type] = !treeTypes[type];
    updateFireflyForestSettings({ treeTypes: { ...treeTypes } });
    previewController.setTreeVisibility(treeTypes);
  }

  function handleDensityChange(value: number) {
    density = value;
    previewController.applyPlacement({ density, style });
  }

  function handleStyleChange(value: number) {
    style = value;
    previewController.applyPlacement({ density, style });
  }

  function handleResetPlacement() {
    density = 0.5;
    style = 0.5;
    previewController.resetPlacement();
  }

  function handleRegenerate() {
    previewController.regenerate();
    stats = previewController.getStats();
  }

  function handleMouseMove(event: MouseEvent) {
    previewController.updateMousePosition(event.clientX, event.clientY);
  }

  function handleMouseLeave() {
    previewController.resetMousePosition();
  }

  function handleResize() {
    previewController.handleResize();
  }

  // ============================================================================
  // TREE LAB HANDLERS
  // ============================================================================

  function setMode(newMode: LabMode) {
    mode = newMode;
    if (newMode === "treeLab" && labTreeType !== "spruce") {
      treeSamples = treeFeedbackPersister.generateSamples(treeFeedback, labTreeType, 20);
    }
  }

  function handleLabTreeTypeChange(type: TreeType) {
    labTreeType = type;
    if (type !== "spruce") {
      treeSamples = treeFeedbackPersister.generateSamples(treeFeedback, type, 20);
    }
  }

  function handleToggleTreeStatus(index: number) {
    const sample = treeSamples[index];
    if (!sample) return;
    treeFeedback = treeFeedbackPersister.cycleStatus(treeFeedback, labTreeType, sample.seed);
    treeFeedbackPersister.save(treeFeedback);
    treeSamples[index] = {
      ...sample,
      status: treeFeedbackPersister.getStatus(treeFeedback, labTreeType, sample.seed),
    };
    treeSamples = [...treeSamples];
  }

  function handleCopySVG(seed: number) {
    if (labTreeType === "spruce") {
      const svg = treeLabRenderer.generateSpruceSVG(seed);
      navigator.clipboard.writeText(svg);
      alert(`SVG copied for seed #${seed}`);
    } else if (labTreeType === "pine") {
      const svg = treeLabRenderer.generatePineSVG(seed, treeParams);
      navigator.clipboard.writeText(svg);
      alert(`SVG copied for seed #${seed}`);
    } else {
      alert("SVG export currently only works for Spruce and Pine trees");
    }
  }

  function handleGenerateNewSet() {
    treeSamples = treeFeedbackPersister.generateSamples(treeFeedback, labTreeType, 20);
  }

  // Spruce handlers
  function handleResetSpruceParams() {
    if (spruceAlgorithm === "smooth") {
      smoothParams = { spread: 0.55, taperPower: 0.58, waveFreq: 6, waveAmp: 5, jitter: 2 };
    } else {
      whorlParams = { spread: 0.52, taperExponent: 1.5, layers: 8, droop: 0.18, jaggedness: 1.0 };
    }
  }

  function handleRandomizeSpruceSeeds() {
    spruceSampleSeeds = [
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
    ];
  }

  // Pine handlers
  function handleResetPineParams() {
    if (pineAlgorithm === "tiered") {
      tieredParams = { tierCount: 7, tierSpacing: 1.0, spread: 0.55, uplift: 0.25, gapVisibility: 0.15 };
    } else {
      windsweptParams = { windAngle: 0.4, windStrength: 0.35, tierCount: 6, asymmetry: 0.45, branchCurve: 0.3 };
    }
  }

  function handleRandomizePineSeeds() {
    pineSampleSeeds = [
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
    ];
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(() => {
    initializePreview();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopStatsPolling();
    previewController.cleanup();
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="firefly-forest-lab">
  <div class="controls">
    <div class="header">
      <h2>Firefly Forest Lab</h2>
      <span class="badge">Classic</span>
    </div>

    <!-- Mode Toggle -->
    <div class="mode-toggle">
      <button class="mode-btn" class:active={mode === "preview"} onclick={() => setMode("preview")}>
        <i class="fas fa-eye"></i>
        Preview
      </button>
      <button class="mode-btn" class:active={mode === "treeLab"} onclick={() => setMode("treeLab")}>
        <i class="fas fa-flask"></i>
        Tree Lab
      </button>
    </div>

    {#if mode === "preview"}
      <PreviewControls
        {quality}
        {layers}
        {treeTypes}
        {density}
        {style}
        {stats}
        onQualityChange={handleQualityChange}
        onLayerToggle={handleLayerToggle}
        onTreeTypeToggle={handleTreeTypeToggle}
        onDensityChange={handleDensityChange}
        onStyleChange={handleStyleChange}
        onResetPlacement={handleResetPlacement}
        onRegenerate={handleRegenerate}
      />
    {:else}
      <TreeLabControls
        treeTypes={TREE_TYPES}
        selectedType={labTreeType}
        feedbackStats={treeFeedbackPersister.getStats(treeFeedback, labTreeType)}
        onTypeChange={handleLabTreeTypeChange}
        onGenerateNewSet={handleGenerateNewSet}
      />

      {#if labTreeType === "spruce"}
        <SpruceParameterControls
          algorithm={spruceAlgorithm}
          {smoothParams}
          {whorlParams}
          onAlgorithmChange={(a) => spruceAlgorithm = a}
          onSmoothParamsChange={(p) => smoothParams = p}
          onWhorlParamsChange={(p) => whorlParams = p}
          onReset={handleResetSpruceParams}
          onRandomizeSeeds={handleRandomizeSpruceSeeds}
        />
      {:else if labTreeType === "pine"}
        <PineParameterControls
          algorithm={pineAlgorithm}
          {tieredParams}
          {windsweptParams}
          onAlgorithmChange={(a) => pineAlgorithm = a}
          onTieredParamsChange={(p) => tieredParams = p}
          onWindsweptParamsChange={(p) => windsweptParams = p}
          onReset={handleResetPineParams}
          onRandomizeSeeds={handleRandomizePineSeeds}
        />
      {/if}
    {/if}
  </div>

  <!-- Content Area -->
  {#if mode === "preview"}
    <div class="preview" onmousemove={handleMouseMove} onmouseleave={handleMouseLeave}>
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else if labTreeType === "spruce"}
    <SpruceTuningGrid
      seeds={spruceSampleSeeds}
      renderer={treeLabRenderer}
      params={treeParams}
    />
  {:else if labTreeType === "pine"}
    <PineTuningGrid
      seeds={pineSampleSeeds}
      renderer={treeLabRenderer}
      params={treeParams}
    />
  {:else}
    <TreeLabGrid
      treeType={labTreeType}
      samples={treeSamples}
      renderer={treeLabRenderer}
      params={treeParams}
      onToggleStatus={handleToggleTreeStatus}
      onCopySVG={handleCopySVG}
    />
  {/if}
</div>

<style>
  .firefly-forest-lab {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background: rgba(15, 15, 25, 0.8);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-accent) var(--scrollbar-track);
  }

  .controls::-webkit-scrollbar { width: 8px; }
  .controls::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); border-radius: 4px; }
  .controls::-webkit-scrollbar-thumb { background: var(--scrollbar-accent, rgba(255, 255, 255, 0.2)); border-radius: 4px; }
  .controls::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-accent-hover, rgba(255, 255, 255, 0.35)); }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #ffffff;
  }

  .badge {
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.3), rgba(163, 230, 53, 0.3));
    border: 1px solid rgba(163, 230, 53, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a3e635;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-toggle {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #6b7280;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    color: #9ca3af;
    background: rgba(255, 255, 255, 0.03);
  }

  .mode-btn.active {
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.2), rgba(163, 230, 53, 0.2));
    color: #a3e635;
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(to bottom, #0a1628 0%, #162033 50%, #1a2a3d 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 900px) {
    .firefly-forest-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
