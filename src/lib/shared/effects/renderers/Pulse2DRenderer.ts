import type { Pulse2DParams } from "../translators/canvas2d-types";

export interface PulseTipInput {
  x: number;
  y: number;
  propIndex: 0 | 1;
  tipIndex: number;
  blueColor: string;
  redColor: string;
}

interface PulseRing {
  x: number;
  y: number;
  birthTime: number;
  color: string;
  active: boolean;
}

export class Pulse2DRenderer {
  private static readonly POOL_SIZE = 256;
  private pool: PulseRing[];
  private nextSlot = 0;
  private prevTipPositions: Map<number, { x: number; y: number }> = new Map();
  private lastBeatIndex: Map<number, number> = new Map();
  private lastContinuousSpawn: Map<number, number> = new Map();
  private clock = 0;
  private ringCount = 0;

  constructor() {
    this.pool = Array.from({ length: Pulse2DRenderer.POOL_SIZE }, () => ({
      x: 0,
      y: 0,
      birthTime: 0,
      color: "#000",
      active: false,
    }));
  }

  render(
    ctx: CanvasRenderingContext2D,
    params: Pulse2DParams,
    tips: PulseTipInput[],
    currentStep: number,
    dt: number,
    scale: number = 1,
  ): void {
    this.clock += dt;

    let triggered = false;

    for (const tip of tips) {
      const spawned = this.checkTrigger(params, tip, currentStep, dt, scale);
      if (spawned) triggered = true;
    }

    if (this.ringCount === 0 && !triggered) return;

    ctx.save();
    ctx.globalCompositeOperation = params.blendMode;

    for (let i = 0; i < Pulse2DRenderer.POOL_SIZE; i++) {
      const ring = this.pool[i]!;
      if (!ring.active) continue;

      const age = this.clock - ring.birthTime;
      const progress = age / params.lifetime;

      if (progress >= 1) {
        ring.active = false;
        this.ringCount--;
        continue;
      }

      const radius = progress * params.maxRadius * scale;
      const alpha = params.intensity * (1 - progress) * (1 - progress);

      const drawColor = params.resolvedPalette.hueShift
        ? this.lerpColor(
            ring.color,
            params.resolvedPalette.fade,
            progress,
          )
        : ring.color;

      if (params.style === "glow") {
        this.drawGlowRing(ctx, ring.x, ring.y, radius, drawColor, params, alpha, scale);
      } else {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.withAlpha(drawColor, alpha);
        ctx.lineWidth = params.ringWidth * scale;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  dispose(): void {
    for (let i = 0; i < Pulse2DRenderer.POOL_SIZE; i++) {
      this.pool[i]!.active = false;
    }
    this.prevTipPositions.clear();
    this.lastBeatIndex.clear();
    this.lastContinuousSpawn.clear();
    this.clock = 0;
    this.ringCount = 0;
    this.nextSlot = 0;
  }

  private checkTrigger(
    params: Pulse2DParams,
    tip: PulseTipInput,
    currentStep: number,
    dt: number,
    _scale: number,
  ): boolean {
    const color = this.pickColor(params, tip);
    let spawned = false;

    const prev = this.prevTipPositions.get(tip.tipIndex);
    const dx = prev ? tip.x - prev.x : 0;
    const dy = prev ? tip.y - prev.y : 0;
    const speed = dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0;

    switch (params.trigger) {
      case "beat": {
        const beatIdx = Math.floor(currentStep / params.beatInterval);
        const lastIdx = this.lastBeatIndex.get(tip.tipIndex) ?? -1;
        if (beatIdx !== lastIdx) {
          this.spawn(tip.x, tip.y, color);
          this.lastBeatIndex.set(tip.tipIndex, beatIdx);
          spawned = true;
        }
        break;
      }
      case "velocity": {
        const threshold = params.velocityThreshold * params.refSpeed;
        const lastSpawn = this.lastContinuousSpawn.get(tip.tipIndex) ?? -Infinity;
        if (speed > threshold && this.clock - lastSpawn > 0.1) {
          this.spawn(tip.x, tip.y, color);
          this.lastContinuousSpawn.set(tip.tipIndex, this.clock);
          spawned = true;
        }
        break;
      }
      case "continuous": {
        const normalizedSpeed = Math.min(speed / params.refSpeed, 2);
        const rate = 3 * (1 + normalizedSpeed);
        const interval = 1 / rate;
        const lastSpawn = this.lastContinuousSpawn.get(tip.tipIndex) ?? -Infinity;
        if (this.clock - lastSpawn > interval) {
          this.spawn(tip.x, tip.y, color);
          this.lastContinuousSpawn.set(tip.tipIndex, this.clock);
          spawned = true;
        }
        break;
      }
    }

    this.prevTipPositions.set(tip.tipIndex, { x: tip.x, y: tip.y });
    return spawned;
  }

  private spawn(x: number, y: number, color: string): void {
    const ring = this.pool[this.nextSlot]!;
    if (ring.active) this.ringCount--;
    ring.x = x;
    ring.y = y;
    ring.birthTime = this.clock;
    ring.color = color;
    ring.active = true;
    this.ringCount++;
    this.nextSlot = (this.nextSlot + 1) % Pulse2DRenderer.POOL_SIZE;
  }

  private pickColor(params: Pulse2DParams, tip: PulseTipInput): string {
    switch (params.colorMode) {
      case "prop-matched":
        return tip.propIndex === 0 ? tip.blueColor : tip.redColor;
      case "rainbow":
        return `hsl(${(this.clock * 60) % 360}, 80%, 60%)`;
      case "palette": {
        if (params.colorPalette.length === 0) return params.color;
        return params.colorPalette[tip.tipIndex % params.colorPalette.length]!;
      }
      case "solid":
      default:
        return params.color;
    }
  }

  private drawGlowRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    params: Pulse2DParams,
    alpha: number,
    scale: number,
  ): void {
    const bandWidth = params.ringWidth * scale;
    const innerR = Math.max(0, radius - bandWidth);
    const outerR = radius + bandWidth;

    const gradient = ctx.createRadialGradient(x, y, innerR, x, y, outerR);
    gradient.addColorStop(0, this.withAlpha(color, 0));
    gradient.addColorStop(0.4, this.withAlpha(params.resolvedPalette.fade, alpha * 0.5));
    gradient.addColorStop(0.7, this.withAlpha(color, alpha));
    gradient.addColorStop(1.0, this.withAlpha(color, 0));

    ctx.fillStyle = gradient;
    ctx.fillRect(x - outerR, y - outerR, outerR * 2, outerR * 2);
  }

  private lerpColor(from: string, to: string, t: number): string {
    const a = hexToRgb(from.startsWith("#") ? from : "#ffffff");
    const b = hexToRgb(to.startsWith("#") ? to : "#ffffff");
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  private withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith("#")) {
      const { r, g, b } = hexToRgb(color);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
      return `hsla${color.slice(3, -1)}, ${a})`;
    }
    if (color.startsWith("rgb(") && !color.startsWith("rgba(")) {
      return `rgba${color.slice(3, -1)}, ${a})`;
    }
    return color;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}
