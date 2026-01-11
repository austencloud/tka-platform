<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import type { NightSkyDensityPreset, NightSkyLabMode } from "../domain/lab-settings-types";
  import type { UFOMood, WobbleType } from "$lib/shared/background/night-sky/services/UFOSystem";
  import type { UFOStatusSnapshot } from "../services/contracts/IUFOStatusPoller";
  import { container } from "$lib/shared/di";
  import type { INightSkyLabController } from "../services/contracts/INightSkyLabController";
  import type { IUFOStatusPoller } from "../services/contracts/IUFOStatusPoller";
  import {
    getNightSkySettings,
    updateNightSkySettings,
  } from "../state/background-builder-state.svelte";
  import NightSkyDefaultControls from "./NightSkyDefaultControls.svelte";
  import UFOLabControls from "./UFOLabControls.svelte";

  // Services from container
  const controller: INightSkyLabController = container.items.nightSkyLabController;
  const statusPoller: IUFOStatusPoller = container.items.ufoStatusPoller;

  // Load persisted settings
  const savedSettings = getNightSkySettings();

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);

  // Mode and settings state
  let mode: NightSkyLabMode = $state(savedSettings.mode ?? "default");
  let quality: QualityLevel = $state(savedSettings.quality);
  let layers = $state({ ...savedSettings.layers });
  let densityPreset: NightSkyDensityPreset = $state(savedSettings.densityPreset);

  // UFO status (polled from system)
  let ufoStatus = $state<UFOStatusSnapshot>({
    active: false,
    mood: null,
    tiredness: null,
    state: null,
    position: null,
    heading: null,
    scannedStars: 0,
  });

  // Entrance/exit types
  type EntranceType = "fade" | "warp" | "zoom" | "descend";
  type ExitType = "fade" | "warp" | "zoom" | "shootUp";

  // --- Mode Management ---
  function setMode(newMode: NightSkyLabMode) {
    mode = newMode;
    updateNightSkySettings({ mode: newMode });

    // Start/stop UFO status polling based on mode
    if (newMode === "ufoLab" && controller.isInitialized()) {
      const system = controller.getSystem();
      if (system) {
        statusPoller.start(system, (snapshot) => {
          ufoStatus = snapshot;
        });
      }
    } else {
      statusPoller.stop();
    }
  }

  // --- Settings Handlers ---
  function handleQualityChange(q: QualityLevel) {
    quality = q;
    updateNightSkySettings({ quality: q });
    controller.regenerate(quality, layers);
  }

  function handleDensityChange(preset: NightSkyDensityPreset) {
    densityPreset = preset;
    updateNightSkySettings({ densityPreset: preset });
    controller.regenerate(quality, layers);
  }

  function handleLayerToggle(layer: keyof typeof layers) {
    layers = { ...layers, [layer]: !layers[layer] };
    updateNightSkySettings({ layers });
    controller.setLayerVisibility(layers);
  }

  function handleRegenerate() {
    controller.regenerate(quality, layers);
  }

  // --- Event Triggers ---
  function triggerMeteor() {
    controller.getSystem()?.triggerMeteor();
  }

  function triggerComet() {
    controller.getSystem()?.triggerComet();
  }

  // --- UFO Commands ---
  function spawnUFO() {
    const system = controller.getSystem();
    if (!system) return;

    // Auto-enable UFO layer
    if (!layers.ufo) {
      layers = { ...layers, ufo: true };
      updateNightSkySettings({ layers });
    }

    const entrances: EntranceType[] = ["fade", "warp", "zoom", "descend"];
    const randomEntrance = entrances[Math.floor(Math.random() * entrances.length)]!;
    system.triggerUFOWithEntrance(randomEntrance);
  }

  function handleEntranceType(type: EntranceType) {
    const system = controller.getSystem();
    if (!system) return;

    if (!layers.ufo) {
      layers = { ...layers, ufo: true };
      updateNightSkySettings({ layers });
    }
    system.triggerUFOWithEntrance(type);
  }

  function handleExitType(type: ExitType) {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      system.commandUFOExitWith(type);
    }
  }

  function handleSetMood(mood: UFOMood) {
    controller.getSystem()?.setUFOMood(mood);
  }

  function handleResetTiredness() {
    controller.getSystem()?.resetUFOTiredness();
  }

  function handleClearScannedStars() {
    controller.getSystem()?.clearUFOScannedStars();
  }

  function handleTriggerWobble(type: WobbleType) {
    controller.getSystem()?.triggerUFOWobble(type);
  }

  function handleWander() {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      system.commandUFOWander();
    }
  }

  function handleDrift() {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      system.commandUFODrift();
    }
  }

  function handlePause() {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      system.commandUFOPause();
    }
  }

  function handleScanStar() {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      const found = system.commandUFOScanStar();
      if (!found) {
        system.commandUFOScanGround();
      }
    }
  }

  function handleScanGround() {
    const system = controller.getSystem();
    if (system?.isUFOActive()) {
      system.commandUFOScanGround();
    }
  }

  // --- Canvas Interaction ---
  function handleCanvasClick(event: MouseEvent) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    controller.handleCanvasClick(clickX, clickY);
  }

  function handleResize() {
    controller.handleResize();
  }

  // --- Lifecycle ---
  onMount(() => {
    if (canvas) {
      controller.initialize(canvas, quality, layers);
      controller.start();

      // Start UFO polling if in UFO Lab mode
      if (mode === "ufoLab") {
        const system = controller.getSystem();
        if (system) {
          statusPoller.start(system, (snapshot) => {
            ufoStatus = snapshot;
          });
        }
      }
    }
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    statusPoller.stop();
    controller.cleanup();
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="night-sky-lab">
  <div class="controls">
    <div class="header">
      <h2>Night Sky Lab</h2>
      <span class="badge">2036 Vision</span>
    </div>

    <!-- Mode Toggle -->
    <div class="mode-toggle">
      <button class="mode-btn" class:active={mode === "default"} onclick={() => setMode("default")}>
        <i class="fas fa-moon"></i>
        Default
      </button>
      <button class="mode-btn ufo-mode" class:active={mode === "ufoLab"} onclick={() => setMode("ufoLab")}>
        <i class="fas fa-satellite"></i>
        UFO Lab
      </button>
    </div>

    {#if mode === "default"}
      <NightSkyDefaultControls
        {quality}
        {layers}
        {densityPreset}
        onQualityChange={handleQualityChange}
        onLayerToggle={handleLayerToggle}
        onDensityChange={handleDensityChange}
        onTriggerMeteor={triggerMeteor}
        onTriggerComet={triggerComet}
        onRegenerate={handleRegenerate}
      />
    {:else if mode === "ufoLab"}
      <UFOLabControls
        status={ufoStatus}
        onSpawn={spawnUFO}
        onSetMood={handleSetMood}
        onResetTiredness={handleResetTiredness}
        onClearScannedStars={handleClearScannedStars}
        onTriggerWobble={handleTriggerWobble}
        onWander={handleWander}
        onDrift={handleDrift}
        onPause={handlePause}
        onScanStar={handleScanStar}
        onScanGround={handleScanGround}
        onEntranceType={handleEntranceType}
        onExitType={handleExitType}
        onTriggerMeteor={triggerMeteor}
        onTriggerComet={triggerComet}
      />
    {/if}
  </div>

  <div class="preview">
    <canvas bind:this={canvas} onclick={handleCanvasClick}></canvas>
  </div>
</div>

<style>
  .night-sky-lab {
    display: grid;
    grid-template-columns: 360px 1fr;
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

  .controls::-webkit-scrollbar {
    width: 8px;
  }

  .controls::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .controls::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 4px;
  }

  .controls::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-accent-hover);
  }

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
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-toggle {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.05);
  }

  .mode-btn.active {
    color: #ffffff;
    background: rgba(99, 102, 241, 0.3);
  }

  .mode-btn.ufo-mode.active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
  }

  .mode-btn i {
    font-size: 0.85rem;
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #050510;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .night-sky-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
