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
  import type { NightSkyDensityPreset, NightSkyLabMode } from "../domain/lab-settings-types";
  import type { UFOMood, WobbleType, UFOEntranceType, UFOExitType } from "$lib/shared/background/night-sky/services/UFOSystem";

  // Load persisted settings first
  const savedSettings = getNightSkySettings();

  // Mode toggle for default vs UFO Lab - persisted
  let mode: NightSkyLabMode = $state(savedSettings.mode ?? "default");

  function setMode(newMode: NightSkyLabMode) {
    mode = newMode;
    updateNightSkySettings({ mode: newMode });
  }

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: NightSkyBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

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

  /** Spawn UFO with random entrance - main spawn button */
  function spawnUFO() {
    const entrances: EntranceType[] = ["fade", "warp", "zoom", "descend"];
    const randomEntrance = entrances[Math.floor(Math.random() * entrances.length)]!;
    triggerUFOWithEntrance(randomEntrance);
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

  // UFO status - polled every frame for live updates
  let ufoActive = $state(false);
  let ufoMood = $state<string | null>(null);
  let ufoTiredness = $state<number | null>(null);
  let ufoState = $state<string | null>(null);
  let ufoPosition = $state<{ x: number; y: number } | null>(null);
  let ufoHeading = $state<number | null>(null);
  let ufoScannedStars = $state(0);
  let statusPollInterval: number | null = null;

  // Poll UFO status when in UFO Lab mode
  $effect(() => {
    if (mode === "ufoLab" && backgroundSystem) {
      // Start polling
      statusPollInterval = window.setInterval(() => {
        if (backgroundSystem) {
          ufoActive = backgroundSystem.isUFOActive() ?? false;
          ufoMood = backgroundSystem.getUFOMood() ?? null;
          ufoTiredness = backgroundSystem.getUFOTiredness() ?? null;
          ufoState = backgroundSystem.getUFOState() ?? null;
          ufoPosition = backgroundSystem.getUFOPosition() ?? null;
          ufoHeading = backgroundSystem.getUFOHeading() ?? null;
          ufoScannedStars = backgroundSystem.getUFOScannedStarsCount() ?? 0;
        }
      }, 100); // Poll 10x per second

      return () => {
        if (statusPollInterval !== null) {
          clearInterval(statusPollInterval);
          statusPollInterval = null;
        }
      };
    }
  });

  // UFO Lab mode functions
  const moodOptions: UFOMood[] = ["curious", "excited", "bored", "startled", "playful", "tired"];
  const wobbleOptions: { type: WobbleType; label: string; icon: string }[] = [
    { type: "curious_tilt", label: "Curious", icon: "fa-search" },
    { type: "startled_jolt", label: "Startle", icon: "fa-bolt" },
    { type: "disappointed_shake", label: "Disappoint", icon: "fa-frown" },
    { type: "happy_bounce", label: "Happy", icon: "fa-smile" },
    { type: "yawn_stretch", label: "Yawn", icon: "fa-bed" },
  ];

  function setUFOMood(mood: UFOMood) {
    backgroundSystem?.setUFOMood(mood);
  }

  function resetTiredness() {
    backgroundSystem?.resetUFOTiredness();
  }

  function clearScannedStars() {
    backgroundSystem?.clearUFOScannedStars();
  }

  function triggerWobble(type: WobbleType) {
    backgroundSystem?.triggerUFOWobble(type);
  }

  function formatHeading(radians: number | null): string {
    if (radians === null) return "—";
    const degrees = ((radians * 180) / Math.PI + 360) % 360;
    return `${Math.round(degrees)}°`;
  }

  function formatPosition(pos: { x: number; y: number } | null): string {
    if (!pos) return "—";
    return `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
  }

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    if (statusPollInterval !== null) {
      clearInterval(statusPollInterval);
    }
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
    </ChipGroup>

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
    {:else if mode === "ufoLab"}
    <!-- UFO Lab Mode -->
    <div class="ufo-lab">
      <!-- Big Spawn Button -->
      <button class="spawn-ufo-btn" onclick={spawnUFO}>
        <i class="fas fa-satellite"></i>
        <span>Spawn UFO</span>
      </button>

      <!-- Status Dashboard -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-tachometer-alt"></i> Status</div>
        <div class="status-grid">
          <div class="status-row">
            <span class="status-label">State</span>
            <span class="state-badge {ufoState ?? 'inactive'}">{ufoState ?? 'inactive'}</span>
          </div>
          <div class="status-row">
            <span class="status-label">Mood</span>
            <span class="mood-badge {ufoMood ?? 'inactive'}">{ufoMood ?? 'inactive'}</span>
          </div>
          <div class="status-row">
            <span class="status-label">Energy</span>
            <div class="energy-bar-container">
              <div class="energy-bar" style="width: {(1 - (ufoTiredness ?? 0)) * 100}%"></div>
              <span class="energy-label">{Math.round((1 - (ufoTiredness ?? 0)) * 100)}%</span>
            </div>
          </div>
          <div class="status-row">
            <span class="status-label">Memory</span>
            <span class="status-value">{ufoScannedStars}/10 stars</span>
          </div>
        </div>
      </div>

      <!-- Mood Controls -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-heart"></i> Mood</div>
        <div class="mood-buttons">
          {#each moodOptions as mood}
            <button class="mood-btn {mood}" class:active={ufoMood === mood} onclick={() => setUFOMood(mood)}>{mood}</button>
          {/each}
        </div>
        <button class="reset-btn" onclick={resetTiredness}>
          <i class="fas fa-battery-full"></i> Reset Energy
        </button>
      </div>

      <!-- Wobble Animations -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-wave-square"></i> Wobble</div>
        <div class="wobble-grid">
          {#each wobbleOptions as { type, label, icon }}
            <button class="wobble-btn" onclick={() => triggerWobble(type)}>
              <i class="fas {icon}"></i>
              <span>{label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Behavior Commands -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-gamepad"></i> Commands</div>
        <div class="command-grid">
          <button class="lab-cmd-btn" onclick={commandUFOWander}><i class="fas fa-random"></i> Wander</button>
          <button class="lab-cmd-btn" onclick={commandUFODrift}><i class="fas fa-cloud"></i> Drift</button>
          <button class="lab-cmd-btn" onclick={commandUFOPause}><i class="fas fa-pause"></i> Pause</button>
          <button class="lab-cmd-btn" onclick={commandUFOScanStar}><i class="fas fa-star"></i> Scan Star</button>
          <button class="lab-cmd-btn" onclick={commandUFOScanGround}><i class="fas fa-crosshairs"></i> Scan Ground</button>
          <button class="lab-cmd-btn" onclick={clearScannedStars}><i class="fas fa-eraser"></i> Clear Memory</button>
        </div>
      </div>

      <!-- Entrance/Exit Testing -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-door-open"></i> Entrance / Exit</div>
        <div class="entrance-exit-combined">
          <div class="ee-row">
            <span class="ee-label">Enter:</span>
            {#each Object.entries(entranceLabels) as [type, { icon, label }]}
              <button class="entrance-btn" onclick={() => triggerUFOWithEntrance(type as EntranceType)}>
                <i class="fas {icon}"></i> {label}
              </button>
            {/each}
          </div>
          <div class="ee-row">
            <span class="ee-label">Exit:</span>
            {#each Object.entries(exitLabels) as [type, { icon, label }]}
              <button class="exit-btn" onclick={() => commandUFOExitWith(type as ExitType)}>
                <i class="fas {icon}"></i> {label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Event Simulation -->
      <div class="ufo-lab-section">
        <div class="section-header"><i class="fas fa-magic"></i> Events</div>
        <div class="event-buttons">
          <button class="event-btn meteor" onclick={triggerMeteor}>
            <i class="fas fa-meteor"></i> Trigger Meteor
          </button>
          <button class="event-btn comet" onclick={triggerComet}>
            <i class="fas fa-fire"></i> Trigger Comet
          </button>
        </div>
      </div>

      <!-- Click Interaction Guide -->
      <details class="click-hints">
        <summary><i class="fas fa-mouse-pointer"></i> Click Interactions</summary>
        <div class="hints-content">
          <div class="hint-item"><span class="hint-zone direct">Direct</span> Click on UFO → play or flee</div>
          <div class="hint-item"><span class="hint-zone near">Near</span> Click nearby → UFO glances</div>
          <div class="hint-item"><span class="hint-zone far">Far</span> Click distant → UFO investigates</div>
        </div>
      </details>
    </div>
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

  /* Entrance buttons - cyan/teal theme */
  .entrance-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.2);
    border-radius: 6px;
    color: #67e8f9;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
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
    font-size: 0.7rem;
  }

  /* Exit buttons - red/orange theme */
  .exit-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.2);
    border-radius: 6px;
    color: #fdba74;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
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

  /* Mood badge styles (used in UFO Lab status display) */
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

  @media (max-width: 800px) {
    .night-sky-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }

  /* Mode Toggle */
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

  /* UFO Lab Container */
  .ufo-lab {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Big Spawn Button */
  .spawn-ufo-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: #ffffff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
  }

  .spawn-ufo-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .spawn-ufo-btn:active {
    transform: translateY(0);
  }

  .spawn-ufo-btn i {
    font-size: 1.1rem;
  }

  .ufo-lab-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08));
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header i {
    font-size: 0.65rem;
    opacity: 0.8;
  }

  /* Status Dashboard */
  .status-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .status-label {
    color: rgba(255, 255, 255, 0.5);
  }

  .status-value {
    color: #e5e7eb;
    font-weight: 500;
  }

  .status-value.mono {
    font-family: monospace;
    font-size: 0.7rem;
  }

  .state-badge {
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .state-badge.inactive {
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  .state-badge.wandering {
    background: rgba(96, 165, 250, 0.2);
    color: #93c5fd;
  }

  .state-badge.paused {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .state-badge.scanning_star,
  .state-badge.scanning_ground {
    background: rgba(52, 211, 153, 0.2);
    color: #6ee7b7;
  }

  .state-badge.tracking_event,
  .state-badge.chasing {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .state-badge.giving_up {
    background: rgba(107, 114, 128, 0.3);
    color: #9ca3af;
  }

  .state-badge.entering,
  .state-badge.exiting {
    background: rgba(168, 85, 247, 0.2);
    color: #c4b5fd;
  }

  .state-badge.collecting_sample,
  .state-badge.photographing {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .state-badge.investigating_ground {
    background: rgba(180, 160, 140, 0.2);
    color: #d4c4a8;
  }

  .state-badge.panicking {
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .state-badge.surfing,
  .state-badge.following {
    background: rgba(34, 211, 238, 0.2);
    color: #67e8f9;
  }

  .state-badge.communicating {
    background: rgba(147, 197, 253, 0.2);
    color: #93c5fd;
  }

  .state-badge.napping {
    background: rgba(75, 85, 99, 0.3);
    color: #9ca3af;
  }

  .state-badge.hiding,
  .state-badge.peeking {
    background: rgba(168, 85, 247, 0.15);
    color: #c4b5fd;
  }

  .state-badge.celebrating {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(251, 191, 36, 0.2), rgba(34, 197, 94, 0.2), rgba(59, 130, 246, 0.2));
    color: #fcd34d;
  }

  .energy-bar-container {
    flex: 1;
    max-width: 100px;
    height: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    overflow: hidden;
    position: relative;
  }

  .energy-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 5px;
    transition: width 0.3s ease;
  }

  .energy-label {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.6rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  }

  /* Mood Buttons */
  .mood-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .mood-buttons.compact {
    gap: 4px;
  }

  .mood-btn {
    padding: 5px 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 5px;
    font-size: 0.65rem;
    font-weight: 500;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mood-btn.curious {
    background: rgba(96, 165, 250, 0.15);
    color: #93c5fd;
  }

  .mood-btn.excited {
    background: rgba(251, 191, 36, 0.15);
    color: #fcd34d;
  }

  .mood-btn.bored {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
  }

  .mood-btn.startled {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  .mood-btn.playful {
    background: rgba(168, 85, 247, 0.15);
    color: #c4b5fd;
  }

  .mood-btn.tired {
    background: rgba(75, 85, 99, 0.25);
    color: #9ca3af;
  }

  .mood-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .mood-btn.active {
    border-color: currentColor;
    box-shadow: 0 0 8px currentColor;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    padding: 8px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 6px;
    color: #6ee7b7;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    background: rgba(16, 185, 129, 0.25);
    transform: translateY(-1px);
  }

  /* Wobble Grid */
  .wobble-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .wobble-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #d1d5db;
    font-size: 0.6rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 0;
  }

  .wobble-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .wobble-btn:active {
    transform: translateY(0) scale(0.97);
  }

  .wobble-btn i {
    font-size: 0.85rem;
  }

  /* Command Grid */
  .command-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .lab-cmd-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #d1d5db;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lab-cmd-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .lab-cmd-btn:active {
    transform: translateY(0) scale(0.97);
  }

  .lab-cmd-btn i {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  /* Entrance/Exit Combined */
  .entrance-exit-combined {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ee-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .ee-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    width: 40px;
    flex-shrink: 0;
  }

  /* Event Buttons */
  .event-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .event-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border: 1px solid;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .event-btn.meteor {
    background: rgba(251, 146, 60, 0.15);
    border-color: rgba(251, 146, 60, 0.3);
    color: #fdba74;
  }

  .event-btn.meteor:hover {
    background: rgba(251, 146, 60, 0.25);
  }

  .event-btn.comet {
    background: rgba(34, 211, 238, 0.15);
    border-color: rgba(34, 211, 238, 0.3);
    color: #67e8f9;
  }

  .event-btn.comet:hover {
    background: rgba(34, 211, 238, 0.25);
  }

  .event-hint {
    margin: 4px 0 0 0;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    font-style: italic;
  }

  /* Interaction Guide */
  .interaction-guide {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .guide-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .guide-zone {
    flex-shrink: 0;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .guide-zone.direct {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .guide-zone.near {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .guide-zone.far {
    background: rgba(96, 165, 250, 0.2);
    color: #93c5fd;
  }

  .guide-desc {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }

  /* Wobble Row (compact) */
  .wobble-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .wobble-btn-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    color: #d1d5db;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .wobble-btn-mini:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
  }

  .wobble-btn-mini.reset {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .wobble-btn-mini.reset:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  /* Command Row (compact) */
  .command-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .cmd-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 32px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #d1d5db;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cmd-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
  }

  /* Entrance/Exit Row */
  .entrance-exit-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ee-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ee-label {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.5);
    width: 36px;
    flex-shrink: 0;
  }

  .ee-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border-radius: 5px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ee-btn.entrance {
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.2);
    color: #67e8f9;
  }

  .ee-btn.entrance:hover {
    background: rgba(34, 211, 238, 0.25);
    border-color: rgba(34, 211, 238, 0.5);
  }

  .ee-btn.exit {
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.2);
    color: #fdba74;
  }

  .ee-btn.exit:hover {
    background: rgba(251, 146, 60, 0.25);
    border-color: rgba(251, 146, 60, 0.5);
  }

  /* Event Row */
  .event-row {
    display: flex;
    gap: 6px;
  }

  .event-row .event-btn {
    flex: 1;
    padding: 8px;
    font-size: 0.7rem;
  }

  /* Click Hints (collapsible) */
  .click-hints {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .click-hints summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    cursor: pointer;
    list-style: none;
  }

  .click-hints summary::-webkit-details-marker {
    display: none;
  }

  .click-hints summary::after {
    content: "▸";
    margin-left: auto;
    transition: transform 0.2s;
  }

  .click-hints[open] summary::after {
    transform: rotate(90deg);
  }

  .hints-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    font-size: 0.7rem;
  }

  .hint-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hint-zone {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .hint-zone.direct {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .hint-zone.near {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .hint-zone.far {
    background: rgba(96, 165, 250, 0.2);
    color: #93c5fd;
  }
</style>
