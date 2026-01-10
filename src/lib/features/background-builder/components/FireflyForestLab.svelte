<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    FireflyForestBackgroundSystem,
    type FireflyForestLayers,
    type PlacementConfig,
  } from "$lib/shared/background/firefly-forest/services/FireflyForestBackgroundSystem";
  import type { TreeTypeVisibility, TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";
  import {
    getFireflyForestSettings,
    updateFireflyForestSettings,
  } from "../state/background-builder-state.svelte";

  // Mode toggle: preview vs tree lab
  type LabMode = "preview" | "treeLab";
  let mode: LabMode = $state("preview");

  // Tree Lab state
  const TREE_TYPES: TreeType[] = ["pine", "fir", "spruce", "oak", "maple", "poplar"];
  let labTreeType: TreeType = $state("spruce");
  let treeSamples = $state<Array<{ seed: number; status: "pending" | "approved" | "rejected" }>>([]);
  let treeLabCanvases = $state<HTMLCanvasElement[]>([]);

  // Algorithm types for spruce generation
  type SpruceAlgorithm = "smooth" | "whorl";
  let spruceAlgorithm = $state<SpruceAlgorithm>("whorl");

  // Algorithm 1: Smooth - tapered cone with organic waviness
  interface SmoothParams {
    spread: number;       // 0.45-0.65 - crown width relative to height
    taperPower: number;   // 0.45-0.75 - how sharply it narrows (lower = wider at top)
    waveFreq: number;     // 4-10 - frequency of edge waviness
    waveAmp: number;      // 2-8 - amplitude of edge waviness
    jitter: number;       // 0-4 - random edge variation
  }

  // Algorithm 2: Whorl - structured branch layers with jagged edges
  interface WhorlParams {
    spread: number;       // 0.40-0.65 - crown width relative to height
    taperExponent: number;// 1.2-2.0 - how quickly it narrows toward top
    layers: number;       // 6-12 - number of branch whorls
    droop: number;        // 0.05-0.35 - how much lower branches droop
    jaggedness: number;   // 0.5-2.0 - intensity of bottom-edge jagged points
  }

  let smoothParams = $state<SmoothParams>({
    spread: 0.55,
    taperPower: 0.58,
    waveFreq: 6,
    waveAmp: 5,
    jitter: 2,
  });

  let whorlParams = $state<WhorlParams>({
    spread: 0.52,
    taperExponent: 1.5,
    layers: 8,
    droop: 0.18,
    jaggedness: 1.0,
  });

  // Fixed seeds for the 3 sample trees (so they stay consistent when adjusting params)
  let sampleSeeds = $state<number[]>([123456, 789012, 345678]);

  function randomizeSampleSeeds() {
    sampleSeeds = [
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
    ];
    renderTreeLabSamples();
  }

  function resetSmoothParams() {
    smoothParams = {
      spread: 0.55,
      taperPower: 0.58,
      waveFreq: 6,
      waveAmp: 5,
      jitter: 2,
    };
    renderTreeLabSamples();
  }

  function resetWhorlParams() {
    whorlParams = {
      spread: 0.52,
      taperExponent: 1.5,
      layers: 8,
      droop: 0.18,
      jaggedness: 1.0,
    };
    renderTreeLabSamples();
  }

  function resetCurrentParams() {
    if (spruceAlgorithm === "smooth") resetSmoothParams();
    else resetWhorlParams();
  }

  // Load saved tree feedback from localStorage
  interface TreeFeedback {
    [treeType: string]: {
      approved: number[];
      rejected: number[];
    };
  }
  let treeFeedback = $state<TreeFeedback>(loadTreeFeedback());

  function loadTreeFeedback(): TreeFeedback {
    if (typeof localStorage === "undefined") return {};
    const saved = localStorage.getItem("tka-tree-lab-feedback");
    return saved ? JSON.parse(saved) : {};
  }

  function saveTreeFeedback() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("tka-tree-lab-feedback", JSON.stringify(treeFeedback));
  }

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Load persisted settings
  const savedSettings = getFireflyForestSettings();

  // System
  let system: FireflyForestBackgroundSystem | null = $state(null);
  let layers = $state<FireflyForestLayers>({ ...savedSettings.layers });

  // Tree type visibility
  let treeTypes = $state<TreeTypeVisibility>({ ...savedSettings.treeTypes });

  // Quality setting
  let quality: QualityLevel = $state(savedSettings.quality);

  // Simplified placement sliders (0-1 scale, user-friendly)
  // Density: 0 = sparse, 1 = dense (inverts to minSpacing)
  // Style: 0 = natural/random, 1 = composed/balanced
  let density = $state(0.5);
  let style = $state(0.5);

  // Stats display
  let stats = $state<{
    fireflies: number;
    stars: number;
    ambientParticles: number;
    hasShootingStar: boolean;
  }>({
    fireflies: 0,
    stars: 0,
    ambientParticles: 0,
    hasShootingStar: false,
  });
  let lastStatsUpdate = 0;

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    try {
      system = new FireflyForestBackgroundSystem();
      const dimensions = { width: canvas.width, height: canvas.height };
      system.initialize(dimensions, quality);
      system.setLayerVisibility(layers);

      const systemStats = system.getStats();
      stats = { ...stats, ...systemStats };

      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Firefly Forest Lab:", error);
    }
  }

  function startAnimation() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      // Guard against destroyed component
      if (!canvas || !system) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };

      system.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      system.draw(ctx, dimensions);

      // Update stats every second
      if (currentTime - lastStatsUpdate > 1000 && system) {
        const systemStats = system.getStats();
        stats = { ...stats, ...systemStats };
        lastStatsUpdate = currentTime;
      }

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
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };

      if (system) {
        system.handleResize(oldDimensions, newDimensions);
      }
    }
  }

  function cleanup() {
    if (system) {
      system.cleanup();
      system = null;
    }
  }

  function regenerate() {
    stopAnimation();
    cleanup();
    initializeSystem();
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    updateFireflyForestSettings({ quality: q });
    if (system) {
      system.setQuality(q);
      const systemStats = system.getStats();
      stats = { ...stats, ...systemStats };
    }
  }

  function toggleLayer(layer: keyof FireflyForestLayers) {
    layers[layer] = !layers[layer];
    updateFireflyForestSettings({ layers: { ...layers } });
    if (system) {
      system.setLayerVisibility(layers);
    }
  }

  function toggleTreeType(type: keyof TreeTypeVisibility) {
    treeTypes[type] = !treeTypes[type];
    updateFireflyForestSettings({ treeTypes: { ...treeTypes } });
    if (system) {
      system.setTreeVisibility(treeTypes);
      system.regenerateTrees();
    }
  }

  /**
   * Maps simplified sliders to underlying placement config
   * Density (0-1): 0=sparse (high spacing), 1=dense (low spacing)
   * Style (0-1): 0=natural (high jitter, no heroes), 1=composed (low jitter, strong heroes)
   */
  function applyPlacement() {
    if (!system) return;

    // Density maps inversely to spacing (dense = low spacing)
    const minSpacing = 0.08 * (1 - density); // 0.08 when sparse, 0 when dense
    const crossLayerThreshold = 0.06 * (1 - density); // Similar inverse mapping

    // Style maps jitter (inverted) and hero strength (direct)
    const jitter = 0.5 * (1 - style); // 0.5 when natural, 0 when composed
    const heroStrength = style; // 0 when natural, 1 when composed

    system.setPlacementConfig({ minSpacing, crossLayerThreshold, jitter, heroStrength });
    system.regenerateTrees();
  }

  function updateDensity(value: number) {
    density = value;
    applyPlacement();
  }

  function updateStyle(value: number) {
    style = value;
    applyPlacement();
  }

  function resetPlacement() {
    density = 0.5;
    style = 0.5;
    if (system) {
      system.resetPlacementConfig();
      system.regenerateTrees();
    }
  }

  /**
   * Handle mouse movement for parallax effect
   * Converts viewport coordinates to normalized values for the parallax system
   */
  function handleMouseMove(event: MouseEvent) {
    if (!system) return;
    system.updateMousePosition(
      event.clientX,
      event.clientY,
      window.innerWidth,
      window.innerHeight
    );
  }

  /**
   * Reset parallax when mouse leaves the preview area
   */
  function handleMouseLeave() {
    if (!system) return;
    // Gradually return to center by setting target to 0
    system.updateMousePosition(
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerWidth,
      window.innerHeight
    );
  }

  // =====================================
  // TREE LAB FUNCTIONS
  // =====================================

  function generateTreeSamples() {
    // Generate 20 unique seeds
    const samples: Array<{ seed: number; status: "pending" | "approved" | "rejected" }> = [];
    for (let i = 0; i < 20; i++) {
      const seed = Math.floor(Math.random() * 1000000);
      // Check if this seed was previously evaluated
      const typeData = treeFeedback[labTreeType];
      let status: "pending" | "approved" | "rejected" = "pending";
      if (typeData?.approved.includes(seed)) {
        status = "approved";
      } else if (typeData?.rejected.includes(seed)) {
        status = "rejected";
      }
      samples.push({ seed, status });
    }
    treeSamples = samples;
  }

  function setLabTreeType(type: TreeType) {
    labTreeType = type;
    if (type === "spruce") {
      // Spruce uses fixed seeds with tunable params - just re-render
      setTimeout(() => renderTreeLabSamples(), 50);
    } else {
      // Other types use the random sample grid
      generateTreeSamples();
    }
  }

  function toggleTreeStatus(index: number) {
    const sample = treeSamples[index];
    if (!sample) return;

    // Cycle: pending -> approved -> rejected -> pending
    const nextStatus: Record<string, "pending" | "approved" | "rejected"> = {
      pending: "approved",
      approved: "rejected",
      rejected: "pending",
    };
    sample.status = nextStatus[sample.status];

    // Update feedback storage
    if (!treeFeedback[labTreeType]) {
      treeFeedback[labTreeType] = { approved: [], rejected: [] };
    }
    const typeData = treeFeedback[labTreeType]!;

    // Remove from both lists first
    typeData.approved = typeData.approved.filter((s) => s !== sample.seed);
    typeData.rejected = typeData.rejected.filter((s) => s !== sample.seed);

    // Add to appropriate list
    if (sample.status === "approved") {
      typeData.approved.push(sample.seed);
    } else if (sample.status === "rejected") {
      typeData.rejected.push(sample.seed);
    }

    saveTreeFeedback();
    treeSamples = [...treeSamples]; // Trigger reactivity
  }

  function drawTreeSample(canvasEl: HTMLCanvasElement, seed: number) {
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const width = canvasEl.width;
    const height = canvasEl.height;

    // Light gray background for contrast against dark tree silhouettes
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(0, 0, width, height);

    // Draw tree centered
    const treeWidth = width * 0.6;
    const treeHeight = height * 0.85;
    const x = width / 2;
    const baseY = height * 0.95;

    // Use seed for deterministic generation
    drawSingleTree(ctx, labTreeType, x, baseY, treeWidth, treeHeight, seed);
  }

  function drawSingleTree(
    ctx: CanvasRenderingContext2D,
    type: TreeType,
    x: number,
    baseY: number,
    width: number,
    height: number,
    seed: number
  ) {
    // Colors (mid-layer colors for visibility)
    const foliageColor = { r: 6, g: 12, b: 10 };
    const trunkColor = { r: 10, g: 8, b: 6 };

    const rgbToString = (c: { r: number; g: number; b: number }) =>
      `rgb(${c.r}, ${c.g}, ${c.b})`;

    // Create gradient for foliage
    const foliageCenterY = baseY - height * 0.5;
    const gradient = ctx.createRadialGradient(x, foliageCenterY, 0, x, foliageCenterY, height * 0.6);
    const lighter = { r: Math.min(255, foliageColor.r * 1.15), g: Math.min(255, foliageColor.g * 1.15), b: Math.min(255, foliageColor.b * 1.15) };
    const darker = { r: foliageColor.r * 0.85, g: foliageColor.g * 0.85, b: foliageColor.b * 0.85 };
    gradient.addColorStop(0, rgbToString(lighter));
    gradient.addColorStop(0.6, rgbToString(foliageColor));
    gradient.addColorStop(1, rgbToString(darker));

    // Draw based on type
    switch (type) {
      case "spruce":
        // Dispatch to selected algorithm
        if (spruceAlgorithm === "smooth") {
          drawSpruceSmooth(ctx, x, baseY, width, height, trunkColor, gradient, seed, smoothParams);
        } else {
          drawSpruceWhorl(ctx, x, baseY, width, height, trunkColor, gradient, seed, whorlParams);
        }
        break;
      case "pine":
        drawPineForLab(ctx, x, baseY, width, height, trunkColor, gradient);
        break;
      case "fir":
        drawFirForLab(ctx, x, baseY, width, height, trunkColor, gradient);
        break;
      case "oak":
        drawOakForLab(ctx, x, baseY, width, height, trunkColor, gradient);
        break;
      case "maple":
        drawMapleForLab(ctx, x, baseY, width, height, trunkColor, gradient);
        break;
      case "poplar":
        drawPoplarForLab(ctx, x, baseY, width, height, trunkColor, gradient);
        break;
    }
  }

  /**
   * Smooth algorithm: tapered cone with organic waviness
   * Key: wide spread, controlled waviness that decreases toward bottom for stability
   */
  function drawSpruceSmooth(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient,
    seed: number,
    params: SmoothParams
  ) {
    const trunkW = width * 0.08;
    const trunkH = height * 0.05;
    const treeTop = baseY - height;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Seeded random
    let localSeed = seed;
    const rand = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Draw trunk
    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 3, bodyStart);
    ctx.lineTo(x + trunkW / 3, bodyStart);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Apply parameters with per-tree variation
    const maxWidth = width * (params.spread + (rand() - 0.5) * 0.06);
    const taperPower = params.taperPower + (rand() - 0.5) * 0.08;
    const waveFreq = params.waveFreq + (rand() - 0.5) * 2;
    const waveAmp = params.waveAmp + (rand() - 0.5) * 1.5;
    const jitter = params.jitter;
    const numPoints = 30;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, treeTop);

    // Right edge (top to bottom)
    for (let i = 1; i <= numPoints; i++) {
      const t = i / numPoints;
      const y = treeTop + bodyHeight * t;

      // Base width at this height (tapered)
      const baseWidth = maxWidth * Math.pow(t, taperPower);

      // Waviness decreases toward bottom for stability
      const ampScale = 0.4 + (1 - t) * 0.6;
      const wave = Math.sin(t * Math.PI * waveFreq + seed) * waveAmp * ampScale;
      const jitterVal = (rand() - 0.5) * jitter * ampScale;

      ctx.lineTo(x + baseWidth + wave + jitterVal, y);
    }

    // Bottom
    ctx.lineTo(x, bodyStart);

    // Left edge (bottom to top)
    for (let i = numPoints; i >= 1; i--) {
      const t = i / numPoints;
      const y = treeTop + bodyHeight * t;
      const baseWidth = maxWidth * Math.pow(t, taperPower);
      const ampScale = 0.4 + (1 - t) * 0.6;
      const wave = Math.sin(t * Math.PI * waveFreq + seed + 2) * waveAmp * ampScale;
      const jitterVal = (rand() - 0.5) * jitter * ampScale;

      ctx.lineTo(x - baseWidth - wave - jitterVal, y);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Whorl algorithm: structured branch layers with jagged bottom edges
   * Key insight: spruce silhouettes are built from LAYERS, with jaggedness
   * only at the BOTTOM edge of each layer, not random chaos everywhere
   */
  function drawSpruceWhorl(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient,
    seed: number,
    params: WhorlParams
  ) {
    const trunkW = width * 0.08;
    const trunkH = height * 0.05;
    const treeTop = baseY - height;
    const treeBodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Seeded random
    let localSeed = seed;
    const rand = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Draw trunk
    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 3, treeBodyStart);
    ctx.lineTo(x + trunkW / 3, treeBodyStart);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Apply parameters with per-tree variation
    const numLayers = Math.round(params.layers + (rand() - 0.5) * 3);
    const widthMultiplier = params.spread + (rand() - 0.5) * 0.08;
    const taperExponent = params.taperExponent + (rand() - 0.5) * 0.3;
    const droopStrength = params.droop + (rand() - 0.5) * 0.08;
    const jagIntensity = params.jaggedness;

    // Pre-calculate layer positions with slight irregularity
    const layerPositions: number[] = [];
    for (let i = 0; i <= numLayers; i++) {
      const baseT = i / numLayers;
      const jitter = i > 0 && i < numLayers ? (rand() - 0.5) * 0.06 : 0;
      layerPositions.push(Math.max(0, Math.min(1, baseT + jitter)));
    }

    // Build the silhouette as a single path
    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start at the apex
    ctx.moveTo(x, treeTop);

    // Build RIGHT side going DOWN (top to bottom)
    for (let layer = 0; layer < numLayers; layer++) {
      const t = layerPositions[layer + 1]!;
      const prevT = layerPositions[layer]!;

      const layerY = treeTop + bodyHeight * t;
      const prevY = treeTop + bodyHeight * prevT;

      // Width at this layer (increases toward bottom)
      const layerWidth = width * widthMultiplier * Math.pow(t, 1 / taperExponent);
      const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1 / taperExponent);

      // Droop increases toward bottom
      const droop = droopStrength * t * (layerY - prevY);

      // Slight inward curve at start of layer
      const insetFactor = 0.7 + rand() * 0.2;
      const insetX = x + prevWidth * insetFactor + rand() * 3;
      const insetY = prevY + (layerY - prevY) * (0.15 + rand() * 0.1);
      ctx.lineTo(insetX, insetY);

      // Outward to the branch tip
      const tipExtend = 1 + (rand() - 0.5) * 0.15;
      const tipX = x + layerWidth * tipExtend + (rand() - 0.5) * 5;
      const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;
      ctx.lineTo(tipX, tipY);

      // Small jagged points along the bottom edge of this layer
      const numPoints = Math.floor((1 + t * 2 + rand() * 1.5) * jagIntensity);
      for (let p = 0; p < numPoints; p++) {
        const frac = (p + 1) / (numPoints + 1);
        const ptX = tipX - (tipX - x) * frac * (0.2 + rand() * 0.08);
        const ptY = tipY + (rand() * 4 + 3) * jagIntensity + droop * 0.3;
        ctx.lineTo(ptX, ptY);

        // Small upward spike (needle cluster)
        const spikeX = ptX - (rand() * 3 + 1.5) * jagIntensity;
        const spikeY = ptY - (rand() * 4 + 2) * jagIntensity;
        ctx.lineTo(spikeX, spikeY);
      }
    }

    // Bottom right corner
    const bottomWidth = width * widthMultiplier;
    ctx.lineTo(x + bottomWidth * 0.85, treeBodyStart);

    // Across bottom (close to trunk)
    ctx.lineTo(x + trunkW * 0.6, treeBodyStart);
    ctx.lineTo(x - trunkW * 0.6, treeBodyStart);

    // Bottom left corner
    ctx.lineTo(x - bottomWidth * 0.85, treeBodyStart);

    // Build LEFT side going UP (bottom to top)
    for (let layer = numLayers - 1; layer >= 0; layer--) {
      const t = layerPositions[layer + 1]!;
      const prevT = layerPositions[layer]!;

      const layerY = treeTop + bodyHeight * t;
      const prevY = treeTop + bodyHeight * prevT;

      const layerWidth = width * widthMultiplier * Math.pow(t, 1 / taperExponent);
      const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1 / taperExponent);

      const droop = droopStrength * t * (layerY - prevY);

      // Small jagged points first (going up)
      const numPoints = Math.floor((1 + t * 2 + rand() * 1.5) * jagIntensity);
      const tipExtend = 1 + (rand() - 0.5) * 0.15;
      const tipX = x - layerWidth * tipExtend - (rand() - 0.5) * 5;
      const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;

      for (let p = numPoints - 1; p >= 0; p--) {
        const frac = (p + 1) / (numPoints + 1);
        const ptX = tipX + (x - tipX) * frac * (0.2 + rand() * 0.08);
        const ptY = tipY + (rand() * 4 + 3) * jagIntensity + droop * 0.3;

        // Spike then point
        const spikeX = ptX + (rand() * 3 + 1.5) * jagIntensity;
        const spikeY = ptY - (rand() * 4 + 2) * jagIntensity;
        ctx.lineTo(spikeX, spikeY);
        ctx.lineTo(ptX, ptY);
      }

      // Branch tip
      ctx.lineTo(tipX, tipY);

      // Inward to trunk area
      const insetFactor = 0.7 + rand() * 0.2;
      const insetX = x - prevWidth * insetFactor - rand() * 3;
      const insetY = prevY + (layerY - prevY) * (0.15 + rand() * 0.1);
      ctx.lineTo(insetX, insetY);
    }

    // Back to apex
    ctx.lineTo(x, treeTop);

    ctx.closePath();
    ctx.fill();
  }

  // Simplified versions of other tree types for the lab
  function drawPineForLab(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient
  ) {
    const trunkW = width * 0.14;
    const trunkH = height * 0.2;
    const bodyStart = baseY - trunkH;

    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.45, bodyStart);
    ctx.lineTo(x - width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x - width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x - width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x - width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x - width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x + width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x + width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x + width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x + width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x + width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x + width * 0.45, bodyStart);
    ctx.closePath();
    ctx.fill();
  }

  function drawFirForLab(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient
  ) {
    const trunkW = width * 0.12;
    const trunkH = height * 0.18;
    const bodyStart = baseY - trunkH;

    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.48, bodyStart);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.48, bodyStart);
    ctx.closePath();
    ctx.fill();
  }

  function drawOakForLab(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient
  ) {
    const trunkW = width * 0.18;
    const trunkH = height * 0.35;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.5, width * 0.48, crownHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMapleForLab(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient
  ) {
    const trunkW = width * 0.12;
    const trunkH = height * 0.3;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.45, width * 0.52, crownHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPoplarForLab(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient
  ) {
    const trunkW = width * 0.2;
    const trunkH = height * 0.25;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.5, width * 0.28, crownHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderTreeLabSamples() {
    // Render each canvas in the grid after they're mounted
    setTimeout(() => {
      if (labTreeType === "spruce") {
        // Spruce tuning mode: render 3 sample trees
        sampleSeeds.forEach((seed, i) => {
          const canvasEl = document.querySelector(`[data-spruce-index="${i}"]`) as HTMLCanvasElement;
          if (canvasEl) {
            drawTreeSample(canvasEl, seed);
          }
        });
      } else {
        // Other tree types: render original grid
        treeSamples.forEach((sample, i) => {
          const canvasEl = document.querySelector(`[data-tree-index="${i}"]`) as HTMLCanvasElement;
          if (canvasEl) {
            drawTreeSample(canvasEl, sample.seed);
          }
        });
      }
    }, 50);
  }

  function generateSpruceSVG(seed: number): string {
    const width = 150;
    const height = 225;
    const treeWidth = width * 0.6;
    const treeHeight = height * 0.85;
    const x = width / 2;
    const baseY = height * 0.95;

    const trunkW = treeWidth * 0.14;
    const trunkH = treeHeight * 0.12;
    const bodyStart = baseY - trunkH;
    const bodyHeight = treeHeight - trunkH;

    // Seeded random
    let localSeed = seed;
    const treeRandom = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Spruce shape parameters
    const baseWidthRatio = 0.38 + treeRandom() * 0.08;
    const taperPower = 1.8 + treeRandom() * 0.4;
    const bumpCount = 14 + Math.floor(treeRandom() * 8);

    // Generate edge points with organic variation
    interface EdgePoint {
      y: number;
      width: number;
    }
    const leftEdge: EdgePoint[] = [];
    const rightEdge: EdgePoint[] = [];

    for (let i = 0; i <= bumpCount; i++) {
      const t = i / bumpCount;
      const baseTaper = 1 - Math.pow(t, taperPower);
      const baseWidth = baseWidthRatio * baseTaper;

      const lowFreq = Math.sin(t * Math.PI * 2 + treeRandom() * Math.PI) * 0.03;
      const midFreq = Math.sin(t * Math.PI * 5 + treeRandom() * Math.PI * 2) * 0.02;
      const highFreq = (treeRandom() - 0.5) * 0.025;

      const variationStrength = Math.sin(t * Math.PI) * 0.8 + 0.2;
      const variation = (lowFreq + midFreq + highFreq) * variationStrength;

      const leftVar = variation + (treeRandom() - 0.5) * 0.015;
      const rightVar = variation + (treeRandom() - 0.5) * 0.015;

      const y = bodyStart - bodyHeight * t;

      leftEdge.push({ y, width: Math.max(0.02, baseWidth + leftVar) });
      rightEdge.push({ y, width: Math.max(0.02, baseWidth + rightVar) });
    }

    // Build SVG path for foliage
    let foliagePath = `M ${(x - treeWidth * leftEdge[0]!.width).toFixed(1)} ${bodyStart.toFixed(1)}`;

    for (let i = 1; i < leftEdge.length; i++) {
      const pt = leftEdge[i]!;
      foliagePath += ` L ${(x - treeWidth * pt.width).toFixed(1)} ${pt.y.toFixed(1)}`;
    }

    foliagePath += ` L ${x.toFixed(1)} ${(baseY - treeHeight).toFixed(1)}`;

    for (let i = rightEdge.length - 1; i >= 0; i--) {
      const pt = rightEdge[i]!;
      foliagePath += ` L ${(x + treeWidth * pt.width).toFixed(1)} ${pt.y.toFixed(1)}`;
    }

    foliagePath += " Z";

    // Build trunk path
    const trunkPath = `M ${(x - trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} L ${(x - trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} Z`;

    // Generate full SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#4a5568"/>
  <path d="${trunkPath}" fill="#0a0806"/>
  <path d="${foliagePath}" fill="#050a08"/>
  <!-- Seed: ${seed} | Bumps: ${bumpCount} | BaseWidth: ${baseWidthRatio.toFixed(3)} | Taper: ${taperPower.toFixed(2)} -->
</svg>`;

    return svg;
  }

  async function copySVG(seed: number) {
    if (labTreeType !== "spruce") {
      alert("SVG export currently only works for Spruce trees");
      return;
    }
    const svg = generateSpruceSVG(seed);
    await navigator.clipboard.writeText(svg);
    alert(`SVG copied for seed #${seed}`);
  }

  function setMode(newMode: LabMode) {
    mode = newMode;
    if (newMode === "treeLab") {
      if (labTreeType === "spruce") {
        // Spruce mode - render the 3 sample trees
        setTimeout(() => renderTreeLabSamples(), 50);
      } else {
        // Other modes - generate random samples
        generateTreeSamples();
        renderTreeLabSamples();
      }
    }
  }

  function getFeedbackStats() {
    const typeData = treeFeedback[labTreeType];
    return {
      approved: typeData?.approved.length ?? 0,
      rejected: typeData?.rejected.length ?? 0,
    };
  }

  // Re-render trees when samples change
  $effect(() => {
    if (mode === "treeLab" && treeSamples.length > 0) {
      renderTreeLabSamples();
    }
  });

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    cleanup();
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
      <!-- Quality Chips -->
      <ChipGroup label="Quality" variant="row">
        <ChipToggle label="High" active={quality === "high"} color="lime" onclick={() => setQuality("high")} />
        <ChipToggle label="Medium" active={quality === "medium"} color="lime" onclick={() => setQuality("medium")} />
        <ChipToggle label="Low" active={quality === "low"} color="lime" onclick={() => setQuality("low")} />
      </ChipGroup>

      <!-- Layer Chips -->
      <ChipGroup label="Layers">
        <ChipToggle label="Gradient" icon="fa-fill-drip" active={layers.gradient} color="lime" onclick={() => toggleLayer("gradient")} />
        <ChipToggle label="Stars" icon="fa-star" active={layers.stars} color="lime" onclick={() => toggleLayer("stars")} />
        <ChipToggle label="Moon" icon="fa-moon" active={layers.moon} color="lime" onclick={() => toggleLayer("moon")} />
        <ChipToggle label="Shooting Stars" icon="fa-meteor" active={layers.shootingStars} color="lime" onclick={() => toggleLayer("shootingStars")} />
        <ChipToggle label="Trees" icon="fa-tree" active={layers.trees} color="lime" onclick={() => toggleLayer("trees")} />
        <ChipToggle label="Grass" icon="fa-seedling" active={layers.grass} color="lime" onclick={() => toggleLayer("grass")} />
        <ChipToggle label="Dust Motes" icon="fa-sparkles" active={layers.ambientParticles} color="lime" onclick={() => toggleLayer("ambientParticles")} />
        <ChipToggle label="Campfire" icon="fa-fire" active={layers.campfire} color="orange" onclick={() => toggleLayer("campfire")} />
        <ChipToggle label="Fireflies" icon="fa-lightbulb" active={layers.fireflies} color="lime" onclick={() => toggleLayer("fireflies")} />
      </ChipGroup>

      <!-- Tree Type Chips -->
      <ChipGroup label="Tree Types">
        <ChipToggle label="Pine" active={treeTypes.pine} color="lime" onclick={() => toggleTreeType("pine")} />
        <ChipToggle label="Fir" active={treeTypes.fir} color="lime" onclick={() => toggleTreeType("fir")} />
        <ChipToggle label="Spruce" active={treeTypes.spruce} color="lime" onclick={() => toggleTreeType("spruce")} />
        <ChipToggle label="Oak" active={treeTypes.oak} color="lime" onclick={() => toggleTreeType("oak")} />
        <ChipToggle label="Maple" active={treeTypes.maple} color="lime" onclick={() => toggleTreeType("maple")} />
        <ChipToggle label="Poplar" active={treeTypes.poplar} color="lime" onclick={() => toggleTreeType("poplar")} />
      </ChipGroup>

      <!-- Tree Placement Sliders (Simplified) -->
      <div class="placement-section">
        <div class="section-header">
          <span class="label">Tree Placement</span>
          <button class="reset-btn" onclick={resetPlacement} title="Reset to defaults">
            <i class="fas fa-undo"></i>
          </button>
        </div>

        <div class="slider-group">
          <label class="slider-label">
            <span>Density</span>
            <span class="slider-value">{density < 0.33 ? "Sparse" : density > 0.66 ? "Dense" : "Medium"}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={density}
            oninput={(e) => updateDensity(parseFloat(e.currentTarget.value))}
          />
          <div class="slider-labels">
            <span>Sparse</span>
            <span>Dense</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">
            <span>Style</span>
            <span class="slider-value">{style < 0.33 ? "Natural" : style > 0.66 ? "Composed" : "Balanced"}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={style}
            oninput={(e) => updateStyle(parseFloat(e.currentTarget.value))}
          />
          <div class="slider-labels">
            <span>Natural</span>
            <span>Composed</span>
          </div>
        </div>
      </div>

      <!-- Regenerate -->
      <button class="action-btn" onclick={regenerate}>
        <i class="fas fa-rotate"></i>
        Regenerate
      </button>

      <!-- Stats -->
      <div class="stats-section">
        <span class="label">Scene Stats</span>
        <div class="stats-grid">
          <div class="stat">
            <span class="stat-value">{stats.fireflies}</span>
            <span class="stat-label">Fireflies</span>
          </div>
          <div class="stat">
            <span class="stat-value">{stats.stars}</span>
            <span class="stat-label">Stars</span>
          </div>
          <div class="stat">
            <span class="stat-value">{stats.ambientParticles}</span>
            <span class="stat-label">Dust Motes</span>
          </div>
          <div class="stat easter-egg-stat" class:active={stats.hasShootingStar}>
            <i class="fas fa-meteor"></i>
            <span class="stat-label">{stats.hasShootingStar ? "Shooting!" : "Waiting..."}</span>
          </div>
        </div>
      </div>
    {:else}
      <!-- Tree Lab Controls -->
      <ChipGroup label="Tree Type" variant="row">
        {#each TREE_TYPES as type}
          <ChipToggle
            label={type.charAt(0).toUpperCase() + type.slice(1)}
            active={labTreeType === type}
            color="lime"
            onclick={() => setLabTreeType(type)}
          />
        {/each}
      </ChipGroup>

      {#if labTreeType === "spruce"}
        <!-- Algorithm Selector -->
        <ChipGroup label="Algorithm" variant="row">
          <ChipToggle
            label="Whorl"
            active={spruceAlgorithm === "whorl"}
            color="lime"
            onclick={() => { spruceAlgorithm = "whorl"; renderTreeLabSamples(); }}
          />
          <ChipToggle
            label="Smooth"
            active={spruceAlgorithm === "smooth"}
            color="lime"
            onclick={() => { spruceAlgorithm = "smooth"; renderTreeLabSamples(); }}
          />
        </ChipGroup>

        <!-- Algorithm-specific Parameter Sliders -->
        <div class="params-section">
          <div class="section-header">
            <span class="label">{spruceAlgorithm === "whorl" ? "Branch Layers" : "Organic Taper"}</span>
            <button class="reset-btn" onclick={resetCurrentParams} title="Reset to defaults">
              <i class="fas fa-undo"></i>
            </button>
          </div>

          {#if spruceAlgorithm === "whorl"}
            <!-- Whorl Algorithm Parameters -->
            <div class="slider-group">
              <label class="slider-label">
                <span>Spread</span>
                <span class="slider-value">{whorlParams.spread.toFixed(2)}</span>
              </label>
              <input type="range" min="0.40" max="0.65" step="0.01" value={whorlParams.spread}
                oninput={(e) => { whorlParams.spread = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Taper</span>
                <span class="slider-value">{whorlParams.taperExponent.toFixed(1)}</span>
              </label>
              <input type="range" min="1.2" max="2.0" step="0.1" value={whorlParams.taperExponent}
                oninput={(e) => { whorlParams.taperExponent = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Columnar</span><span>Conical</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Layers</span>
                <span class="slider-value">{whorlParams.layers}</span>
              </label>
              <input type="range" min="6" max="12" step="1" value={whorlParams.layers}
                oninput={(e) => { whorlParams.layers = parseInt(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Few</span><span>Many</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Droop</span>
                <span class="slider-value">{whorlParams.droop.toFixed(2)}</span>
              </label>
              <input type="range" min="0.05" max="0.35" step="0.02" value={whorlParams.droop}
                oninput={(e) => { whorlParams.droop = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Upright</span><span>Droopy</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Jaggedness</span>
                <span class="slider-value">{whorlParams.jaggedness.toFixed(1)}</span>
              </label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={whorlParams.jaggedness}
                oninput={(e) => { whorlParams.jaggedness = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Smooth</span><span>Jagged</span></div>
            </div>

          {:else}
            <!-- Smooth Algorithm Parameters -->
            <div class="slider-group">
              <label class="slider-label">
                <span>Spread</span>
                <span class="slider-value">{smoothParams.spread.toFixed(2)}</span>
              </label>
              <input type="range" min="0.45" max="0.65" step="0.01" value={smoothParams.spread}
                oninput={(e) => { smoothParams.spread = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Taper</span>
                <span class="slider-value">{smoothParams.taperPower.toFixed(2)}</span>
              </label>
              <input type="range" min="0.45" max="0.75" step="0.02" value={smoothParams.taperPower}
                oninput={(e) => { smoothParams.taperPower = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Columnar</span><span>Conical</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Wave Frequency</span>
                <span class="slider-value">{smoothParams.waveFreq.toFixed(0)}</span>
              </label>
              <input type="range" min="4" max="10" step="1" value={smoothParams.waveFreq}
                oninput={(e) => { smoothParams.waveFreq = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Few</span><span>Many</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Wave Amplitude</span>
                <span class="slider-value">{smoothParams.waveAmp.toFixed(1)}</span>
              </label>
              <input type="range" min="2" max="8" step="0.5" value={smoothParams.waveAmp}
                oninput={(e) => { smoothParams.waveAmp = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Subtle</span><span>Strong</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Jitter</span>
                <span class="slider-value">{smoothParams.jitter.toFixed(1)}</span>
              </label>
              <input type="range" min="0" max="4" step="0.5" value={smoothParams.jitter}
                oninput={(e) => { smoothParams.jitter = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>None</span><span>Random</span></div>
            </div>
          {/if}
        </div>

        <button class="action-btn" onclick={randomizeSampleSeeds}>
          <i class="fas fa-dice"></i>
          New Random Seeds
        </button>
      {:else}
        <button class="action-btn" onclick={generateTreeSamples}>
          <i class="fas fa-rotate"></i>
          Generate New Set
        </button>

        <div class="stats-section">
          <span class="label">Feedback Stats for {labTreeType}</span>
          <div class="stats-grid">
            <div class="stat approved">
              <span class="stat-value">{getFeedbackStats().approved}</span>
              <span class="stat-label">Approved</span>
            </div>
            <div class="stat rejected">
              <span class="stat-value">{getFeedbackStats().rejected}</span>
              <span class="stat-label">Rejected</span>
            </div>
          </div>
        </div>

        <div class="legend">
          <span class="legend-item pending"><i class="fas fa-circle"></i> Pending</span>
          <span class="legend-item approved"><i class="fas fa-check-circle"></i> Approved</span>
          <span class="legend-item rejected"><i class="fas fa-times-circle"></i> Rejected</span>
        </div>

        <p class="hint">Click trees to cycle: Pending → Approved → Rejected</p>
      {/if}
    {/if}
  </div>

  {#if mode === "preview"}
    <div class="preview" onmousemove={handleMouseMove} onmouseleave={handleMouseLeave}>
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else if labTreeType === "spruce"}
    <!-- Spruce Tuning: 3 sample trees -->
    <div class="spruce-tuning-grid">
      {#each sampleSeeds as seed, i}
        <div class="spruce-sample">
          <canvas
            data-spruce-index={i}
            width="200"
            height="300"
          ></canvas>
          <span class="seed-label">Seed #{seed}</span>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Other tree types: original grid -->
    <div class="tree-lab-grid">
      {#each treeSamples as sample, i}
        <div
          class="tree-sample"
          class:approved={sample.status === "approved"}
          class:rejected={sample.status === "rejected"}
        >
          <button class="tree-canvas-btn" onclick={() => toggleTreeStatus(i)}>
            <canvas
              data-tree-index={i}
              width="150"
              height="225"
            ></canvas>
          </button>
          <div class="tree-footer">
            <span class="seed-label">#{sample.seed}</span>
            <button class="copy-svg-btn" onclick={() => copySVG(sample.seed)} title="Copy SVG">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <span class="status-icon">
            {#if sample.status === "approved"}
              <i class="fas fa-check-circle"></i>
            {:else if sample.status === "rejected"}
              <i class="fas fa-times-circle"></i>
            {:else}
              <i class="fas fa-circle"></i>
            {/if}
          </span>
        </div>
      {/each}
    </div>
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

    /* Themed scrollbar */
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

  .controls::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-accent-hover, rgba(255, 255, 255, 0.35));
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
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.3), rgba(163, 230, 53, 0.3));
    border: 1px solid rgba(163, 230, 53, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a3e635;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
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
    box-shadow: 0 8px 20px rgba(132, 204, 22, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  /* Placement Sliders Section */
  .placement-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .reset-btn {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #9ca3af;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #d1d5db;
  }

  .slider-value {
    font-family: monospace;
    font-size: 0.75rem;
    color: #a3e635;
    min-width: 36px;
    text-align: right;
  }

  .slider-hint {
    font-size: 0.65rem;
    color: #6b7280;
    margin-top: -2px;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #6b7280;
    margin-top: 2px;
  }

  .placement-section input[type="range"] {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  .placement-section input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .placement-section input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .placement-section input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #bef264;
  }

  .stat-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
  }

  .easter-egg-stat {
    flex-direction: row;
    gap: 8px;
    color: #6b7280;
  }

  .easter-egg-stat i {
    font-size: 1rem;
    opacity: 0.5;
    transition: all 0.3s ease;
  }

  .easter-egg-stat.active {
    background: rgba(250, 204, 21, 0.1);
  }

  .easter-egg-stat.active i {
    color: #facc15;
    opacity: 1;
  }

  .easter-egg-stat.active .stat-label {
    color: #facc15;
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

  /* Mode Toggle */
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

  /* Spruce Tuning Grid - 3 trees in a row */
  .spruce-tuning-grid {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding: 32px;
    background: #1a1a2e;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    height: 100%;
  }

  .spruce-sample {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
  }

  .spruce-sample canvas {
    display: block;
    border-radius: 12px;
  }

  .spruce-sample .seed-label {
    font-size: 0.75rem;
    font-family: monospace;
    color: #9ca3af;
  }

  /* Params Section */
  .params-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .params-section .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .params-section .label {
    font-size: 0.8rem;
    font-weight: 500;
    color: #a3e635;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Tree Lab Grid */
  .tree-lab-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    background: #1a1a2e;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    align-content: flex-start;
  }

  .tree-sample {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 2px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: calc(25% - 9px);
    box-sizing: border-box;
  }

  .tree-sample:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  .tree-sample.approved {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.08);
  }

  .tree-sample.rejected {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.08);
  }

  .tree-canvas-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .tree-canvas-btn canvas {
    display: block;
    border-radius: 8px;
  }

  .tree-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 6px;
    gap: 8px;
  }

  .seed-label {
    font-size: 0.65rem;
    font-family: monospace;
    color: #6b7280;
  }

  .copy-svg-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: #9ca3af;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-svg-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .status-icon {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .tree-sample:not(.approved):not(.rejected) .status-icon {
    color: #6b7280;
  }

  .tree-sample.approved .status-icon {
    color: #22c55e;
  }

  .tree-sample.rejected .status-icon {
    color: #ef4444;
  }

  /* Legend */
  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
  }

  .legend-item.pending {
    color: #6b7280;
  }

  .legend-item.approved {
    color: #22c55e;
  }

  .legend-item.rejected {
    color: #ef4444;
  }

  .hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  /* Stats overrides for Tree Lab */
  .stat.approved {
    background: rgba(34, 197, 94, 0.1);
  }

  .stat.approved .stat-value {
    color: #22c55e;
  }

  .stat.rejected {
    background: rgba(239, 68, 68, 0.1);
  }

  .stat.rejected .stat-value {
    color: #ef4444;
  }

  @media (max-width: 900px) {
    .firefly-forest-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }

    .tree-sample {
      width: calc(50% - 6px);
    }
  }
</style>
