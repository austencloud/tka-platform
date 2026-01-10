<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { NightSkyBackgroundSystem } from "$lib/shared/background/night-sky/services/NightSkyBackgroundSystem";
  import { nightSkyBackgroundModule } from "$lib/shared/background/night-sky/inversify/NightSkyModule";
  import { getContainerInstance } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";
  import {
    getNightSkySettings,
    updateNightSkySettings,
  } from "../state/background-builder-state.svelte";
  import type { NightSkyDensityPreset } from "../domain/lab-settings-types";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: NightSkyBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Load persisted settings
  const savedSettings = getNightSkySettings();

  // Quality settings
  let quality: QualityLevel = $state(savedSettings.quality);

  // Layer toggles (moon removed - Firefly Forest has the hero moon)
  let layers = $state({ ...savedSettings.layers });

  // Star density presets
  let densityPreset: NightSkyDensityPreset = $state(savedSettings.densityPreset);

  const densityMultipliers: Record<NightSkyDensityPreset, number> = {
    sparse: 0.5,
    normal: 1.0,
    dense: 1.8,
    ultra: 3.0,
  };

  async function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Ensure DI module is loaded before creating the system
    const diContainer = await getContainerInstance();
    if (!diContainer.isBound(TYPES.INightSkyCalculationService)) {
      await diContainer.load(nightSkyBackgroundModule);
    }

    backgroundSystem = NightSkyBackgroundSystem.create();
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);

    // Apply user's saved layer settings
    if (backgroundSystem.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }

    startAnimation();
  }

  function startAnimation() {
    if (!canvas || !backgroundSystem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      // Guard against destroyed component
      if (!canvas || !backgroundSystem) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      backgroundSystem.draw(ctx, dimensions);
      animationFrame = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function handleResize() {
    if (!canvas || !backgroundSystem) return;

    const container = canvas.parentElement;
    if (container) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.handleResize?.(oldDimensions, newDimensions);
    }
  }

  function regenerate() {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    backgroundSystem = null;
    initializeSystem();
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    updateNightSkySettings({ quality: q });
    regenerate();
  }

  function setDensity(preset: NightSkyDensityPreset) {
    densityPreset = preset;
    updateNightSkySettings({ densityPreset: preset });
    regenerate();
  }

  function toggleLayer(layer: keyof typeof layers) {
    // Reassign entire object to ensure Svelte 5 reactivity triggers
    layers = { ...layers, [layer]: !layers[layer] };
    updateNightSkySettings({ layers });
    if (backgroundSystem) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function triggerMeteor() {
    if (backgroundSystem) {
      backgroundSystem.triggerMeteor();
    }
  }

  function triggerComet() {
    if (backgroundSystem) {
      backgroundSystem.triggerComet();
    }
  }

  function triggerUFO() {
    if (backgroundSystem) {
      // Auto-enable UFO layer when triggering
      if (!layers.ufo) {
        layers = { ...layers, ufo: true };
        updateNightSkySettings({ layers });
      }
      backgroundSystem.triggerUFO();
    }
  }

  // UFO Command functions
  function commandUFOScanStar() {
    if (backgroundSystem?.isUFOActive()) {
      const found = backgroundSystem.commandUFOScanStar();
      if (!found) {
        // No star nearby - could show a toast, but for now just scan ground instead
        backgroundSystem.commandUFOScanGround();
      }
    }
  }

  function commandUFOScanGround() {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFOScanGround();
    }
  }

  function commandUFOPause() {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFOPause();
    }
  }

  function commandUFOWander() {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFOWander();
    }
  }

  function commandUFODrift() {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFODrift();
    }
  }

  function commandUFOExit() {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFOExit();
    }
  }

  // Entrance types for UFO (removed decloak - too flashy)
  type EntranceType = "fade" | "warp" | "zoom" | "descend";
  type ExitType = "fade" | "warp" | "zoom" | "shootUp";

  const entranceLabels: Record<EntranceType, { icon: string; label: string }> = {
    fade: { icon: "fa-ghost", label: "Fade" },
    warp: { icon: "fa-bolt", label: "Warp" },
    zoom: { icon: "fa-compress-arrows-alt", label: "Zoom" },
    descend: { icon: "fa-arrow-down", label: "Descend" },
  };

  const exitLabels: Record<ExitType, { icon: string; label: string }> = {
    fade: { icon: "fa-ghost", label: "Fade" },
    warp: { icon: "fa-bolt", label: "Warp" },
    zoom: { icon: "fa-expand-arrows-alt", label: "Zoom" },
    shootUp: { icon: "fa-rocket", label: "Shoot Up" },
  };

  function triggerUFOWithEntrance(entranceType: EntranceType) {
    if (backgroundSystem) {
      // Auto-enable UFO layer when triggering
      if (!layers.ufo) {
        layers = { ...layers, ufo: true };
        updateNightSkySettings({ layers });
      }
      backgroundSystem.triggerUFOWithEntrance(entranceType);
    }
  }

  function commandUFOExitWith(exitType: ExitType) {
    if (backgroundSystem?.isUFOActive()) {
      backgroundSystem.commandUFOExitWith(exitType);
    }
  }

  /**
   * Handle canvas click - forward to UFO system for interaction
   */
  function handleCanvasClick(event: MouseEvent) {
    if (!backgroundSystem || !canvas) return;

    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Forward to background system
    backgroundSystem.handleCanvasClick(clickX, clickY);
  }

  // Reactive check for UFO active state
  let ufoActive = $derived(backgroundSystem?.isUFOActive() ?? false);
  let ufoMood = $derived(backgroundSystem?.getUFOMood() ?? null);
  let ufoTiredness = $derived(backgroundSystem?.getUFOTiredness() ?? null);

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="night-sky-lab">
  <div class="controls">
    <div class="header">
      <h2>Night Sky Lab</h2>
      <span class="badge">2036 Vision</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup label="Layers">
      <ChipToggle label="Stars" icon="fa-star" active={layers.stars} onclick={() => toggleLayer("stars")} />
      <ChipToggle label="Nebula" icon="fa-cloud" active={layers.nebula} onclick={() => toggleLayer("nebula")} />
      <ChipToggle label="Aurora" icon="fa-wind" active={layers.aurora} onclick={() => toggleLayer("aurora")} />
      <ChipToggle label="Milky Way" icon="fa-star-half-stroke" active={layers.milkyWay} onclick={() => toggleLayer("milkyWay")} />
      <ChipToggle label="Meteors" icon="fa-meteor" active={layers.meteors} onclick={() => toggleLayer("meteors")} />
      <ChipToggle label="Comets" icon="fa-fire" active={layers.comets} onclick={() => toggleLayer("comets")} />
      <ChipToggle label="UFO" icon="fa-satellite" active={layers.ufo} onclick={() => toggleLayer("ufo")} />
    </ChipGroup>

    <!-- Trigger Buttons -->
    <ChipGroup label="Trigger Events">
      <button class="trigger-btn" onclick={triggerMeteor}>
        <i class="fas fa-meteor"></i>
        Meteor
      </button>
      <button class="trigger-btn" onclick={triggerComet}>
        <i class="fas fa-fire"></i>
        Comet
      </button>
      <button class="trigger-btn" onclick={triggerUFO}>
        <i class="fas fa-satellite"></i>
        UFO
      </button>
    </ChipGroup>

    <!-- UFO Command Panel - shows when UFO layer is enabled -->
    {#if layers.ufo}
      <div class="ufo-commands">
        <div class="ufo-commands-header">
          <i class="fas fa-satellite"></i>
          <span>UFO Controls</span>
        </div>

        <!-- Entrance Types -->
        <div class="ufo-section">
          <span class="ufo-section-label">Entrances</span>
          <div class="ufo-entrance-grid">
            {#each Object.entries(entranceLabels) as [type, { icon, label }]}
              <button
                class="entrance-btn"
                onclick={() => triggerUFOWithEntrance(type as EntranceType)}
                title="Spawn UFO with {label} entrance"
              >
                <i class="fas {icon}"></i>
                <span>{label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Behavior Commands -->
        <div class="ufo-section">
          <span class="ufo-section-label">Behavior</span>
          <div class="ufo-commands-grid">
            <button class="cmd-btn" onclick={commandUFOScanStar} title="Scan nearest star">
              <i class="fas fa-star"></i>
              <span>Scan Star</span>
            </button>
            <button class="cmd-btn" onclick={commandUFOScanGround} title="Scan the ground below">
              <i class="fas fa-crosshairs"></i>
              <span>Scan Ground</span>
            </button>
            <button class="cmd-btn" onclick={commandUFOPause} title="Pause and chill">
              <i class="fas fa-pause"></i>
              <span>Pause</span>
            </button>
            <button class="cmd-btn" onclick={commandUFOWander} title="Wander around">
              <i class="fas fa-random"></i>
              <span>Wander</span>
            </button>
            <button class="cmd-btn" onclick={commandUFODrift} title="Drift lazily">
              <i class="fas fa-cloud"></i>
              <span>Drift</span>
            </button>
          </div>
        </div>

        <!-- Exit Types -->
        <div class="ufo-section">
          <span class="ufo-section-label">Exits</span>
          <div class="ufo-exit-grid">
            {#each Object.entries(exitLabels) as [type, { icon, label }]}
              <button
                class="exit-btn"
                onclick={() => commandUFOExitWith(type as ExitType)}
                title="Exit with {label}"
              >
                <i class="fas {icon}"></i>
                <span>{label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Mood & Status -->
        <div class="ufo-section">
          <span class="ufo-section-label">Status</span>
          <div class="ufo-status">
            <div class="status-item">
              <span class="status-label">Mood:</span>
              <span class="mood-badge {ufoMood ?? 'inactive'}">{ufoMood ?? 'inactive'}</span>
            </div>
            {#if ufoTiredness !== null}
              <div class="status-item">
                <span class="status-label">Energy:</span>
                <div class="tiredness-bar">
                  <div class="tiredness-fill" style="width: {(1 - ufoTiredness) * 100}%"></div>
                </div>
              </div>
            {/if}
            <div class="status-hint">
              <i class="fas fa-mouse-pointer"></i>
              <span>Click canvas to interact!</span>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Density Chips -->
    <ChipGroup label="Star Density" variant="row">
      <ChipToggle label="Sparse" active={densityPreset === "sparse"} onclick={() => setDensity("sparse")} />
      <ChipToggle label="Normal" active={densityPreset === "normal"} onclick={() => setDensity("normal")} />
      <ChipToggle label="Dense" active={densityPreset === "dense"} onclick={() => setDensity("dense")} />
      <ChipToggle label="Ultra" active={densityPreset === "ultra"} onclick={() => setDensity("ultra")} />
    </ChipGroup>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-sparkles"></i>
      Regenerate
    </button>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Progress</span>
      <div class="progress-pills">
        <span class="pill complete">Clean Canvas</span>
        <span class="pill complete">Lab Ready</span>
        <span class="pill complete">Scintillation</span>
        <span class="pill complete">Nebula</span>
        <span class="pill complete">Aurora</span>
        <span class="pill complete">Milky Way</span>
        <span class="pill complete">Meteors</span>
        <span class="pill complete">Comets</span>
        <span class="pill complete">UFO</span>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas} onclick={handleCanvasClick}></canvas>
  </div>
</div>

<style>
  .night-sky-lab {
    display: grid;
    grid-template-columns: 300px 1fr;
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

    /* Styled scrollbar */
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

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .trigger-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .trigger-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .trigger-btn:active {
    transform: scale(0.97);
    background: rgba(99, 102, 241, 0.3);
  }

  .trigger-btn i {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .progress-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .pill.complete {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .pill.active {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    animation: pulse 2s infinite;
  }

  .pill.pending {
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
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

  /* UFO Command Panel */
  .ufo-commands {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 12px;
  }

  .ufo-commands-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #a78bfa;
  }

  .ufo-commands-header i {
    font-size: 0.75rem;
  }

  .ufo-commands-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .cmd-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #d1d5db;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cmd-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .cmd-btn:active {
    transform: translateY(0) scale(0.97);
    background: rgba(139, 92, 246, 0.3);
  }

  .cmd-btn i {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .cmd-btn span {
    font-weight: 500;
  }

  .cmd-btn-exit {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .cmd-btn-exit:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fecaca;
  }

  /* UFO Sections */
  .ufo-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ufo-section-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: rgba(167, 139, 250, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Entrance buttons - cyan/teal theme */
  .ufo-entrance-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .entrance-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 4px;
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.2);
    border-radius: 6px;
    color: #67e8f9;
    font-size: 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .entrance-btn:hover {
    background: rgba(34, 211, 238, 0.25);
    border-color: rgba(34, 211, 238, 0.5);
    color: #a5f3fc;
    transform: translateY(-1px);
  }

  .entrance-btn:active {
    transform: translateY(0) scale(0.97);
  }

  .entrance-btn i {
    font-size: 0.85rem;
  }

  .entrance-btn span {
    font-weight: 500;
  }

  /* Exit buttons - red/orange theme */
  .ufo-exit-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .exit-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 4px;
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.2);
    border-radius: 6px;
    color: #fdba74;
    font-size: 0.65rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .exit-btn:hover {
    background: rgba(251, 146, 60, 0.25);
    border-color: rgba(251, 146, 60, 0.5);
    color: #fed7aa;
    transform: translateY(-1px);
  }

  .exit-btn:active {
    transform: translateY(0) scale(0.97);
  }

  .exit-btn i {
    font-size: 0.85rem;
  }

  .exit-btn span {
    font-weight: 500;
  }

  /* UFO Status Display */
  .ufo-status {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
  }

  .status-label {
    color: rgba(255, 255, 255, 0.6);
    min-width: 50px;
  }

  .mood-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .mood-badge.curious {
    background: rgba(96, 165, 250, 0.2);
    color: #93c5fd;
  }

  .mood-badge.excited {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .mood-badge.bored {
    background: rgba(107, 114, 128, 0.3);
    color: #9ca3af;
  }

  .mood-badge.startled {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .mood-badge.playful {
    background: rgba(168, 85, 247, 0.2);
    color: #c4b5fd;
  }

  .mood-badge.tired {
    background: rgba(75, 85, 99, 0.3);
    color: #9ca3af;
  }

  .mood-badge.inactive {
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  .tiredness-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .tiredness-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .status-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.65rem;
    color: rgba(139, 92, 246, 0.7);
    margin-top: 4px;
  }

  .status-hint i {
    font-size: 0.6rem;
  }

  @media (max-width: 800px) {
    .night-sky-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
