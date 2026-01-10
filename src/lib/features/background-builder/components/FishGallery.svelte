<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IFishRenderer } from "$lib/shared/background/deep-ocean/services/contracts/IFishRenderer";
  import type { FishMarineLife, FishSpecies } from "$lib/shared/background/deep-ocean/domain/models/DeepOceanModels";
  import { FishAnimator } from "$lib/shared/background/deep-ocean/services/implementations/FishAnimator";

  // Animation mode toggle - spine-chain is the new organic approach
  let useSpineChain: boolean = $state(true);
  let fishAnimator: FishAnimator | null = $state(null);

  // Species configuration for generating sample fish
  const SPECIES_CONFIG: Record<FishSpecies, {
    bodyAspect: [number, number];
    bodyLength: [number, number];
    finScale: number;
    eyeSize: [number, number];
    hasBioluminescence: boolean;
    colors: { body: string; belly: string; accent: string }[];
  }> = {
    tropical: {
      bodyAspect: [2.0, 2.5],
      bodyLength: [60, 90],
      finScale: 1.3,
      eyeSize: [0.12, 0.16],
      hasBioluminescence: false,
      colors: [
        { body: "#FF6B35", belly: "#FFE66D", accent: "#4ECDC4" },
        { body: "#FF1493", belly: "#FFB6C1", accent: "#00CED1" },
        { body: "#FFD700", belly: "#FFF8DC", accent: "#FF4500" },
        { body: "#00FF7F", belly: "#98FB98", accent: "#FF69B4" },
        { body: "#9370DB", belly: "#E6E6FA", accent: "#FFD700" },
      ],
    },
    sleek: {
      bodyAspect: [3.5, 4.5],
      bodyLength: [80, 120],
      finScale: 0.7,
      eyeSize: [0.08, 0.11],
      hasBioluminescence: false,
      colors: [
        { body: "#4682B4", belly: "#B0C4DE", accent: "#20B2AA" },
        { body: "#2F4F4F", belly: "#708090", accent: "#00CED1" },
        { body: "#5F9EA0", belly: "#E0FFFF", accent: "#FF6347" },
      ],
    },
    deep: {
      bodyAspect: [2.2, 2.8],
      bodyLength: [50, 80],
      finScale: 1.0,
      eyeSize: [0.18, 0.24],
      hasBioluminescence: true,
      colors: [
        { body: "#1a1a2e", belly: "#2d2d44", accent: "#00ffff" },
        { body: "#0d0d1a", belly: "#1a1a33", accent: "#ff00ff" },
        { body: "#1f1f3d", belly: "#2e2e5c", accent: "#00ff88" },
      ],
    },
    schooling: {
      bodyAspect: [2.5, 3.0],
      bodyLength: [35, 55],
      finScale: 0.9,
      eyeSize: [0.10, 0.14],
      hasBioluminescence: false,
      colors: [
        { body: "#C0C0C0", belly: "#F5F5F5", accent: "#4169E1" },
        { body: "#87CEEB", belly: "#E0FFFF", accent: "#FFD700" },
        { body: "#DDA0DD", belly: "#FFF0F5", accent: "#32CD32" },
      ],
    },
  };

  interface GalleryFish {
    id: string;
    fish: FishMarineLife;
    canvas: HTMLCanvasElement | null;
    isAnimating: boolean;
    animationFrame: number | null;
  }

  let galleryFishes: GalleryFish[] = $state([]);
  let selectedFish: GalleryFish | null = $state(null);
  let animationCanvas: HTMLCanvasElement | null = $state(null);
  let fishRenderer: IFishRenderer | null = $state(null);

  function lerp(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  function generateFish(species: FishSpecies, index: number, spineChainMode: boolean): FishMarineLife {
    // When using spine-chain mode, use the FishAnimator to create the fish
    if (spineChainMode && fishAnimator) {
      const fish = fishAnimator.createFish(
        { width: 400, height: 300 },
        true // useSpineChain
      );
      // Override species for gallery display
      fish.species = species;

      // Position for gallery card display - need to re-position spine joints too
      const targetX = 100;
      const targetY = 80;
      const offsetX = targetX - fish.x;
      const offsetY = targetY - fish.y;

      fish.x = targetX;
      fish.y = targetY;
      fish.baseY = targetY;
      fish.direction = 1;

      // Re-position all spine joints to be centered and properly laid out
      // For a right-facing fish: head is on right, tail extends to left
      if (fish.spineJoints && fish.spineJoints.length > 0) {
        const segmentLength = fish.bodyLength / (fish.spineJoints.length - 1);

        for (let i = 0; i < fish.spineJoints.length; i++) {
          const joint = fish.spineJoints[i]!;
          // Head (joint 0) at right, tail at left for right-facing fish
          // joint[0] = head at center + bodyLength/2
          // joint[last] = tail at center - bodyLength/2
          joint.x = targetX + fish.bodyLength / 2 - i * segmentLength;
          joint.y = targetY;
          joint.angle = 0; // Face right (toward +X)
        }
      }

      return fish;
    }

    // Legacy mode: manually create fish
    const config = SPECIES_CONFIG[species];
    const colorPalette = randomChoice(config.colors);
    const bodyLength = lerp(config.bodyLength[0], config.bodyLength[1]);
    const bodyAspect = lerp(config.bodyAspect[0], config.bodyAspect[1]);
    const bodyHeight = bodyLength / bodyAspect;
    const eyeSize = lerp(config.eyeSize[0], config.eyeSize[1]);
    const baseSpeed = lerp(0.3, 0.8);

    return {
      type: "fish",
      x: 100,
      y: 80,
      opacity: 1,
      animationPhase: Math.random() * Math.PI * 2,

      // Species and appearance
      species,
      colors: {
        bodyTop: colorPalette.body,
        bodyBottom: colorPalette.belly,
        accent: colorPalette.accent,
        eye: "#1a1a2e",
        finTint: colorPalette.accent,
      },

      // Body dimensions
      bodyLength,
      bodyHeight,
      bodyAspect,

      // Position and movement
      direction: 1,
      speed: baseSpeed,
      baseSpeed,
      verticalDrift: 0,
      bobAmplitude: lerp(2, 5),
      bobSpeed: lerp(0.01, 0.02),
      depthBand: { min: 0.3, max: 0.7 },
      baseY: 80,

      // Depth/parallax
      depthLayer: "mid" as const,
      depthScale: 1,

      // Behavior
      behavior: "cruising" as const,
      behaviorTimer: 0,

      // Body shape and animation
      rotation: 0,
      bodyFlexPhase: 0,
      bodyFlexAmount: 0.15,

      // Fins with physics (FinState: angle, velocity, targetAngle, length, width, segments)
      dorsalFin: { angle: 0, velocity: 0, targetAngle: 0, length: 0.25, width: 0.3, segments: 5 },
      pectoralFinTop: { angle: -0.2, velocity: 0, targetAngle: -0.2, length: 0.2, width: 0.15, segments: 4 },
      pectoralFinBottom: { angle: 0.2, velocity: 0, targetAngle: 0.2, length: 0.2, width: 0.15, segments: 4 },
      pelvicFin: { angle: 0.1, velocity: 0, targetAngle: 0.1, length: 0.12, width: 0.1, segments: 3 },
      analFin: { angle: 0.1, velocity: 0, targetAngle: 0.1, length: 0.15, width: 0.12, segments: 3 },
      // TailState extends FinState with forkAngle, forkDepth, wavePhase, waveAmplitude
      tailFin: {
        angle: 0, velocity: 0, targetAngle: 0, length: 0.3, width: 0.4, segments: 6,
        forkAngle: 0.3, forkDepth: 0.4, wavePhase: 0, waveAmplitude: 0.2
      },

      // Visual details
      scalePhase: Math.random() * Math.PI * 2,
      scaleSpeed: lerp(0.01, 0.02),
      eyeSize,
      gillPhase: Math.random() * Math.PI * 2,
      gillSpeed: lerp(0.03, 0.05),
      hasBioluminescence: config.hasBioluminescence,
      glowPhase: Math.random() * Math.PI * 2,
      glowIntensity: config.hasBioluminescence ? lerp(0.3, 0.8) : 0,

      // Wake effects
      wakeTrail: [],
      lastWakeSpawn: 0,

      // Legacy compatibility
      width: bodyLength,
      height: bodyHeight,
      tailPhase: 0,
    };
  }

  function generateGallery() {
    const fishes: GalleryFish[] = [];
    const species: FishSpecies[] = ["tropical", "sleek", "deep", "schooling"];

    // Generate 4 of each species
    species.forEach((sp) => {
      for (let i = 0; i < 4; i++) {
        fishes.push({
          id: `${sp}-${i}`,
          fish: generateFish(sp, i, useSpineChain),
          canvas: null,
          isAnimating: false,
          animationFrame: null,
        });
      }
    });

    galleryFishes = fishes;
  }

  // Toggle mode and regenerate gallery
  function toggleAnimationMode() {
    useSpineChain = !useSpineChain;
    stopAnimation();
    generateGallery();
    setTimeout(() => {
      galleryFishes.forEach(gf => drawStaticFish(gf));
    }, 50);
  }

  function drawStaticFish(galleryFish: GalleryFish) {
    if (!galleryFish.canvas || !fishRenderer) return;

    const ctx = galleryFish.canvas.getContext("2d");
    if (!ctx) return;

    const width = galleryFish.canvas.width;
    const height = galleryFish.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Center fish in canvas
    const fish = { ...galleryFish.fish };
    fish.x = width / 2;
    fish.y = height / 2;

    // Draw single fish
    fishRenderer.drawFish(ctx, [fish]);
  }

  function startAnimation(galleryFish: GalleryFish) {
    if (!fishRenderer) return;

    // Stop any existing animation
    if (selectedFish?.animationFrame) {
      cancelAnimationFrame(selectedFish.animationFrame);
    }

    // Set selectedFish first to render the canvas
    selectedFish = galleryFish;
    galleryFish.isAnimating = true;

    // Wait for canvas to be rendered, then start animation
    setTimeout(() => {
      if (!animationCanvas) return;

      const ctx = animationCanvas.getContext("2d");
      if (!ctx) return;

      const width = animationCanvas.width;
      const height = animationCanvas.height;
      runAnimation(galleryFish, ctx, width, height);
    }, 50);
  }

  function runAnimation(
    galleryFish: GalleryFish,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {

    // Create animated fish copy with proper dimensions for the canvas
    let animatedFish: FishMarineLife;

    if (useSpineChain && fishAnimator) {
      // Create a proper spine-chain fish centered in the canvas
      animatedFish = fishAnimator.createFish({ width, height }, true);

      // Re-position to center of canvas
      const targetX = width / 2;
      const targetY = height / 2;

      animatedFish.x = targetX;
      animatedFish.y = targetY;
      animatedFish.baseY = targetY;
      animatedFish.depthBand = { min: height * 0.3, max: height * 0.7 };
      animatedFish.direction = 1;
      animatedFish.speed = 0; // Stationary for preview
      animatedFish.baseSpeed = 0.5;

      // Re-position spine joints with proper layout (like gallery)
      // For a right-facing fish: head is on right, tail extends to left
      if (animatedFish.spineJoints && animatedFish.spineJoints.length > 0) {
        const segmentLength = animatedFish.bodyLength / (animatedFish.spineJoints.length - 1);
        for (let i = 0; i < animatedFish.spineJoints.length; i++) {
          const joint = animatedFish.spineJoints[i]!;
          // Head (joint 0) at right, tail at left for right-facing fish
          joint.x = targetX + animatedFish.bodyLength / 2 - i * segmentLength;
          joint.y = targetY;
          joint.angle = 0; // Face right (toward +X)
        }
      }

      // Copy visual properties from gallery fish
      animatedFish.species = galleryFish.fish.species;
      animatedFish.colors = galleryFish.fish.colors;
    } else {
      // Legacy mode - use JSON copy
      animatedFish = JSON.parse(JSON.stringify(galleryFish.fish));
      animatedFish.x = width / 2;
      animatedFish.y = height / 2;
      animatedFish.baseY = height / 2;
      animatedFish.depthBand = { min: height * 0.3, max: height * 0.7 };
    }

    let animationTime = 0;
    const animate = () => {
      animationTime += 0.016; // ~60fps

      ctx.clearRect(0, 0, width, height);

      if (useSpineChain && animatedFish.useSpineChain && animatedFish.spineJoints) {
        // Manually animate spine-chain fish for stationary preview
        // Update swim phase
        animatedFish.swimPhase = (animatedFish.swimPhase ?? 0) + 0.1;

        // Apply simple tail oscillation to create swimming motion
        const tailAmplitude = animatedFish.tailAmplitude ?? 8;
        const swimPhase = animatedFish.swimPhase ?? 0;
        const joints = animatedFish.spineJoints;

        // Animate spine with wave propagation
        for (let i = 0; i < joints.length; i++) {
          const joint = joints[i]!;
          // Wave amplitude increases toward tail
          const waveInfluence = i / (joints.length - 1);
          const phase = swimPhase - i * 0.3; // Phase delay for wave propagation
          const offset = Math.sin(phase) * tailAmplitude * waveInfluence;

          // Apply vertical offset (perpendicular to facing direction)
          joint.y = animatedFish.y + offset;
          joint.angle = Math.sin(phase) * 0.2 * waveInfluence; // Slight angle variation
        }

        // Update visual animations
        animatedFish.scalePhase = (animatedFish.scalePhase ?? 0) + 0.02;
        animatedFish.gillPhase = (animatedFish.gillPhase ?? 0) + 0.05;
        animatedFish.animationPhase = (animatedFish.animationPhase ?? 0) + 0.02;

        if (animatedFish.hasBioluminescence) {
          animatedFish.glowPhase = (animatedFish.glowPhase ?? 0) + 0.03;
        }
      } else {
        // Legacy animation - manually update properties
        animatedFish.bodyFlexPhase += 0.08;
        animatedFish.scalePhase += 0.02;
        animatedFish.gillPhase += 0.05;
        animatedFish.animationPhase += 0.02;

        // Animate tail
        animatedFish.tailFin.wavePhase += 0.12;
        animatedFish.tailFin.angle = Math.sin(animatedFish.tailFin.wavePhase) * 0.25;

        // Animate fins with idle wave
        const idleWave = Math.sin(animationTime * 2) * 0.08;
        animatedFish.dorsalFin.angle = idleWave;
        animatedFish.pectoralFinTop.angle = -0.2 + idleWave * 0.5;
        animatedFish.pectoralFinBottom.angle = 0.2 - idleWave * 0.5;

        // Animate bioluminescence
        if (animatedFish.hasBioluminescence) {
          animatedFish.glowPhase += 0.03;
        }
      }

      // Draw fish
      fishRenderer!.drawFish(ctx, [animatedFish]);

      galleryFish.animationFrame = requestAnimationFrame(animate);
    };

    galleryFish.animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (selectedFish?.animationFrame) {
      cancelAnimationFrame(selectedFish.animationFrame);
      selectedFish.animationFrame = null;
      selectedFish.isAnimating = false;
    }
    selectedFish = null;
  }

  function regenerateGallery() {
    stopAnimation();
    generateGallery();
    // Re-render all fish after a tick
    setTimeout(() => {
      galleryFishes.forEach(gf => drawStaticFish(gf));
    }, 50);
  }

  onMount(() => {
    // Get fishRenderer from ITI container (deep ocean services are already registered)
    try {
      fishRenderer = container.items.fishRenderer;
      // Create a local FishAnimator for spine-chain mode (not from DI to avoid singleton issues)
      fishAnimator = new FishAnimator();
    } catch (e) {
      console.error("Failed to get FishRenderer:", e);
    }

    generateGallery();

    // Initial render after canvases are ready
    setTimeout(() => {
      galleryFishes.forEach(gf => drawStaticFish(gf));
    }, 100);

    return () => {
      stopAnimation();
    };
  });
</script>

<div class="fish-gallery">
  <div class="gallery-header">
    <h2>Fish Species Gallery</h2>
    <p>Click any fish to see it animate. Use this to evaluate designs and provide feedback.</p>
    <div class="header-controls">
      <button class="mode-toggle" class:active={useSpineChain} onclick={toggleAnimationMode}>
        <span class="mode-indicator" class:spine-chain={useSpineChain} class:legacy={!useSpineChain}></span>
        <span class="mode-label">{useSpineChain ? 'Spine Chain (Organic)' : 'Legacy (Bezier)'}</span>
      </button>
      <button class="regenerate-btn" onclick={regenerateGallery}>
        <i class="fas fa-sync-alt"></i>
        Regenerate All
      </button>
    </div>
  </div>

  {#if selectedFish}
    <div class="animation-panel">
      <div class="animation-header">
        <h3>Animating: {selectedFish.fish.species}</h3>
        <button class="close-btn" onclick={stopAnimation} aria-label="Close animation">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <canvas
        bind:this={animationCanvas}
        width={400}
        height={300}
        class="animation-canvas"
      ></canvas>
    </div>
  {/if}

  <div class="species-sections">
    {#each ["tropical", "sleek", "deep", "schooling"] as species}
      <div class="species-section">
        <h3 class="species-title">
          {species.charAt(0).toUpperCase() + species.slice(1)}
        </h3>
        <div class="fish-grid">
          {#each galleryFishes.filter(gf => gf.fish.species === species) as galleryFish (galleryFish.id)}
            <button
              class="fish-card"
              class:selected={selectedFish?.id === galleryFish.id}
              onclick={() => startAnimation(galleryFish)}
            >
              <canvas
                bind:this={galleryFish.canvas}
                width={200}
                height={160}
                class="fish-canvas"
              ></canvas>
              <div class="fish-info">
                <span class="fish-size">
                  {Math.round(galleryFish.fish.bodyLength)}px
                </span>
                <span class="fish-aspect">
                  {galleryFish.fish.bodyAspect.toFixed(1)}:1
                </span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .fish-gallery {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .gallery-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gallery-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .gallery-header p {
    margin: 0;
    color: #8899aa;
    font-size: 0.875rem;
  }

  .header-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
    align-items: center;
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .mode-toggle.active {
    background: rgba(74, 222, 128, 0.15);
    border-color: rgba(74, 222, 128, 0.4);
  }

  .mode-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transition: background 0.2s ease;
  }

  .mode-indicator.spine-chain {
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
  }

  .mode-indicator.legacy {
    background: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  }

  .mode-label {
    font-weight: 500;
  }

  .regenerate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(125, 211, 252, 0.15);
    border: 1px solid rgba(125, 211, 252, 0.3);
    border-radius: 8px;
    color: #7dd3fc;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .regenerate-btn:hover {
    background: rgba(125, 211, 252, 0.25);
    border-color: rgba(125, 211, 252, 0.5);
  }

  .animation-panel {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(125, 211, 252, 0.3);
    border-radius: 12px;
    padding: 16px;
  }

  .animation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .animation-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: #7dd3fc;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .animation-canvas {
    display: block;
    width: 100%;
    max-width: 400px;
    height: auto;
    background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);
    border-radius: 8px;
  }

  .species-sections {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .species-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .species-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: #7dd3fc;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(125, 211, 252, 0.2);
  }

  .fish-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .fish-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .fish-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(125, 211, 252, 0.3);
    transform: translateY(-2px);
  }

  .fish-card.selected {
    background: rgba(125, 211, 252, 0.1);
    border-color: rgba(125, 211, 252, 0.5);
  }

  .fish-canvas {
    display: block;
    width: 100%;
    height: auto;
    background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);
    border-radius: 8px;
  }

  .fish-info {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 0.75rem;
    color: #667788;
  }

  .fish-size {
    color: #8899aa;
  }

  .fish-aspect {
    color: #667788;
  }
</style>
