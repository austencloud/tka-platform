<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { FishMarineLife } from "$lib/shared/background/deep-ocean/domain/models/DeepOceanModels";
  import type { FishMood } from "$lib/shared/background/deep-ocean/domain/types/fish-personality-types";
  import {
    DeepOceanBackgroundOrchestrator,
    type DeepOceanLayers,
  } from "$lib/shared/background/deep-ocean/services/DeepOceanBackgroundOrchestrator";
  import { fishDebugConfig } from "$lib/shared/background/deep-ocean/domain/debug-config";
  import CollapsibleLabSection from "$lib/shared/components/lab/CollapsibleLabSection.svelte";
  import LabStatusBar from "$lib/shared/components/lab/LabStatusBar.svelte";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  type ColorPreset = "default" | "cyan" | "blue" | "lime" | "amber" | "rose" | "emerald" | "red" | "gray";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Use the full orchestrator (same as Full Scene) but control layers
  let backgroundSystem: DeepOceanBackgroundOrchestrator | null = null;

  // Fish state for UI
  let fishList: FishMarineLife[] = $state([]);
  let selectedFishIndex = $state(0);

  // Layer toggles - start with only fish visible for behavior testing
  let layers = $state<DeepOceanLayers>({
    gradient: true,
    lightRays: false,
    caustics: false,
    particles: false,
    bubbles: false,
    fish: true,
    jellyfish: false,
  });

  // Display options
  let showOverlay = $state(true);
  let slowMotion = $state(false);

  // Track active trigger buttons for visual feedback
  let activeMoodTrigger = $state<FishMood | null>(null);
  let activeWobbleTrigger = $state<string | null>(null);

  // Derived state for selected fish
  let selectedFish = $derived(fishList[selectedFishIndex] ?? null);

  // Status bar chips derived from selected fish
  let statusChips = $derived(() => {
    if (!selectedFish) return [];
    return [
      { label: selectedFish.behavior, color: getBehaviorChipColor(selectedFish.behavior) },
      { label: selectedFish.mood ?? "calm", color: getMoodChipColor(selectedFish.mood ?? "calm") },
    ];
  });

  function getBehaviorChipColor(behavior: string): "cyan" | "orange" | "red" | "purple" | "gray" {
    switch (behavior) {
      case "cruising": return "cyan";
      case "turning": return "orange";
      case "darting": return "red";
      case "schooling": return "purple";
      default: return "gray";
    }
  }

  function getMoodChipColor(mood: string): "cyan" | "blue" | "green" | "orange" | "red" | "purple" | "gray" {
    switch (mood) {
      case "calm": return "cyan";
      case "curious": return "purple";
      case "alert": return "orange";
      case "playful": return "green";
      case "hungry": return "red";
      case "tired": return "gray";
      case "social": return "purple";
      default: return "gray";
    }
  }

  function getMoodColor(mood: FishMood): string {
    switch (mood) {
      case "calm": return "#22d3ee";
      case "curious": return "#a855f7";
      case "alert": return "#f59e0b";
      case "playful": return "#22c55e";
      case "hungry": return "#ef4444";
      case "tired": return "#6b7280";
      case "social": return "#ec4899";
      default: return "#ffffff";
    }
  }


  async function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerEl = canvas.parentElement;
    if (containerEl) {
      canvas.width = containerEl.clientWidth;
      canvas.height = containerEl.clientHeight;
    }

    try {
      backgroundSystem = container.items.deepOceanBackgroundSystem;
      const dimensions = { width: canvas.width, height: canvas.height };
      await backgroundSystem.initialize(dimensions, "high", { spawnFishOnScreen: true });
      backgroundSystem.setLayerVisibility(layers);
      updateFishList();
      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Fish Behavior Lab:", error);
    }
  }

  function updateFishList() {
    if (!backgroundSystem) return;
    fishList = backgroundSystem.getFish?.() ?? [];
  }

  function startAnimation() {
    if (!canvas || !backgroundSystem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      if (!canvas || !backgroundSystem) return;

      const deltaTime = currentTime - lastFrameTime;
      const clampedDelta = Math.min(deltaTime, 50);
      const frameMultiplier = (clampedDelta / 16.67) * (slowMotion ? 0.25 : 1);
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.update(dimensions, frameMultiplier);

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      backgroundSystem.draw(ctx, dimensions);

      if (Math.floor(currentTime / 160) !== Math.floor((currentTime - deltaTime) / 160)) {
        updateFishList();
      }

      const selected = fishList[selectedFishIndex];
      if (selected && showOverlay) {
        drawSelectionIndicator(ctx, selected);
        drawFishOverlay(ctx, selected);
      }

      animationFrame = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function drawSelectionIndicator(ctx: CanvasRenderingContext2D, f: FishMarineLife) {
    const headJoint = f.spineJoints?.[0];
    const x = headJoint?.x ?? f.x;
    const y = headJoint?.y ?? f.y;

    ctx.save();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, f.bodyLength * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFishOverlay(ctx: CanvasRenderingContext2D, f: FishMarineLife) {
    const headJoint = f.spineJoints?.[0];
    const x = headJoint?.x ?? f.x;
    const y = (headJoint?.y ?? f.y) - f.bodyLength - 20;

    ctx.save();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";

    ctx.fillStyle = getMoodColor(f.mood ?? "calm");
    ctx.fillText(`${f.behavior} · ${f.mood ?? "calm"}`, x, y);

    ctx.restore();
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function handleResize() {
    if (!canvas || !backgroundSystem) return;

    const containerEl = canvas.parentElement;
    if (containerEl) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = containerEl.clientWidth;
      canvas.height = containerEl.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.handleResize?.(oldDimensions, newDimensions);
    }
  }

  async function regenerate() {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    backgroundSystem = null;
    await initializeSystem();
  }

  function spawnFish() {
    if (!backgroundSystem || !canvas) return;
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.spawnFish?.(dimensions);
    updateFishList();
  }

  function toggleLayer(layer: keyof DeepOceanLayers) {
    layers[layer] = !layers[layer];
    if (backgroundSystem) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function selectNextFish() {
    if (fishList.length === 0) return;
    selectedFishIndex = (selectedFishIndex + 1) % fishList.length;
  }

  function selectPrevFish() {
    if (fishList.length === 0) return;
    selectedFishIndex = (selectedFishIndex - 1 + fishList.length) % fishList.length;
  }

  function triggerMood(mood: FishMood) {
    // IMPORTANT: Get fish directly from backgroundSystem, not from $state fishList
    // fishList contains Svelte proxies that get replaced every updateFishList() call
    const actualFish = backgroundSystem?.getFish?.();
    if (!actualFish || actualFish.length === 0) return;

    const f = actualFish[selectedFishIndex];
    if (!f) return;

    // Set mood and reset timer to 0 (just entered this mood)
    // Mark as manually set to prevent automatic overrides for 5 seconds
    f.mood = mood;
    f.moodTimer = 0;
    (f as any)._manualMoodSetAt = performance.now();

    // Visual feedback for button
    activeMoodTrigger = mood;
    setTimeout(() => {
      if (activeMoodTrigger === mood) activeMoodTrigger = null;
    }, 300);
  }

  function triggerWobble(wobbleType: FishMarineLife["wobbleType"]) {
    // IMPORTANT: Get fish directly from backgroundSystem, not from $state fishList
    const actualFish = backgroundSystem?.getFish?.();
    if (!actualFish || actualFish.length === 0) return;

    const f = actualFish[selectedFishIndex];
    if (!f) return;

    // Set wobble parameters - timer is duration remaining
    f.wobbleType = wobbleType;
    f.wobbleTimer = 1.2; // Longer duration so it's visible
    f.wobbleIntensity = 1;

    // Visual feedback for button
    activeWobbleTrigger = wobbleType ?? null;
    setTimeout(() => {
      if (activeWobbleTrigger === wobbleType) activeWobbleTrigger = null;
    }, 300);
  }

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    window.removeEventListener("resize", handleResize);
  });

  const moodOptions: { mood: FishMood; icon: string; color: ColorPreset }[] = [
    { mood: "calm", icon: "fa-water", color: "cyan" },
    { mood: "curious", icon: "fa-search", color: "default" },
    { mood: "alert", icon: "fa-exclamation", color: "amber" },
    { mood: "playful", icon: "fa-star", color: "emerald" },
    { mood: "tired", icon: "fa-bed", color: "gray" },
    { mood: "social", icon: "fa-users", color: "rose" },
  ];

  const wobbleOptions: { type: NonNullable<FishMarineLife["wobbleType"]>; label: string; icon: string; color: ColorPreset }[] = [
    { type: "curious_tilt", label: "Curious", icon: "fa-search", color: "blue" },
    { type: "startled_dart", label: "Startle", icon: "fa-bolt", color: "amber" },
    { type: "playful_wiggle", label: "Wiggle", icon: "fa-star", color: "emerald" },
    { type: "tired_drift", label: "Drift", icon: "fa-bed", color: "gray" },
  ];
</script>

<div class="fish-behavior-lab">
  <div class="controls">
    <div class="header">
      <h2>Fish Behavior Lab</h2>
      <span class="badge">Testing</span>
    </div>

    <!-- Status Bar -->
    {#if selectedFish}
      <LabStatusBar
        chips={statusChips()}
        energy={{ value: selectedFish.energy ?? 1, label: "Energy" }}
      />
    {/if}

    <!-- Fish Selector -->
    <div class="fish-selector">
      <button class="nav-btn" onclick={selectPrevFish} disabled={fishList.length <= 1}>
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="fish-index">{selectedFishIndex + 1} / {fishList.length}</span>
      <button class="nav-btn" onclick={selectNextFish} disabled={fishList.length <= 1}>
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>

    <!-- Quick Commands -->
    <ChipGroup columns={4}>
      <ChipToggle icon="fa-clock" label="Slow Mo" layout="vertical" color="cyan" active={slowMotion} onclick={() => slowMotion = !slowMotion} />
      <ChipToggle icon="fa-eye" label="Overlay" layout="vertical" color="cyan" active={showOverlay} onclick={() => showOverlay = !showOverlay} />
      <ChipToggle icon="fa-sync" label="Reset" layout="vertical" color="cyan" onclick={regenerate} />
      <ChipToggle icon="fa-plus" label="Spawn" layout="vertical" color="cyan" onclick={spawnFish} />
    </ChipGroup>

    <!-- Mood Control -->
    <CollapsibleLabSection title="Mood" icon="fa-heart" defaultOpen={true} accentColor="cyan">
      <div class="trigger-grid cols-3">
        {#each moodOptions as { mood, icon, color }}
          <ChipToggle
            {icon}
            {color}
            active={activeMoodTrigger === mood}
            onclick={() => triggerMood(mood)}
          />
        {/each}
      </div>
    </CollapsibleLabSection>

    <!-- Reactions (Wobbles) -->
    <CollapsibleLabSection title="Reactions" icon="fa-wave-square" defaultOpen={true} accentColor="cyan">
      <div class="trigger-grid cols-2">
        {#each wobbleOptions as { type, label, icon, color }}
          <ChipToggle
            {icon}
            {label}
            {color}
            active={activeWobbleTrigger === type}
            onclick={() => triggerWobble(type)}
          />
        {/each}
      </div>
    </CollapsibleLabSection>

    <!-- Fish Details -->
    <CollapsibleLabSection title="Fish Details" icon="fa-fish" defaultOpen={false} accentColor="cyan">
      {#if selectedFish}
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Species</span>
            <span class="info-value">{selectedFish.species}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Speed</span>
            <span class="info-value">{selectedFish.speed.toFixed(0)} px/s</span>
          </div>
        </div>
        {#if selectedFish.personality}
          <div class="personality-bars">
            <div class="trait">
              <span>Boldness</span>
              <div class="bar"><div class="fill" style="width: {selectedFish.personality.boldness * 100}%"></div></div>
            </div>
            <div class="trait">
              <span>Sociability</span>
              <div class="bar"><div class="fill" style="width: {selectedFish.personality.sociability * 100}%"></div></div>
            </div>
            <div class="trait">
              <span>Activity</span>
              <div class="bar"><div class="fill" style="width: {selectedFish.personality.activity * 100}%"></div></div>
            </div>
            <div class="trait">
              <span>Curiosity</span>
              <div class="bar"><div class="fill" style="width: {selectedFish.personality.curiosity * 100}%"></div></div>
            </div>
          </div>
        {/if}
      {:else}
        <p class="no-fish">No fish selected</p>
      {/if}
    </CollapsibleLabSection>

    <!-- Scene Layers -->
    <CollapsibleLabSection title="Scene Layers" icon="fa-layer-group" defaultOpen={false} accentColor="cyan">
      <ChipGroup variant="grid">
        <ChipToggle label="Gradient" icon="fa-fill-drip" active={layers.gradient} color="cyan" onclick={() => toggleLayer("gradient")} />
        <ChipToggle label="Rays" icon="fa-sun" active={layers.lightRays} color="cyan" onclick={() => toggleLayer("lightRays")} />
        <ChipToggle label="Caustics" icon="fa-water" active={layers.caustics} color="cyan" onclick={() => toggleLayer("caustics")} />
        <ChipToggle label="Particles" icon="fa-sparkles" active={layers.particles} color="cyan" onclick={() => toggleLayer("particles")} />
        <ChipToggle label="Bubbles" icon="fa-circle" active={layers.bubbles} color="cyan" onclick={() => toggleLayer("bubbles")} />
        <ChipToggle label="Jellyfish" icon="fa-disease" active={layers.jellyfish} color="cyan" onclick={() => toggleLayer("jellyfish")} />
      </ChipGroup>
    </CollapsibleLabSection>

    <!-- Debug -->
    <CollapsibleLabSection title="Debug" icon="fa-bug" defaultOpen={false} accentColor="red">
      <div class="debug-toggles">
        <label class="debug-toggle">
          <input type="checkbox" bind:checked={fishDebugConfig.useSpineRendering} />
          <span>Spine Rendering</span>
        </label>
        <label class="debug-toggle">
          <input type="checkbox" bind:checked={fishDebugConfig.enableWobble} />
          <span>Wobble Transform</span>
        </label>
        <label class="debug-toggle">
          <input type="checkbox" bind:checked={fishDebugConfig.enableTailOscillation} />
          <span>Tail Oscillation</span>
        </label>
        <label class="debug-toggle">
          <input type="checkbox" bind:checked={fishDebugConfig.enablePropulsion} />
          <span>Propulsion</span>
        </label>
        <label class="debug-toggle">
          <input type="checkbox" bind:checked={fishDebugConfig.enableFlocking} />
          <span>Flocking</span>
        </label>
      </div>
      <p class="debug-hint">Also: window.fishDebugConfig</p>
    </CollapsibleLabSection>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .fish-behavior-lab {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 20px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
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
    background: var(--scrollbar-track, transparent);
    border-radius: 4px;
  }

  .controls::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
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
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(249, 115, 22, 0.3));
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #f87171;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .fish-selector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 50%;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .nav-btn:hover:not(:disabled) {
      background: rgba(34, 211, 238, 0.15);
      border-color: rgba(34, 211, 238, 0.3);
      color: #22d3ee;
    }
  }

  .nav-btn:active:not(:disabled) {
    transform: scale(0.92);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .fish-index {
    font-size: 1rem;
    font-weight: 600;
    color: #22d3ee;
    min-width: 60px;
    text-align: center;
  }

  /* Trigger Grids (mood/reaction) */
  .trigger-grid {
    display: grid;
    gap: 8px;
  }

  .trigger-grid.cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .trigger-grid.cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: 0.65rem;
    color: #6b7280;
    text-transform: uppercase;
  }

  .info-value {
    font-size: 0.8rem;
    font-weight: 500;
    color: #ffffff;
    text-transform: capitalize;
  }

  .no-fish {
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
    padding: 8px;
  }

  /* Personality Bars */
  .personality-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trait {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .trait span {
    font-size: 0.65rem;
    color: #9ca3af;
    width: 60px;
    flex-shrink: 0;
  }

  .bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #06b6d4, #22d3ee);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* Debug Section */
  .debug-toggles {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .debug-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 0.75rem;
    color: #e5e7eb;
  }

  .debug-toggle input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #22d3ee;
  }

  .debug-hint {
    font-size: 0.65rem;
    color: #6b7280;
    margin-top: 8px;
    font-style: italic;
  }

  /* Preview */
  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #0a1628;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 900px) {
    .fish-behavior-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
