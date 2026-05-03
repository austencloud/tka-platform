<script lang="ts">
  import { onMount } from "svelte";
  import type { FishMarineLife, FishSpecies, FinState, TailState, FishColorPalette } from "@austencloud/backgrounds";
import {  } from "@austencloud/backgrounds";

  let staticCanvas: HTMLCanvasElement;
  let animatedCanvas: HTMLCanvasElement;
  let animationId: number | undefined;

  // Species configurations (copied from FishAnimator for standalone rendering)
  const SPECIES_CONFIG: Record<
    FishSpecies,
    {
      bodyAspect: [number, number];
      bodyLength: [number, number];
      finScale: number;
      tailForkDepth: [number, number];
      hasLargeFins: boolean;
      hasBioluminescence: boolean;
      eyeSize: [number, number];
      colors: FishColorPalette[];
    }
  > = {
    tropical: {
      bodyAspect: [2.0, 2.5],
      bodyLength: [60, 90],
      finScale: 1.3,
      tailForkDepth: [0.2, 0.4],
      hasLargeFins: true,
      hasBioluminescence: false,
      eyeSize: [0.12, 0.16],
      colors: [
        {
          bodyTop: "#ff7b54",
          bodyBottom: "#ffe5b4",
          accent: "#fff44f",
          eye: "#2c1810",
          finTint: "rgba(255, 165, 0, 0.6)",
        },
        {
          bodyTop: "#4169e1",
          bodyBottom: "#87ceeb",
          accent: "#ffd700",
          eye: "#1a1a2e",
          finTint: "rgba(65, 105, 225, 0.5)",
        },
        {
          bodyTop: "#9b59b6",
          bodyBottom: "#d7bde2",
          accent: "#f1c40f",
          eye: "#2c1320",
          finTint: "rgba(155, 89, 182, 0.5)",
        },
      ],
    },
    sleek: {
      bodyAspect: [3.5, 4.5],
      bodyLength: [80, 120],
      finScale: 0.7,
      tailForkDepth: [0.5, 0.7],
      hasLargeFins: false,
      hasBioluminescence: false,
      eyeSize: [0.08, 0.1],
      colors: [
        {
          bodyTop: "#2c3e50",
          bodyBottom: "#bdc3c7",
          accent: "#7f8c8d",
          eye: "#1a1a1a",
          finTint: "rgba(127, 140, 141, 0.4)",
        },
        {
          bodyTop: "#1e4d6b",
          bodyBottom: "#a8d8ea",
          accent: "#3498db",
          eye: "#0d1f2d",
          finTint: "rgba(52, 152, 219, 0.4)",
        },
      ],
    },
    deep: {
      bodyAspect: [2.2, 2.8],
      bodyLength: [50, 80],
      finScale: 0.9,
      tailForkDepth: [0.1, 0.3],
      hasLargeFins: false,
      hasBioluminescence: true,
      eyeSize: [0.18, 0.24],
      colors: [
        {
          bodyTop: "#1a1a2e",
          bodyBottom: "#2d2d44",
          accent: "#00fff7",
          eye: "#00fff7",
          finTint: "rgba(0, 255, 247, 0.3)",
        },
        {
          bodyTop: "#0f0f23",
          bodyBottom: "#1e1e3f",
          accent: "#7b68ee",
          eye: "#9370db",
          finTint: "rgba(123, 104, 238, 0.3)",
        },
      ],
    },
    schooling: {
      bodyAspect: [2.5, 3.0],
      bodyLength: [35, 55],
      finScale: 0.8,
      tailForkDepth: [0.3, 0.5],
      hasLargeFins: false,
      hasBioluminescence: false,
      eyeSize: [0.1, 0.12],
      colors: [
        {
          bodyTop: "#5dade2",
          bodyBottom: "#d4e6f1",
          accent: "#aed6f1",
          eye: "#1b4f72",
          finTint: "rgba(93, 173, 226, 0.4)",
        },
        {
          bodyTop: "#45b39d",
          bodyBottom: "#d1f2eb",
          accent: "#a3e4d7",
          eye: "#145a32",
          finTint: "rgba(69, 179, 157, 0.4)",
        },
      ],
    },
  };

  const SPECIES_SHAPE: Record<
    FishSpecies,
    {
      dorsalMod: number;
      ventralMod: number;
      noseTaper: number;
      tailTaper: number;
    }
  > = {
    tropical: { dorsalMod: 1.2, ventralMod: 1.1, noseTaper: 0.8, tailTaper: 0.7 },
    sleek: { dorsalMod: 0.7, ventralMod: 0.6, noseTaper: 1.3, tailTaper: 1.2 },
    deep: { dorsalMod: 1.0, ventralMod: 1.1, noseTaper: 0.9, tailTaper: 0.8 },
    schooling: { dorsalMod: 0.9, ventralMod: 0.85, noseTaper: 1.0, tailTaper: 0.9 },
  };

  const RENDER_CONFIG = {
    bodyShape: {
      dorsalControlPoints: [
        { x: -0.5, y: 0 },
        { x: -0.3, y: -0.4 },
        { x: 0.0, y: -0.5 },
        { x: 0.3, y: -0.3 },
        { x: 0.45, y: -0.1 },
      ],
      ventralControlPoints: [
        { x: -0.5, y: 0 },
        { x: -0.3, y: 0.25 },
        { x: 0.0, y: 0.4 },
        { x: 0.3, y: 0.25 },
        { x: 0.45, y: 0.1 },
      ],
    },
    eye: {
      xOffset: -0.32,
      yOffset: -0.1,
      pupilSize: 0.4,
      highlightSize: 0.2,
      highlightOffset: { x: -0.2, y: -0.25 },
    },
    fins: {
      dorsal: { x: -0.05, y: -0.5 },
      pectoralTop: { x: -0.15, y: -0.15 },
      pectoralBottom: { x: -0.1, y: 0.2 },
      pelvic: { x: 0.1, y: 0.35 },
      anal: { x: 0.25, y: 0.35 },
      tail: { x: 0.45, y: 0 },
    },
    glow: {
      spotCount: 5,
      spotSize: [0.02, 0.05] as [number, number],
      colors: ["#00fff7", "#7b68ee", "#00ced1"],
    },
  };

  function randomInRange(range: [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  function createFinState(length: number, width: number): FinState {
    return { angle: 0, velocity: 0, targetAngle: 0, length, width, segments: 5 };
  }

  function createTailState(length: number, width: number, forkDepth: number): TailState {
    return {
      angle: 0,
      velocity: 0,
      targetAngle: 0,
      length,
      width,
      segments: 7,
      forkAngle: 0.3 + Math.random() * 0.2,
      forkDepth,
      wavePhase: 0,
      waveAmplitude: 0.25,
    };
  }

  function createFish(species: FishSpecies, colorIndex: number, scale: number = 1): FishMarineLife {
    const speciesConfig = SPECIES_CONFIG[species];
    const bodyLength = randomInRange(speciesConfig.bodyLength) * scale;
    const bodyAspect = randomInRange(speciesConfig.bodyAspect);
    const bodyHeight = bodyLength / bodyAspect;
    const colors = speciesConfig.colors[colorIndex % speciesConfig.colors.length]!;
    const finScale = speciesConfig.finScale;

    return {
      type: "fish",
      species,
      colors,
      bodyLength,
      bodyHeight,
      bodyAspect,
      x: 0,
      y: 0,
      z: 0.5,
      targetZ: 0.5,
      baseY: 0,
      direction: 1,
      speed: 15,
      baseSpeed: 15,
      verticalDrift: 0,
      bobAmplitude: 3,
      bobSpeed: 0.01,
      depthBand: { min: 0, max: 100 },
      depthLayer: "mid",
      depthScale: scale,
      behavior: "cruising",
      behaviorTimer: 10,
      rotation: 0,
      bodyFlexPhase: 0,
      bodyFlexAmount: 0,
      dorsalFin: createFinState(0.35 * finScale, 0.2 * finScale),
      pectoralFinTop: createFinState(0.25 * finScale, 0.15 * finScale),
      pectoralFinBottom: createFinState(0.2 * finScale, 0.12 * finScale),
      pelvicFin: createFinState(0.15 * finScale, 0.1 * finScale),
      analFin: createFinState(0.18 * finScale, 0.1 * finScale),
      tailFin: createTailState(0.4 * finScale, 0.3 * finScale, randomInRange(speciesConfig.tailForkDepth)),
      opacity: 1,
      animationPhase: 0,
      scalePhase: 0,
      scaleSpeed: 0.01,
      eyeSize: randomInRange(speciesConfig.eyeSize),
      gillPhase: 0,
      gillSpeed: 0.03,
      hasBioluminescence: speciesConfig.hasBioluminescence,
      glowPhase: 0,
      glowIntensity: speciesConfig.hasBioluminescence ? 0.6 : 0,
      wakeTrail: [],
      lastWakeSpawn: 0,
      width: bodyLength,
      height: bodyHeight,
      tailPhase: 0,
    };
  }

  // Drawing functions
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
      const match = hex.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (match) return { r: parseInt(match[1]!), g: parseInt(match[2]!), b: parseInt(match[3]!) };
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1]!, 16), g: parseInt(result[2]!, 16), b: parseInt(result[3]!, 16) }
      : { r: 100, g: 150, b: 200 };
  }

  function adjustAlpha(color: string, alpha: number): string {
    if (color.startsWith("rgba")) return color.replace(/[\d.]+\)$/, `${alpha})`);
    const rgb = hexToRgb(color);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function adjustBrightness(color: string, amount: number): string {
    const rgb = hexToRgb(color);
    return `rgb(${Math.max(0, Math.min(255, rgb.r + amount))}, ${Math.max(0, Math.min(255, rgb.g + amount))}, ${Math.max(0, Math.min(255, rgb.b + amount))})`;
  }

  function blendColors(c1: string, c2: string, ratio: number): string {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return `rgb(${Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio)}, ${Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio)}, ${Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio)})`;
  }

  function drawFish(ctx: CanvasRenderingContext2D, fish: FishMarineLife, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    // Fish faces right (positive X) - no flip needed for static display

    const len = fish.bodyLength;
    const height = fish.bodyHeight;
    const shape = SPECIES_SHAPE[fish.species];
    const colors = fish.colors;

    // Draw bioluminescence glow first (behind body)
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      const glowRadius = Math.max(len, height) * 0.8;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      const rgb = hexToRgb(colors.accent);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.3})`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.1})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw tail fin first (behind body)
    drawTailFin(ctx, fish, len, height);

    // Draw body
    ctx.beginPath();
    const dorsalPoints = RENDER_CONFIG.bodyShape.dorsalControlPoints.map(p => ({
      x: p.x * len,
      y: p.y * height * shape.dorsalMod,
    }));
    const ventralPoints = RENDER_CONFIG.bodyShape.ventralControlPoints.map(p => ({
      x: p.x * len,
      y: p.y * height * shape.ventralMod,
    }));

    ctx.moveTo(dorsalPoints[0]!.x, dorsalPoints[0]!.y);
    for (let i = 1; i < dorsalPoints.length; i++) {
      const prev = dorsalPoints[i - 1]!;
      const curr = dorsalPoints[i]!;
      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
    }
    ctx.lineTo(dorsalPoints[dorsalPoints.length - 1]!.x, dorsalPoints[dorsalPoints.length - 1]!.y);

    for (let i = ventralPoints.length - 1; i >= 0; i--) {
      const curr = ventralPoints[i]!;
      const next = i > 0 ? ventralPoints[i - 1]! : curr;
      ctx.quadraticCurveTo(curr.x - (curr.x - next.x) * 0.5, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
    }
    ctx.closePath();

    const bodyGradient = ctx.createLinearGradient(0, -height * 0.5, 0, height * 0.5);
    bodyGradient.addColorStop(0, colors.bodyTop);
    bodyGradient.addColorStop(0.4, blendColors(colors.bodyTop, colors.bodyBottom, 0.3));
    bodyGradient.addColorStop(1, colors.bodyBottom);
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = adjustAlpha(colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw other fins
    drawFin(ctx, fish.pelvicFin, RENDER_CONFIG.fins.pelvic.x * len, RENDER_CONFIG.fins.pelvic.y * height, len, height, colors, "down");
    drawFin(ctx, fish.analFin, RENDER_CONFIG.fins.anal.x * len, RENDER_CONFIG.fins.anal.y * height, len, height, colors, "down");
    drawFin(ctx, fish.pectoralFinTop, RENDER_CONFIG.fins.pectoralTop.x * len, RENDER_CONFIG.fins.pectoralTop.y * height, len, height, colors, "up-back");
    drawFin(ctx, fish.pectoralFinBottom, RENDER_CONFIG.fins.pectoralBottom.x * len, RENDER_CONFIG.fins.pectoralBottom.y * height, len, height, colors, "down-back");
    drawFin(ctx, fish.dorsalFin, RENDER_CONFIG.fins.dorsal.x * len, RENDER_CONFIG.fins.dorsal.y * height, len, height, colors, "up");

    // Draw eye
    drawEye(ctx, fish, len, height);

    // Draw gill
    drawGill(ctx, fish, len, height);

    // Draw bioluminescence spots
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      drawGlowSpots(ctx, fish, len, height);
    }

    ctx.restore();
  }

  function drawFin(ctx: CanvasRenderingContext2D, fin: FinState, attachX: number, attachY: number, len: number, height: number, colors: FishColorPalette, direction: string) {
    const finLen = fin.length * len;
    const finWidth = fin.width * height;

    ctx.save();
    ctx.translate(attachX, attachY);
    ctx.rotate(fin.angle);

    let baseAngle = 0;
    if (direction === "up") baseAngle = -Math.PI / 2;
    else if (direction === "down") baseAngle = Math.PI / 2;
    else if (direction === "up-back") baseAngle = -Math.PI / 3;
    else if (direction === "down-back") baseAngle = Math.PI / 3;
    ctx.rotate(baseAngle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(finLen * 0.3, -finWidth * 0.3, finLen, 0);
    ctx.quadraticCurveTo(finLen * 0.6, finWidth * 0.4, 0, finWidth * 0.1);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, finLen, 0);
    gradient.addColorStop(0, colors.finTint);
    gradient.addColorStop(1, adjustAlpha(colors.finTint, 0.2));
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = adjustAlpha(colors.accent, 0.2);
    ctx.lineWidth = 0.5;
    for (let i = 1; i < fin.segments; i++) {
      const t = i / fin.segments;
      ctx.beginPath();
      ctx.moveTo(0, finWidth * 0.05 * t);
      ctx.lineTo(finLen * (1 - t * 0.3), 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawTailFin(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number) {
    const tail = fish.tailFin;
    const tailLen = tail.length * len;
    const tailWidth = tail.width * height;
    const colors = fish.colors;

    ctx.save();
    ctx.translate(RENDER_CONFIG.fins.tail.x * len, RENDER_CONFIG.fins.tail.y * height);
    ctx.rotate(tail.angle);

    const forkDepth = tail.forkDepth * tailLen;
    const forkSpread = tail.forkAngle;

    ctx.beginPath();
    ctx.moveTo(0, -tailWidth * 0.1);
    ctx.quadraticCurveTo(tailLen * 0.4, -tailWidth * 0.2 - forkSpread * tailWidth, tailLen, -tailWidth * forkSpread);
    ctx.quadraticCurveTo(tailLen - forkDepth, 0, tailLen, tailWidth * forkSpread);
    ctx.quadraticCurveTo(tailLen * 0.4, tailWidth * 0.2 + forkSpread * tailWidth, 0, tailWidth * 0.1);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, tailLen, 0);
    gradient.addColorStop(0, colors.finTint);
    gradient.addColorStop(0.7, adjustAlpha(colors.finTint, 0.5));
    gradient.addColorStop(1, adjustAlpha(colors.accent, 0.3));
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = adjustAlpha(colors.accent, 0.15);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < tail.segments; i++) {
      const t = i / tail.segments - 0.5;
      const spread = t * forkSpread * tailWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, t * tailWidth * 0.2);
      ctx.quadraticCurveTo(tailLen * 0.5, spread * 0.5, tailLen * 0.9, spread);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEye(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number) {
    const config = RENDER_CONFIG.eye;
    const eyeX = config.xOffset * len;
    const eyeY = config.yOffset * height;
    const eyeRadius = fish.eyeSize * height;

    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = adjustAlpha(fish.colors.bodyTop, 0.8);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const eyeGradient = ctx.createRadialGradient(eyeX - eyeRadius * 0.2, eyeY - eyeRadius * 0.2, 0, eyeX, eyeY, eyeRadius);
    eyeGradient.addColorStop(0, "#ffffff");
    eyeGradient.addColorStop(0.7, "#e8e8e8");
    eyeGradient.addColorStop(1, "#cccccc");
    ctx.fillStyle = eyeGradient;
    ctx.fill();

    const irisRadius = eyeRadius * 0.65;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisRadius, 0, Math.PI * 2);
    const irisGradient = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, irisRadius);
    irisGradient.addColorStop(0, fish.colors.eye);
    irisGradient.addColorStop(0.8, adjustBrightness(fish.colors.eye, -20));
    irisGradient.addColorStop(1, adjustBrightness(fish.colors.eye, -40));
    ctx.fillStyle = irisGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * config.pupilSize, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX + config.highlightOffset.x * eyeRadius, eyeY + config.highlightOffset.y * eyeRadius, eyeRadius * config.highlightSize, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  function drawGill(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number) {
    const gillX = -0.15 * len;
    const gillY = 0.05 * height;
    const gillLen = 0.12 * height;

    ctx.save();
    ctx.translate(gillX, gillY);
    ctx.beginPath();
    ctx.moveTo(0, -gillLen * 0.5);
    ctx.quadraticCurveTo(height * 0.03, 0, 0, gillLen * 0.5);
    ctx.strokeStyle = adjustAlpha(fish.colors.bodyTop, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawGlowSpots(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number) {
    const config = RENDER_CONFIG.glow;
    for (let i = 0; i < config.spotCount; i++) {
      const t = i / (config.spotCount - 1);
      const x = -len * 0.3 + t * len * 0.6;
      const y = Math.sin(t * Math.PI) * height * 0.15;
      const spotSize = height * (config.spotSize[0] + Math.random() * (config.spotSize[1] - config.spotSize[0]));
      const color = config.colors[i % config.colors.length]!;
      const rgb = hexToRgb(color);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, spotSize);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity})`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.5})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderStaticGallery() {
    if (!staticCanvas) return;
    const ctx = staticCanvas.getContext("2d")!;
    const width = staticCanvas.width;
    const height = staticCanvas.height;

    ctx.fillStyle = "#0a1628";
    ctx.fillRect(0, 0, width, height);

    const species: FishSpecies[] = ["tropical", "sleek", "deep", "schooling"];
    const cellWidth = width / 4;
    const cellHeight = height / 3;

    // Draw grid
    let row = 0;
    for (const sp of species) {
      const colorCount = SPECIES_CONFIG[sp].colors.length;
      for (let colorIdx = 0; colorIdx < colorCount; colorIdx++) {
        const col = colorIdx;
        const fish = createFish(sp, colorIdx, 1.2);
        const centerX = col * cellWidth + cellWidth / 2;
        const centerY = row * cellHeight + cellHeight / 2;

        // Draw label
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${sp} #${colorIdx + 1}`, centerX, centerY - fish.bodyHeight - 10);

        drawFish(ctx, fish, centerX, centerY);
      }
      row++;
    }
  }

  onMount(() => {
    // Render static gallery
    renderStaticGallery();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  });
</script>

<div class="container">
  <h1>Fish Gallery - Design Review</h1>

  <section>
    <h2>Static Fish Gallery</h2>
    <p>All species and color variants. Click to regenerate with new random variations.</p>
    <canvas
      bind:this={staticCanvas}
      width={1200}
      height={600}
      onclick={() => renderStaticGallery()}
    ></canvas>
  </section>

  <section>
    <h2>Species Overview</h2>
    <ul>
      <li><strong>Tropical</strong> - Vibrant colors, prominent fins, rounder body</li>
      <li><strong>Sleek</strong> - Elongated, streamlined, muted colors</li>
      <li><strong>Deep</strong> - Dark body, bioluminescent glow spots, large eyes</li>
      <li><strong>Schooling</strong> - Small, uniform, lighter colors</li>
    </ul>
  </section>
</div>

<style>
  .container {
    padding: 20px;
    background: #0a1628;
    min-height: 100vh;
    color: #ffffff;
  }

  h1 {
    margin-bottom: 20px;
  }

  h2 {
    margin-top: 30px;
    margin-bottom: 10px;
    color: #7dd3fc;
  }

  section {
    margin-bottom: 40px;
  }

  canvas {
    border: 1px solid #2a4a6a;
    border-radius: 8px;
    cursor: pointer;
    display: block;
    max-width: 100%;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    margin: 8px 0;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  p {
    color: #8899aa;
    margin-bottom: 15px;
  }
</style>
