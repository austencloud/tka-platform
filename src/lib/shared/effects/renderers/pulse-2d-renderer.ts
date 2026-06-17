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
  /** 0-1 tip energy captured at spawn — drives size, brightness, deform. */
  energy: number;
  /** Normalized travel direction at spawn (Mach-cone axis). */
  dirX: number;
  dirY: number;
  /** Amplitude scalar (1 for the primary ring, <1 for harmonic overtones). */
  amp: number;
}

interface PendingSpawn {
  releaseAt: number;
  x: number;
  y: number;
  color: string;
  energy: number;
  dirX: number;
  dirY: number;
  amp: number;
}

/** px/frame tip speed that maps to full ring energy (matches zap's REF_SPEED). */
const REF_ENERGY_SPEED = 22;
/** Trailing overtone-ring spacing (seconds, frame-clock scheduled). */
const HARMONIC_SPACING = 0.11;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

/**
 * Pressure-shockwave ring emitter for the Canvas2D backend.
 *
 * Each ring captures the tip energy + travel direction at the instant it was
 * born and uses them to drive size, brightness, a Mach-cone deformation (the
 * ring bunches toward the travel direction), a white-hot leading front, a
 * chromatic fringe on hard hits, and an origin detonation flash. A single
 * trigger optionally emits a frame-clock-scheduled train of decaying overtone
 * rings.
 *
 * PERF: never set `shadowBlur` in the per-ring hot path — the hot front comes
 * from a band fill + a thin stroke + a short leading-edge wedge. Per-segment
 * shadowBlur tanks the frame rate.
 */
export class Pulse2DRenderer {
  private static readonly POOL_SIZE = 256;
  private pool: PulseRing[];
  private nextSlot = 0;
  private prevTipPositions: Map<number, { x: number; y: number }> = new Map();
  private lastBeatIndex: Map<number, number> = new Map();
  private lastContinuousSpawn: Map<number, number> = new Map();
  private pending: PendingSpawn[] = [];
  private clock = 0;
  private ringCount = 0;

  constructor() {
    this.pool = Array.from({ length: Pulse2DRenderer.POOL_SIZE }, () => ({
      x: 0,
      y: 0,
      birthTime: 0,
      color: "#000",
      active: false,
      energy: 0,
      dirX: 1,
      dirY: 0,
      amp: 1,
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

    // Release any scheduled overtone rings whose time has come (frame-clock, not
    // wall-clock — keeps QR export deterministic).
    if (this.pending.length > 0) {
      let w = 0;
      for (let i = 0; i < this.pending.length; i++) {
        const ps = this.pending[i]!;
        if (ps.releaseAt <= this.clock) {
          this.spawn(ps.x, ps.y, ps.color, ps.energy, ps.dirX, ps.dirY, ps.amp);
        } else {
          this.pending[w++] = ps;
        }
      }
      this.pending.length = w;
    }

    let triggered = false;
    for (const tip of tips) {
      if (this.checkTrigger(params, tip, currentStep, dt)) triggered = true;
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

      this.drawRing(ctx, ring, params, age, progress, scale);
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
    this.pending.length = 0;
    this.clock = 0;
    this.ringCount = 0;
    this.nextSlot = 0;
  }

  private checkTrigger(
    params: Pulse2DParams,
    tip: PulseTipInput,
    currentStep: number,
    dt: number,
  ): boolean {
    const color = this.pickColor(params, tip);

    const prev = this.prevTipPositions.get(tip.tipIndex);
    const dx = prev ? tip.x - prev.x : 0;
    const dy = prev ? tip.y - prev.y : 0;
    const pxPerFrame = Math.sqrt(dx * dx + dy * dy);
    const speed = dt > 0 ? pxPerFrame / dt : 0; // px/s — drives triggers
    const energy = clamp01(pxPerFrame / REF_ENERGY_SPEED); // px/frame — drives visual
    const len = pxPerFrame > 1e-4 ? pxPerFrame : 1;
    const dirX = dx / len;
    const dirY = dy / len;

    let spawned = false;

    switch (params.trigger) {
      case "beat": {
        const beatIdx = Math.floor(currentStep / params.beatInterval);
        const lastIdx = this.lastBeatIndex.get(tip.tipIndex) ?? -1;
        if (beatIdx !== lastIdx) {
          this.trigger(params, tip.x, tip.y, color, energy, dirX, dirY);
          this.lastBeatIndex.set(tip.tipIndex, beatIdx);
          spawned = true;
        }
        break;
      }
      case "velocity": {
        const threshold = params.velocityThreshold * params.refSpeed;
        const lastSpawn = this.lastContinuousSpawn.get(tip.tipIndex) ?? -Infinity;
        if (speed > threshold && this.clock - lastSpawn > 0.1) {
          this.trigger(params, tip.x, tip.y, color, energy, dirX, dirY);
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
          this.trigger(params, tip.x, tip.y, color, energy, dirX, dirY);
          this.lastContinuousSpawn.set(tip.tipIndex, this.clock);
          spawned = true;
        }
        break;
      }
    }

    this.prevTipPositions.set(tip.tipIndex, { x: tip.x, y: tip.y });
    return spawned;
  }

  /** Spawn the primary ring + schedule any harmonic overtone rings. */
  private trigger(
    params: Pulse2DParams,
    x: number,
    y: number,
    color: string,
    energy: number,
    dirX: number,
    dirY: number,
  ): void {
    this.spawn(x, y, color, energy, dirX, dirY, 1);
    const trailing = Math.round(params.harmonics * 3);
    for (let i = 1; i <= trailing; i++) {
      this.pending.push({
        releaseAt: this.clock + i * HARMONIC_SPACING,
        x,
        y,
        color,
        energy,
        dirX,
        dirY,
        amp: Math.max(0.1, 1 - i * 0.22),
      });
    }
  }

  private spawn(
    x: number,
    y: number,
    color: string,
    energy: number,
    dirX: number,
    dirY: number,
    amp: number,
  ): void {
    const ring = this.pool[this.nextSlot]!;
    if (ring.active) this.ringCount--;
    ring.x = x;
    ring.y = y;
    ring.birthTime = this.clock;
    ring.color = color;
    ring.energy = energy;
    ring.dirX = dirX;
    ring.dirY = dirY;
    ring.amp = amp;
    ring.active = true;
    this.ringCount++;
    this.nextSlot = (this.nextSlot + 1) % Pulse2DRenderer.POOL_SIZE;
  }

  private drawRing(
    ctx: CanvasRenderingContext2D,
    ring: PulseRing,
    params: Pulse2DParams,
    age: number,
    progress: number,
    scale: number,
  ): void {
    const eo = easeOut(progress);
    const sizeBoost = 0.45 + 0.55 * params.velocityScale * ring.energy;
    const R = params.maxRadius * scale * sizeBoost * ring.amp * eo;
    if (R <= 0.5) return;

    const falloff = (1 - progress) * (1 - progress);
    const peak = params.intensity * (0.45 + 0.55 * ring.energy) * falloff * ring.amp;
    // Base directional floor + energy term: a high-asymmetry preset reads as a
    // teardrop even at rest, then deforms harder on fast swings.
    const asym = params.asymmetry * (0.4 + 0.6 * ring.energy);
    const travelAngle = Math.atan2(ring.dirY, ring.dirX);

    const drawColor = params.resolvedPalette.hueShift
      ? this.lerpColor(ring.color, params.resolvedPalette.fade, progress)
      : ring.color;

    const SEG = 44;
    const trace = (mul: number, dx: number, dy: number, from?: number, to?: number) => {
      const a = from ?? 0;
      const b = to ?? SEG;
      for (let i = a; i <= b; i++) {
        const th = (i / SEG) * Math.PI * 2;
        const rr = R * mul * (1 - asym * Math.cos(th - travelAngle));
        const x = ring.x + dx + Math.cos(th) * rr;
        const y = ring.y + dy + Math.sin(th) * rr;
        if (i === a) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };

    // Chromatic fringe — only fires on high-energy rings.
    const chr = params.chromatic * ring.energy;
    if (chr > 0.02) {
      const off = R * 0.05 * chr;
      const ca = Math.cos(travelAngle);
      const sa = Math.sin(travelAngle);
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeStyle = this.withAlpha("#ff2828", peak * 0.5);
      ctx.beginPath();
      trace(1, ca * off, sa * off);
      ctx.stroke();
      ctx.strokeStyle = this.withAlpha("#2850ff", peak * 0.5);
      ctx.beginPath();
      trace(1, -ca * off, -sa * off);
      ctx.stroke();
    }

    const bandWidth = params.ringWidth * scale;

    if (params.style === "glow") {
      // Deformed annulus (colored wake) — one even-odd fill, no shadow.
      const inner = Math.max(0, 1 - bandWidth / Math.max(R, 1));
      ctx.beginPath();
      trace(1, 0, 0);
      trace(inner, 0, 0);
      ctx.fillStyle = this.withAlpha(params.resolvedPalette.fade, peak * 0.5);
      ctx.fill("evenodd");
    }

    // Bright front stroke over the whole deformed outline.
    ctx.lineWidth = params.style === "stroke" ? bandWidth : 2 * scale;
    ctx.strokeStyle = this.withAlpha(drawColor, peak);
    ctx.beginPath();
    trace(1, 0, 0);
    ctx.stroke();

    // White-hot leading wedge — only where the ring bunches (travel side).
    if (asym > 0.04) {
      const center = ((travelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const cSeg = (center / (Math.PI * 2)) * SEG;
      const w = 7;
      ctx.lineWidth = 3 * scale;
      ctx.strokeStyle = this.withAlpha("#ffffff", peak * 0.85);
      ctx.beginPath();
      trace(1, 0, 0, Math.floor(cSeg - w), Math.ceil(cSeg + w));
      ctx.stroke();
    }

    // Origin detonation flash — collapses over the first ~140ms.
    const fl = params.flash * ring.amp;
    if (fl > 0.02 && age < 0.14) {
      const ft = age / 0.14;
      const fr = (8 + 22 * params.intensity) * (1 - ft) * (0.6 + ring.energy) * scale;
      const fa = clamp01(fl * (1 - ft) * peak * 2.2);
      const r0 = Math.max(1, fr);
      const g = ctx.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, r0);
      g.addColorStop(0, this.withAlpha("#ffffff", fa));
      g.addColorStop(0.5, this.withAlpha(drawColor, fa * 0.6));
      g.addColorStop(1, this.withAlpha(drawColor, 0));
      ctx.fillStyle = g;
      ctx.fillRect(ring.x - fr, ring.y - fr, fr * 2, fr * 2);
    }
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
