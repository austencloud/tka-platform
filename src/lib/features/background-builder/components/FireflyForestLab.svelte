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
  type SpruceAlgorithm = "noise" | "tiered" | "recursive";
  let spruceAlgorithm = $state<SpruceAlgorithm>("noise");

  // Algorithm 1: Organic Noise - tapered cone with multi-frequency noise
  interface NoiseParams {
    baseWidth: number;    // 0.25-0.55 - width at bottom
    taper: number;        // 1.2-3.5 - how quickly it narrows
    spikiness: number;    // 0-0.15 - edge variation amplitude
    detail: number;       // 8-30 - number of edge points
    asymmetry: number;    // 0-0.04 - left/right difference
  }

  // Algorithm 2: Tiered Branches - structured drooping branch layers
  interface TieredParams {
    baseWidth: number;    // 0.3-0.5 - width at bottom
    tiers: number;        // 4-12 - number of branch tiers
    droop: number;        // 0-0.4 - how much branches droop down
    tierSpacing: number;  // 0.5-1.5 - regularity of tier spacing (1 = even)
    branchWidth: number;  // 0.3-0.8 - how wide branches extend
    gnarliness: number;   // 0-0.1 - twist/curl of branches
  }

  // Algorithm 3: Recursive/L-System - fractal branching
  interface RecursiveParams {
    trunkLength: number;  // 0.3-0.6 - initial trunk length ratio
    branchAngle: number;  // 15-45 - angle of child branches (degrees)
    branchRatio: number;  // 0.6-0.85 - length ratio of child to parent
    levels: number;       // 3-7 - recursion depth
    spread: number;       // 0.5-1.5 - how much branches spread out
    randomness: number;   // 0-0.3 - variation in angles/lengths
  }

  let noiseParams = $state<NoiseParams>({
    baseWidth: 0.42,
    taper: 2.0,
    spikiness: 0.05,
    detail: 18,
    asymmetry: 0.015,
  });

  let tieredParams = $state<TieredParams>({
    baseWidth: 0.4,
    tiers: 7,
    droop: 0.15,
    tierSpacing: 1.0,
    branchWidth: 0.6,
    gnarliness: 0.03,
  });

  let recursiveParams = $state<RecursiveParams>({
    trunkLength: 0.45,
    branchAngle: 25,
    branchRatio: 0.72,
    levels: 5,
    spread: 1.0,
    randomness: 0.15,
  });

  // Legacy alias for compatibility
  let spruceParams = $derived(noiseParams);

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

  function resetNoiseParams() {
    noiseParams = {
      baseWidth: 0.42,
      taper: 2.0,
      spikiness: 0.05,
      detail: 18,
      asymmetry: 0.015,
    };
    renderTreeLabSamples();
  }

  function resetTieredParams() {
    tieredParams = {
      baseWidth: 0.4,
      tiers: 7,
      droop: 0.15,
      tierSpacing: 1.0,
      branchWidth: 0.6,
      gnarliness: 0.03,
    };
    renderTreeLabSamples();
  }

  function resetRecursiveParams() {
    recursiveParams = {
      trunkLength: 0.45,
      branchAngle: 25,
      branchRatio: 0.72,
      levels: 5,
      spread: 1.0,
      randomness: 0.15,
    };
    renderTreeLabSamples();
  }

  function resetCurrentParams() {
    if (spruceAlgorithm === "noise") resetNoiseParams();
    else if (spruceAlgorithm === "tiered") resetTieredParams();
    else resetRecursiveParams();
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
        if (spruceAlgorithm === "noise") {
          drawSpruceNoise(ctx, x, baseY, width, height, trunkColor, gradient, seed, noiseParams);
        } else if (spruceAlgorithm === "tiered") {
          drawSpruceTiered(ctx, x, baseY, width, height, trunkColor, gradient, seed, tieredParams);
        } else {
          drawSpruceRecursive(ctx, x, baseY, width, height, trunkColor, gradient, seed, recursiveParams);
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

  function drawSpruceNoise(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient,
    seed: number,
    params: NoiseParams
  ) {
    const trunkW = width * 0.14;
    const trunkH = height * 0.12;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Draw trunk
    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Seeded random for this tree
    let localSeed = seed;
    const treeRandom = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Use tunable parameters with small random variation for each tree
    const baseWidthRatio = params.baseWidth + (treeRandom() - 0.5) * 0.04;
    const taperPower = params.taper + (treeRandom() - 0.5) * 0.2;
    const bumpCount = Math.round(params.detail + (treeRandom() - 0.5) * 4);
    const spikinessBase = params.spikiness;
    const asymmetryBase = params.asymmetry;

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

      // Spikiness controls the amplitude of edge variation
      const lowFreq = Math.sin(t * Math.PI * 2 + treeRandom() * Math.PI) * spikinessBase * 0.6;
      const midFreq = Math.sin(t * Math.PI * 5 + treeRandom() * Math.PI * 2) * spikinessBase * 0.4;
      const highFreq = (treeRandom() - 0.5) * spikinessBase * 0.5;

      const variationStrength = Math.sin(t * Math.PI) * 0.8 + 0.2;
      const variation = (lowFreq + midFreq + highFreq) * variationStrength;

      // Asymmetry controls left/right difference
      const leftVar = variation + (treeRandom() - 0.5) * asymmetryBase;
      const rightVar = variation + (treeRandom() - 0.5) * asymmetryBase;

      const y = bodyStart - bodyHeight * t;

      leftEdge.push({ y, width: Math.max(0.02, baseWidth + leftVar) });
      rightEdge.push({ y, width: Math.max(0.02, baseWidth + rightVar) });
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * leftEdge[0]!.width, bodyStart);

    for (let i = 1; i < leftEdge.length; i++) {
      const pt = leftEdge[i]!;
      ctx.lineTo(x - width * pt.width, pt.y);
    }

    ctx.lineTo(x, baseY - height);

    for (let i = rightEdge.length - 1; i >= 0; i--) {
      const pt = rightEdge[i]!;
      ctx.lineTo(x + width * pt.width, pt.y);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Algorithm 2: Tiered Skirts
   * Creates a spruce with overlapping triangular "skirts" - like stacked triangles
   * getting smaller toward the top. Classic Christmas tree silhouette.
   */
  function drawSpruceTiered(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient,
    seed: number,
    params: TieredParams
  ) {
    const trunkW = width * 0.14;
    const trunkH = height * 0.10;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Draw trunk
    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, bodyStart);
    ctx.lineTo(x + trunkW / 2, bodyStart);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Seeded random
    let localSeed = seed;
    const treeRandom = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Per-tree variation
    const tierCount = Math.round(params.tiers + (treeRandom() - 0.5) * 2);
    const baseWidthRatio = params.baseWidth + (treeRandom() - 0.5) * 0.04;
    const droopFactor = params.droop;
    const branchExtend = params.branchWidth;
    const gnarliness = params.gnarliness;

    ctx.fillStyle = gradient;

    // Draw overlapping triangular skirts from bottom to top
    for (let tier = 0; tier < tierCount; tier++) {
      const t = tier / tierCount;
      const nextT = (tier + 1) / tierCount;

      // Tier spacing - where this skirt starts and where the next one starts
      const spacingPow = params.tierSpacing;
      const tierStartY = bodyStart - bodyHeight * Math.pow(t, spacingPow);
      const tierPeakY = bodyStart - bodyHeight * Math.pow(nextT, spacingPow) * 0.85; // Peak slightly below next tier

      // Width at this tier (tapers toward top)
      const tierWidth = width * baseWidthRatio * (1 - t * 0.75) * branchExtend;

      // Random variations for this tier
      const leftVar = (treeRandom() - 0.5) * gnarliness * width;
      const rightVar = (treeRandom() - 0.5) * gnarliness * width;
      const peakVar = (treeRandom() - 0.5) * gnarliness * width * 0.3;

      // Droop affects where the skirt bottom sits
      const droopY = droopFactor * (1 - t) * bodyHeight * 0.04;

      // Draw this tier's triangular skirt
      ctx.beginPath();
      // Left corner (droops down)
      ctx.moveTo(x - tierWidth + leftVar, tierStartY + droopY);
      // Peak of this tier
      ctx.lineTo(x + peakVar, tierPeakY);
      // Right corner (droops down)
      ctx.lineTo(x + tierWidth + rightVar, tierStartY + droopY);
      ctx.closePath();
      ctx.fill();
    }

    // Final apex triangle
    const topStartY = bodyStart - bodyHeight * Math.pow((tierCount - 1) / tierCount, params.tierSpacing);
    const apexWidth = width * baseWidthRatio * 0.25 * branchExtend;
    ctx.beginPath();
    ctx.moveTo(x - apexWidth, topStartY);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + apexWidth, topStartY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Algorithm 3: Jagged Fractal
   * Creates a spruce with fractal-like jagged edges that look like visible branch tips.
   * Each "level" adds smaller protrusions to the silhouette.
   */
  function drawSpruceRecursive(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    trunkColor: { r: number; g: number; b: number },
    gradient: CanvasGradient,
    seed: number,
    params: RecursiveParams
  ) {
    const trunkW = width * 0.14;
    const trunkH = height * 0.10;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    // Draw trunk
    ctx.fillStyle = `rgb(${trunkColor.r}, ${trunkColor.g}, ${trunkColor.b})`;
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, bodyStart);
    ctx.lineTo(x + trunkW / 2, bodyStart);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Seeded random
    let localSeed = seed;
    const treeRandom = (): number => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };

    // Build edge points with recursive jagged detail
    const leftEdge: Array<{ x: number; y: number }> = [];
    const rightEdge: Array<{ x: number; y: number }> = [];

    // Base silhouette parameters
    const baseWidthRatio = 0.42 + (treeRandom() - 0.5) * 0.06;
    const taperPower = 1.8 + params.trunkLength; // Use trunkLength to control overall shape

    // Number of base points
    const basePoints = 12 + Math.round(params.levels * 2);

    // Generate base silhouette
    for (let i = 0; i <= basePoints; i++) {
      const t = i / basePoints;
      const y = bodyStart - bodyHeight * t;

      // Base taper
      const baseTaper = 1 - Math.pow(t, taperPower);
      const baseWidth = baseWidthRatio * baseTaper * width * params.spread;

      leftEdge.push({ x: x - baseWidth, y });
      rightEdge.push({ x: x + baseWidth, y });
    }

    // Add jagged detail recursively
    function addJaggedDetail(
      edge: Array<{ x: number; y: number }>,
      level: number,
      isLeft: boolean
    ): Array<{ x: number; y: number }> {
      if (level >= params.levels) return edge;

      const newEdge: Array<{ x: number; y: number }> = [];
      const jagSize = params.branchRatio * (0.15 / (level + 1)); // Decreasing jag size
      const angleSpread = (params.branchAngle / 45) * 0.5; // Convert angle to radial factor

      for (let i = 0; i < edge.length - 1; i++) {
        const p1 = edge[i]!;
        const p2 = edge[i + 1]!;

        newEdge.push(p1);

        // Add jagged protrusion between points
        const midY = (p1.y + p2.y) / 2;
        const midX = (p1.x + p2.x) / 2;

        // Height-based scaling (more pronounced at bottom)
        const heightFactor = 1 - (bodyStart - midY) / bodyHeight;
        const jagAmount = jagSize * width * heightFactor * (0.7 + treeRandom() * 0.6);

        // Direction of protrusion (outward)
        const outwardX = isLeft ? -jagAmount : jagAmount;

        // Add randomness
        const randY = (treeRandom() - 0.5) * params.randomness * (p2.y - p1.y) * 0.5;

        // Protrusion point
        const protX = midX + outwardX * angleSpread;
        const protY = midY + randY;

        // Only add if it's actually pointing outward
        if ((isLeft && protX < midX) || (!isLeft && protX > midX)) {
          newEdge.push({ x: protX, y: protY });
        }
      }
      newEdge.push(edge[edge.length - 1]!);

      // Recurse for more detail
      return addJaggedDetail(newEdge, level + 1, isLeft);
    }

    // Apply jagged detail
    const jaggedLeft = addJaggedDetail(leftEdge, 0, true);
    const jaggedRight = addJaggedDetail(rightEdge, 0, false);

    // Draw the complete silhouette
    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start at bottom left
    ctx.moveTo(jaggedLeft[0]!.x, jaggedLeft[0]!.y);

    // Left edge (bottom to top)
    for (let i = 1; i < jaggedLeft.length; i++) {
      ctx.lineTo(jaggedLeft[i]!.x, jaggedLeft[i]!.y);
    }

    // Apex
    ctx.lineTo(x, baseY - height);

    // Right edge (top to bottom)
    for (let i = jaggedRight.length - 1; i >= 0; i--) {
      ctx.lineTo(jaggedRight[i]!.x, jaggedRight[i]!.y);
    }

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
            label="Smooth"
            active={spruceAlgorithm === "noise"}
            color="lime"
            onclick={() => { spruceAlgorithm = "noise"; renderTreeLabSamples(); }}
          />
          <ChipToggle
            label="Layered"
            active={spruceAlgorithm === "tiered"}
            color="lime"
            onclick={() => { spruceAlgorithm = "tiered"; renderTreeLabSamples(); }}
          />
          <ChipToggle
            label="Jagged"
            active={spruceAlgorithm === "recursive"}
            color="lime"
            onclick={() => { spruceAlgorithm = "recursive"; renderTreeLabSamples(); }}
          />
        </ChipGroup>

        <!-- Algorithm-specific Parameter Sliders -->
        <div class="params-section">
          <div class="section-header">
            <span class="label">{spruceAlgorithm === "noise" ? "Smooth Taper" : spruceAlgorithm === "tiered" ? "Layered Skirts" : "Jagged Fractal"}</span>
            <button class="reset-btn" onclick={resetCurrentParams} title="Reset to defaults">
              <i class="fas fa-undo"></i>
            </button>
          </div>

          {#if spruceAlgorithm === "noise"}
            <!-- Noise Algorithm Parameters -->
            <div class="slider-group">
              <label class="slider-label">
                <span>Base Width</span>
                <span class="slider-value">{noiseParams.baseWidth.toFixed(2)}</span>
              </label>
              <input type="range" min="0.25" max="0.55" step="0.01" value={noiseParams.baseWidth}
                oninput={(e) => { noiseParams.baseWidth = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Taper</span>
                <span class="slider-value">{noiseParams.taper.toFixed(1)}</span>
              </label>
              <input type="range" min="1.2" max="3.5" step="0.1" value={noiseParams.taper}
                oninput={(e) => { noiseParams.taper = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Columnar</span><span>Conical</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Spikiness</span>
                <span class="slider-value">{noiseParams.spikiness.toFixed(2)}</span>
              </label>
              <input type="range" min="0" max="0.15" step="0.005" value={noiseParams.spikiness}
                oninput={(e) => { noiseParams.spikiness = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Smooth</span><span>Spiky</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Detail</span>
                <span class="slider-value">{Math.round(noiseParams.detail)}</span>
              </label>
              <input type="range" min="8" max="30" step="1" value={noiseParams.detail}
                oninput={(e) => { noiseParams.detail = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Low</span><span>High</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Asymmetry</span>
                <span class="slider-value">{noiseParams.asymmetry.toFixed(3)}</span>
              </label>
              <input type="range" min="0" max="0.04" step="0.002" value={noiseParams.asymmetry}
                oninput={(e) => { noiseParams.asymmetry = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Symmetric</span><span>Varied</span></div>
            </div>

          {:else if spruceAlgorithm === "tiered"}
            <!-- Tiered Algorithm Parameters -->
            <div class="slider-group">
              <label class="slider-label">
                <span>Base Width</span>
                <span class="slider-value">{tieredParams.baseWidth.toFixed(2)}</span>
              </label>
              <input type="range" min="0.3" max="0.5" step="0.01" value={tieredParams.baseWidth}
                oninput={(e) => { tieredParams.baseWidth = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Tiers</span>
                <span class="slider-value">{tieredParams.tiers}</span>
              </label>
              <input type="range" min="4" max="12" step="1" value={tieredParams.tiers}
                oninput={(e) => { tieredParams.tiers = parseInt(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Few</span><span>Many</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Droop</span>
                <span class="slider-value">{tieredParams.droop.toFixed(2)}</span>
              </label>
              <input type="range" min="0" max="0.4" step="0.02" value={tieredParams.droop}
                oninput={(e) => { tieredParams.droop = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Upright</span><span>Droopy</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Tier Spacing</span>
                <span class="slider-value">{tieredParams.tierSpacing.toFixed(1)}</span>
              </label>
              <input type="range" min="0.5" max="1.5" step="0.1" value={tieredParams.tierSpacing}
                oninput={(e) => { tieredParams.tierSpacing = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Clustered</span><span>Even</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Branch Width</span>
                <span class="slider-value">{tieredParams.branchWidth.toFixed(1)}</span>
              </label>
              <input type="range" min="0.3" max="0.8" step="0.05" value={tieredParams.branchWidth}
                oninput={(e) => { tieredParams.branchWidth = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Compact</span><span>Spread</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Gnarliness</span>
                <span class="slider-value">{tieredParams.gnarliness.toFixed(2)}</span>
              </label>
              <input type="range" min="0" max="0.1" step="0.005" value={tieredParams.gnarliness}
                oninput={(e) => { tieredParams.gnarliness = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Straight</span><span>Twisted</span></div>
            </div>

          {:else}
            <!-- Recursive Algorithm Parameters -->
            <div class="slider-group">
              <label class="slider-label">
                <span>Trunk Length</span>
                <span class="slider-value">{recursiveParams.trunkLength.toFixed(2)}</span>
              </label>
              <input type="range" min="0.3" max="0.6" step="0.02" value={recursiveParams.trunkLength}
                oninput={(e) => { recursiveParams.trunkLength = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Short</span><span>Tall</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Branch Angle</span>
                <span class="slider-value">{recursiveParams.branchAngle}°</span>
              </label>
              <input type="range" min="15" max="45" step="1" value={recursiveParams.branchAngle}
                oninput={(e) => { recursiveParams.branchAngle = parseInt(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Branch Ratio</span>
                <span class="slider-value">{recursiveParams.branchRatio.toFixed(2)}</span>
              </label>
              <input type="range" min="0.6" max="0.85" step="0.01" value={recursiveParams.branchRatio}
                oninput={(e) => { recursiveParams.branchRatio = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Short</span><span>Long</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Levels</span>
                <span class="slider-value">{recursiveParams.levels}</span>
              </label>
              <input type="range" min="3" max="7" step="1" value={recursiveParams.levels}
                oninput={(e) => { recursiveParams.levels = parseInt(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Simple</span><span>Complex</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Spread</span>
                <span class="slider-value">{recursiveParams.spread.toFixed(1)}</span>
              </label>
              <input type="range" min="0.5" max="1.5" step="0.1" value={recursiveParams.spread}
                oninput={(e) => { recursiveParams.spread = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Tight</span><span>Spread</span></div>
            </div>

            <div class="slider-group">
              <label class="slider-label">
                <span>Randomness</span>
                <span class="slider-value">{recursiveParams.randomness.toFixed(2)}</span>
              </label>
              <input type="range" min="0" max="0.3" step="0.02" value={recursiveParams.randomness}
                oninput={(e) => { recursiveParams.randomness = parseFloat(e.currentTarget.value); renderTreeLabSamples(); }} />
              <div class="slider-labels"><span>Regular</span><span>Random</span></div>
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
