<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import type { FishMarineLife } from "$lib/shared/background/deep-ocean/domain/models/DeepOceanModels";
  import type { FishMood } from "$lib/shared/background/deep-ocean/domain/types/fish-personality-types";
  import type { FishAnimator } from "$lib/shared/background/deep-ocean/services/implementations/FishAnimator";
  import type { FishRenderer } from "$lib/shared/background/deep-ocean/services/implementations/FishRenderer";
  import type { GradientRenderer } from "$lib/shared/background/deep-ocean/services/implementations/GradientRenderer";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;
  let animationTime = 0;

  // Services from container (NOT $state - class instances with methods break with Svelte proxies)
  let fishAnimator: FishAnimator | null = null;
  let fishRenderer: FishRenderer | null = null;
  let gradientRenderer: GradientRenderer | null = null;

  // Fish state
  let fish: FishMarineLife[] = $state([]);
  let selectedFishIndex = $state(0);

  // Display options
  let showPersonality = $state(true);
  let showMood = $state(true);
  let showBehavior = $state(true);
  let slowMotion = $state(false);

  // Derived state for selected fish
  let selectedFish = $derived(fish[selectedFishIndex] ?? null);

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
      // Get services from container
      fishAnimator = container.items.fishAnimator;
      fishRenderer = container.items.fishRenderer;
      gradientRenderer = container.items.gradientRenderer;

      const dimensions = { width: canvas.width, height: canvas.height };

      // Initialize with a small number of fish for testing
      fish = await fishAnimator.initializeFish(dimensions, 3, true);

      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Fish Behavior Lab:", error);
    }
  }

  function startAnimation() {
    if (!canvas || !fishAnimator || !fishRenderer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      if (!canvas || !fishAnimator || !fishRenderer) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = (deltaTime / 16.67) * (slowMotion ? 0.25 : 1);
      lastFrameTime = currentTime;
      animationTime += deltaTime * (slowMotion ? 0.25 : 1);

      const dimensions = { width: canvas.width, height: canvas.height };

      // Update fish
      fish = fishAnimator.updateFish(fish, dimensions, frameMultiplier, animationTime);

      // Process pending spawns
      const newFish = fishAnimator.processPendingSpawns(dimensions, animationTime);
      if (newFish.length > 0) {
        fish = [...fish, ...newFish];
      }

      // Draw
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw gradient background (null state = no animated fog/glow)
      if (gradientRenderer) {
        gradientRenderer.drawOceanGradient(ctx, dimensions, null);
      }

      // Draw selection indicator before fish (so it's behind)
      const selected = fish[selectedFishIndex];
      if (selected) {
        ctx.save();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(selected.x, selected.y, selected.bodyLength * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw all fish (renderer handles spine chains internally via fish.spineJoints)
      // Debug: log first fish data once
      if (fish.length > 0 && animationTime < 100) {
        const f = fish[0]!;
        console.log("Fish debug:", {
          hasColors: !!f.colors,
          bodyTop: f.colors?.bodyTop,
          bodyLength: f.bodyLength,
          bodyHeight: f.bodyHeight,
          spineJointsCount: f.spineJoints?.length,
          firstJointWidth: f.spineJoints?.[0]?.width,
          opacity: f.opacity,
          useSpineChain: f.useSpineChain,
        });
      }
      fishRenderer.drawFish(ctx, fish);

      // Debug: draw simple circles at fish positions to verify they exist
      for (const f of fish) {
        ctx.save();
        ctx.fillStyle = f.spineJoints ? "lime" : "red"; // Green if has spine, red if not
        ctx.beginPath();
        ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw overlays on top
      if (selected) {
        drawFishOverlay(ctx, selected);
      }

      animationFrame = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function drawFishOverlay(ctx: CanvasRenderingContext2D, f: FishMarineLife) {
    const x = f.x;
    const y = f.y - f.bodyLength - 20;

    ctx.save();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";

    let offsetY = 0;

    if (showBehavior) {
      ctx.fillStyle = getBehaviorColor(f.behavior);
      ctx.fillText(`${f.behavior.toUpperCase()}`, x, y + offsetY);
      offsetY += 16;
    }

    if (showMood && f.mood) {
      ctx.fillStyle = getMoodColor(f.mood);
      ctx.fillText(`mood: ${f.mood}`, x, y + offsetY);
      offsetY += 16;
    }

    if (showPersonality && f.personality) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      const p = f.personality;
      ctx.fillText(
        `B:${p.boldness.toFixed(1)} S:${p.sociability.toFixed(1)} A:${p.activity.toFixed(1)} C:${p.curiosity.toFixed(1)}`,
        x,
        y + offsetY
      );
    }

    ctx.restore();
  }

  function getBehaviorColor(behavior: string): string {
    switch (behavior) {
      case "cruising": return "#22d3ee";
      case "turning": return "#f59e0b";
      case "darting": return "#ef4444";
      case "schooling": return "#8b5cf6";
      default: return "#ffffff";
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

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function handleResize() {
    if (!canvas) return;

    const containerEl = canvas.parentElement;
    if (containerEl) {
      canvas.width = containerEl.clientWidth;
      canvas.height = containerEl.clientHeight;
    }
  }

  function spawnFish() {
    if (!canvas || !fishAnimator) return;
    const dimensions = { width: canvas.width, height: canvas.height };
    const newFish = fishAnimator.createFish(dimensions, true);
    fish = [...fish, newFish];
  }

  function removeFish() {
    if (fish.length <= 1) return;
    fish = fish.filter((_, i) => i !== selectedFishIndex);
    selectedFishIndex = Math.min(selectedFishIndex, fish.length - 1);
  }

  function selectNextFish() {
    selectedFishIndex = (selectedFishIndex + 1) % fish.length;
  }

  function selectPrevFish() {
    selectedFishIndex = (selectedFishIndex - 1 + fish.length) % fish.length;
  }

  function triggerMood(mood: FishMood) {
    const f = fish[selectedFishIndex];
    if (!f) return;
    f.mood = mood;
    f.moodTimer = 5; // 5 seconds
    fish = [...fish]; // Trigger reactivity
  }

  function triggerWobble(wobbleType: FishMarineLife["wobbleType"]) {
    const f = fish[selectedFishIndex];
    if (!f) return;
    f.wobbleType = wobbleType;
    f.wobbleTimer = 0.8;
    f.wobbleIntensity = 1;
    fish = [...fish]; // Trigger reactivity
  }

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="fish-behavior-lab">
  <div class="controls">
    <div class="header">
      <h2>Fish Behavior Lab</h2>
      <span class="badge">Testing</span>
    </div>

    <!-- Fish Selection -->
    <div class="section">
      <span class="label">Selected Fish</span>
      <div class="fish-selector">
        <button class="nav-btn" onclick={selectPrevFish} disabled={fish.length <= 1}>
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="fish-index">{selectedFishIndex + 1} / {fish.length}</span>
        <button class="nav-btn" onclick={selectNextFish} disabled={fish.length <= 1}>
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- Fish Info -->
    {#if selectedFish}
      <div class="section fish-info">
        <span class="label">Fish Info</span>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Species</span>
            <span class="info-value">{selectedFish.species}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Behavior</span>
            <span class="info-value" style="color: {getBehaviorColor(selectedFish.behavior)}">{selectedFish.behavior}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Mood</span>
            <span class="info-value" style="color: {getMoodColor(selectedFish.mood ?? 'calm')}">{selectedFish.mood ?? 'calm'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Energy</span>
            <span class="info-value">{((selectedFish.energy ?? 1) * 100).toFixed(0)}%</span>
          </div>
        </div>

        {#if selectedFish.personality}
          <div class="personality-bars">
            <span class="label">Personality</span>
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
      </div>
    {/if}

    <!-- Trigger Mood -->
    <ChipGroup label="Trigger Mood">
      <ChipToggle label="Calm" color="cyan" onclick={() => triggerMood("calm")} />
      <ChipToggle label="Curious" color="purple" onclick={() => triggerMood("curious")} />
      <ChipToggle label="Alert" color="orange" onclick={() => triggerMood("alert")} />
      <ChipToggle label="Playful" color="green" onclick={() => triggerMood("playful")} />
      <ChipToggle label="Tired" color="gray" onclick={() => triggerMood("tired")} />
      <ChipToggle label="Social" color="pink" onclick={() => triggerMood("social")} />
    </ChipGroup>

    <!-- Trigger Wobble -->
    <ChipGroup label="Trigger Wobble">
      <ChipToggle label="Curious Tilt" color="purple" onclick={() => triggerWobble("curious_tilt")} />
      <ChipToggle label="Startled Dart" color="red" onclick={() => triggerWobble("startled_dart")} />
      <ChipToggle label="Playful Wiggle" color="green" onclick={() => triggerWobble("playful_wiggle")} />
      <ChipToggle label="Tired Drift" color="gray" onclick={() => triggerWobble("tired_drift")} />
    </ChipGroup>

    <!-- Display Options -->
    <ChipGroup label="Display">
      <ChipToggle label="Personality" active={showPersonality} color="cyan" onclick={() => showPersonality = !showPersonality} />
      <ChipToggle label="Mood" active={showMood} color="cyan" onclick={() => showMood = !showMood} />
      <ChipToggle label="Behavior" active={showBehavior} color="cyan" onclick={() => showBehavior = !showBehavior} />
      <ChipToggle label="Slow Motion" active={slowMotion} color="orange" onclick={() => slowMotion = !slowMotion} />
    </ChipGroup>

    <!-- Actions -->
    <div class="actions">
      <button class="action-btn" onclick={spawnFish}>
        <i class="fas fa-plus"></i>
        Add Fish
      </button>
      <button class="action-btn secondary" onclick={removeFish} disabled={fish.length <= 1}>
        <i class="fas fa-minus"></i>
        Remove
      </button>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .fish-behavior-lab {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #9ca3af;
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
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
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

  .fish-info {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 8px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
  }

  .info-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #ffffff;
    text-transform: capitalize;
  }

  .personality-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .trait {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .trait span {
    font-size: 0.75rem;
    color: #9ca3af;
    width: 70px;
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

  .actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(6, 182, 212, 0.35);
  }

  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-btn.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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
