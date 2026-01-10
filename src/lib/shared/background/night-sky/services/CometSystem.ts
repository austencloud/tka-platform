/**
 * CometSystem - The "Wow Moment"
 *
 * Creates spectacular comet appearances with:
 * - Bright nucleus with fuzzy coma (multi-layer radial glow)
 * - Dual tail system:
 *   - Ion tail: straight, blue, pushed away from sun
 *   - Dust tail: curved, white/yellow, following orbital path
 * - Particle debris field trailing behind
 * - Arc trajectory across the sky
 * - Size/brightness changes as comet approaches and recedes
 *
 * Visual approach inspired by Deep Ocean's jellyfish:
 * - Multi-segment tails like tentacles
 * - Traveling glow effects like bioluminescence
 * - Multiple independent animation phases
 */

import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { StarConfig } from "../domain/models/night-sky-models";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";

export interface CometConfig {
  size: number;
  speed: number;
  color: string;
  tailLength: number;
  interval: number;
  enabledOnQuality: QualityLevel[];
}

/** A debris particle in the comet's wake */
interface DebrisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  age: number;
  maxAge: number;
}

/** Complete comet state */
interface Comet {
  // Position and movement
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number; // 0-1 along trajectory

  // Appearance
  size: number;
  baseColor: string;

  // Animation phases
  comaPhase: number; // Coma glow pulsing
  ionTailPhase: number; // Ion tail streaming
  dustTailPhase: number; // Dust tail waving

  // Debris field
  debris: DebrisParticle[];

  // Direction (for tail orientation)
  direction: number; // -1 or 1
  angle: number; // Trajectory angle
}

export class CometSystem {
  private comet: Comet | null = null;
  private timer: number = 0;
  private config: CometConfig;
  private starConfig: StarConfig;
  private calculationService: INightSkyCalculationService;
  private quality: QualityLevel = "high";

  constructor(
    config: CometConfig,
    starConfig: StarConfig,
    calculationService: INightSkyCalculationService
  ) {
    this.config = config;
    this.starConfig = starConfig;
    this.calculationService = calculationService;
  }

  update(
    dim: Dimensions,
    a11y: AccessibilitySettings,
    quality: QualityLevel
  ): void {
    this.quality = quality;

    if (!this.config.enabledOnQuality.includes(quality)) {
      this.comet = null;
      return;
    }

    const effectiveSpeed = a11y.reducedMotion ? 0.3 : 1;

    if (!this.comet) {
      this.timer++;
      if (this.timer >= this.config.interval) {
        this.spawnComet(dim);
        this.timer = 0;
      }
    } else {
      this.updateComet(dim, effectiveSpeed);
    }
  }

  private spawnComet(dim: Dimensions): void {
    // Determine trajectory - arc across upper portion of sky
    const fromLeft = Math.random() > 0.5;
    const direction = fromLeft ? 1 : -1;

    // Start position (off screen)
    const startX = fromLeft ? -50 : dim.width + 50;
    const startY = dim.height * (0.1 + Math.random() * 0.2);

    // End position (off screen on opposite side)
    const endX = fromLeft ? dim.width + 50 : -50;
    const endY = dim.height * (0.2 + Math.random() * 0.3);

    // Calculate trajectory angle
    const angle = Math.atan2(endY - startY, endX - startX);

    this.comet = {
      x: startX,
      y: startY,
      startX,
      startY,
      endX,
      endY,
      progress: 0,
      size: this.config.size,
      baseColor: this.config.color,
      comaPhase: 0,
      ionTailPhase: 0,
      dustTailPhase: 0,
      debris: [],
      direction,
      angle,
    };
  }

  private updateComet(dim: Dimensions, speedMultiplier: number): void {
    if (!this.comet) return;

    const c = this.comet;

    // Update progress along trajectory
    const speed = (this.config.speed * speedMultiplier) / dim.width;
    c.progress += speed * 0.5;

    if (c.progress >= 1) {
      this.comet = null;
      return;
    }

    // Calculate position along arc trajectory
    // Add slight curve (parabolic arc)
    const t = c.progress;
    c.x = c.startX + (c.endX - c.startX) * t;

    // Parabolic arc - peaks in the middle
    const arcHeight = dim.height * 0.15;
    const baseY = c.startY + (c.endY - c.startY) * t;
    const arcOffset = Math.sin(t * Math.PI) * arcHeight;
    c.y = baseY - arcOffset;

    // Calculate instantaneous velocity direction for tail orientation
    // Derivatives: dx/dt = (endX - startX), dy/dt = (endY - startY) - cos(t*PI)*PI*arcHeight
    const vx = c.endX - c.startX;
    const vy = (c.endY - c.startY) - Math.cos(t * Math.PI) * Math.PI * arcHeight;
    c.angle = Math.atan2(vy, vx);

    // Update animation phases
    c.comaPhase += 0.05 * speedMultiplier;
    c.ionTailPhase += 0.08 * speedMultiplier;
    c.dustTailPhase += 0.03 * speedMultiplier;

    // Size changes - larger when closer to middle of trajectory
    const proximityScale = 0.7 + Math.sin(t * Math.PI) * 0.5;
    c.size = this.config.size * proximityScale;

    // Spawn debris particles
    if (this.quality === "high" && Math.random() < 0.3) {
      this.spawnDebris(c);
    }

    // Update existing debris
    this.updateDebris(speedMultiplier);
  }

  private spawnDebris(comet: Comet): void {
    // Debris trails behind - opposite to direction of travel
    const tailAngle = comet.angle + Math.PI;
    const speed = 0.2 + Math.random() * 0.3;
    const spread = (Math.random() - 0.5) * 0.4;

    const particle: DebrisParticle = {
      x: comet.x + (Math.random() - 0.5) * comet.size,
      y: comet.y + (Math.random() - 0.5) * comet.size,
      vx: Math.cos(tailAngle + spread) * speed,
      vy: Math.sin(tailAngle + spread) * speed,
      size: 1 + Math.random() * 2,
      opacity: 0.6 + Math.random() * 0.4,
      age: 0,
      maxAge: 60 + Math.random() * 60,
    };

    comet.debris.push(particle);

    // Limit debris count
    if (comet.debris.length > 50) {
      comet.debris.shift();
    }
  }

  private updateDebris(speedMultiplier: number): void {
    if (!this.comet) return;

    this.comet.debris = this.comet.debris.filter((p) => {
      p.x += p.vx * speedMultiplier;
      p.y += p.vy * speedMultiplier;
      p.age += speedMultiplier;
      p.opacity *= 0.98;
      return p.age < p.maxAge && p.opacity > 0.01;
    });
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings): void {
    if (!this.comet) return;

    const c = this.comet;
    const baseAlpha = a11y.reducedMotion ? 0.6 : 1;

    ctx.save();

    // Layer 1: Debris field (furthest back)
    if (this.quality === "high") {
      this.drawDebris(ctx, c, baseAlpha);
    }

    // Layer 2: Dust tail (curved, white/yellow)
    this.drawDustTail(ctx, c, baseAlpha);

    // Layer 3: Ion tail (straight, blue)
    this.drawIonTail(ctx, c, baseAlpha);

    // Layer 4: Coma glow (fuzzy head)
    this.drawComa(ctx, c, baseAlpha);

    // Layer 5: Nucleus (bright center)
    this.drawNucleus(ctx, c, baseAlpha);

    ctx.restore();
  }

  /**
   * Draw debris particles trailing the comet
   */
  private drawDebris(
    ctx: CanvasRenderingContext2D,
    comet: Comet,
    baseAlpha: number
  ): void {
    for (const p of comet.debris) {
      ctx.globalAlpha = p.opacity * baseAlpha * 0.5;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw the curved dust tail trailing behind the comet
   * Uses a teardrop shape that wraps around the back of the nucleus
   */
  private drawDustTail(
    ctx: CanvasRenderingContext2D,
    comet: Comet,
    baseAlpha: number
  ): void {
    const tailLength = this.config.tailLength * 3;
    const segments = 20;

    // Tail direction is opposite to movement (trails behind)
    const tailAngle = comet.angle + Math.PI;
    const perpAngle = tailAngle + Math.PI / 2;

    // Nucleus radius - tail wraps around this
    const nucleusRadius = comet.size * 0.8;

    ctx.globalAlpha = baseAlpha * 0.4;

    for (let layer = 0; layer < 3; layer++) {
      const layerOffset = layer * 0.3;
      const maxWidth = comet.size * (1.5 - layer * 0.3);
      const layerRadius = nucleusRadius * (1 + layer * 0.2);

      ctx.beginPath();

      // Start with an arc wrapping around the back of the comet
      // Arc from one side of the comet, around the back, to the other side
      const arcStart = tailAngle - Math.PI * 0.4; // Start 72° from tail direction
      const arcEnd = tailAngle + Math.PI * 0.4;   // End 72° on other side

      // Draw arc around back of comet (this connects to the circular head)
      ctx.arc(comet.x, comet.y, layerRadius, arcStart, arcEnd, false);

      // Width at arc endpoints - this is the starting width for the tail
      // Must match the arc so there's no discontinuity
      const arcSpread = Math.sin(Math.PI * 0.4) * layerRadius;

      // Continue into the tail from the arc endpoint - one side
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const dist = layerRadius + t * tailLength * (1 + layerOffset * 0.2);

        const baseX = comet.x + Math.cos(tailAngle) * dist;
        const baseY = comet.y + Math.sin(tailAngle) * dist;

        // Wave effect (subtle)
        const wave = Math.sin(comet.dustTailPhase + t * Math.PI * 2) * comet.size * 0.2;

        // Width: starts at arc spread, tapers to nothing - NEVER gets wider
        const width = arcSpread * (1 - t * 0.95);

        const tailX = baseX + Math.cos(perpAngle) * (wave + width);
        const tailY = baseY + Math.sin(perpAngle) * (wave + width);

        ctx.lineTo(tailX, tailY);
      }

      // Return on other side
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const dist = layerRadius + t * tailLength * (1 + layerOffset * 0.2);

        const baseX = comet.x + Math.cos(tailAngle) * dist;
        const baseY = comet.y + Math.sin(tailAngle) * dist;

        const wave = Math.sin(comet.dustTailPhase + t * Math.PI * 2) * comet.size * 0.2;
        const width = arcSpread * (1 - t * 0.95);

        const tailX = baseX + Math.cos(perpAngle) * (wave - width);
        const tailY = baseY + Math.sin(perpAngle) * (wave - width);

        ctx.lineTo(tailX, tailY);
      }

      ctx.closePath();

      // Gradient fill - warm colors for dust tail
      const tailEndX = comet.x + Math.cos(tailAngle) * tailLength;
      const tailEndY = comet.y + Math.sin(tailAngle) * tailLength;
      const gradient = ctx.createLinearGradient(
        comet.x,
        comet.y,
        tailEndX,
        tailEndY
      );
      gradient.addColorStop(0, `rgba(255, 250, 220, ${0.6 - layer * 0.15})`);
      gradient.addColorStop(0.3, `rgba(255, 240, 200, ${0.4 - layer * 0.1})`);
      gradient.addColorStop(1, "rgba(255, 230, 180, 0)");

      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * Draw the straight ion tail (trails behind comet)
   */
  private drawIonTail(
    ctx: CanvasRenderingContext2D,
    comet: Comet,
    baseAlpha: number
  ): void {
    const tailLength = this.config.tailLength * 4;

    ctx.globalAlpha = baseAlpha * 0.3;

    // Ion tail trails behind the comet (opposite to direction of travel)
    const ionAngle = comet.angle + Math.PI;

    for (let layer = 0; layer < 2; layer++) {
      const layerWidth = comet.size * (0.8 - layer * 0.2);

      // Calculate tail end position
      const tailEndX = comet.x + Math.cos(ionAngle) * tailLength;
      const tailEndY = comet.y + Math.sin(ionAngle) * tailLength;

      // Streaming effect - traveling waves along tail
      const streamOffset = (comet.ionTailPhase * tailLength) % tailLength;

      ctx.beginPath();

      // Draw tail as tapered shape
      const perpX = Math.cos(ionAngle + Math.PI / 2);
      const perpY = Math.sin(ionAngle + Math.PI / 2);

      ctx.moveTo(
        comet.x + perpX * layerWidth * 0.5,
        comet.y + perpY * layerWidth * 0.5
      );

      // Top edge with streaming variation
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const x = comet.x + (tailEndX - comet.x) * t;
        const y = comet.y + (tailEndY - comet.y) * t;
        const width = layerWidth * (1 - t * 0.9) * 0.5;
        const wave =
          Math.sin(comet.ionTailPhase * 5 + t * Math.PI * 4) * width * 0.2;
        ctx.lineTo(x + perpX * (width + wave), y + perpY * (width + wave));
      }

      // Bottom edge
      for (let i = 10; i >= 0; i--) {
        const t = i / 10;
        const x = comet.x + (tailEndX - comet.x) * t;
        const y = comet.y + (tailEndY - comet.y) * t;
        const width = layerWidth * (1 - t * 0.9) * 0.5;
        const wave =
          Math.sin(comet.ionTailPhase * 5 + t * Math.PI * 4) * width * 0.2;
        ctx.lineTo(x - perpX * (width + wave), y - perpY * (width + wave));
      }

      ctx.closePath();

      // Blue gradient for ion tail
      const gradient = ctx.createLinearGradient(
        comet.x,
        comet.y,
        tailEndX,
        tailEndY
      );
      gradient.addColorStop(0, `rgba(100, 180, 255, ${0.5 - layer * 0.15})`);
      gradient.addColorStop(0.3, `rgba(80, 150, 255, ${0.3 - layer * 0.1})`);
      gradient.addColorStop(1, "rgba(60, 120, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * Draw the coma (fuzzy glow around nucleus)
   */
  private drawComa(
    ctx: CanvasRenderingContext2D,
    comet: Comet,
    baseAlpha: number
  ): void {
    // Pulsing coma size
    const pulseScale = 1 + Math.sin(comet.comaPhase) * 0.1;
    const comaRadius = comet.size * 3 * pulseScale;

    // Outer glow
    ctx.globalAlpha = baseAlpha * 0.3;
    const outerGlow = ctx.createRadialGradient(
      comet.x,
      comet.y,
      0,
      comet.x,
      comet.y,
      comaRadius
    );
    outerGlow.addColorStop(0, "rgba(200, 255, 220, 0.8)");
    outerGlow.addColorStop(0.3, "rgba(180, 240, 200, 0.4)");
    outerGlow.addColorStop(0.6, "rgba(150, 220, 180, 0.15)");
    outerGlow.addColorStop(1, "rgba(100, 200, 150, 0)");

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, comaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner coma (brighter)
    ctx.globalAlpha = baseAlpha * 0.5;
    const innerComa = ctx.createRadialGradient(
      comet.x,
      comet.y,
      0,
      comet.x,
      comet.y,
      comaRadius * 0.5
    );
    innerComa.addColorStop(0, "rgba(255, 255, 255, 1)");
    innerComa.addColorStop(0.4, "rgba(220, 255, 230, 0.6)");
    innerComa.addColorStop(1, "rgba(180, 240, 200, 0)");

    ctx.fillStyle = innerComa;
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, comaRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw the bright nucleus
   */
  private drawNucleus(
    ctx: CanvasRenderingContext2D,
    comet: Comet,
    baseAlpha: number
  ): void {
    const nucleusRadius = comet.size * 0.6;

    ctx.globalAlpha = baseAlpha;

    // Bright white core
    const coreGradient = ctx.createRadialGradient(
      comet.x - nucleusRadius * 0.2,
      comet.y - nucleusRadius * 0.2,
      0,
      comet.x,
      comet.y,
      nucleusRadius
    );
    coreGradient.addColorStop(0, "#ffffff");
    coreGradient.addColorStop(0.5, "#f0fff5");
    coreGradient.addColorStop(1, "#d0f0e0");

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, nucleusRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bright highlight
    ctx.globalAlpha = baseAlpha * 0.8;
    const highlightGradient = ctx.createRadialGradient(
      comet.x - nucleusRadius * 0.3,
      comet.y - nucleusRadius * 0.3,
      0,
      comet.x - nucleusRadius * 0.3,
      comet.y - nucleusRadius * 0.3,
      nucleusRadius * 0.5
    );
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(
      comet.x - nucleusRadius * 0.2,
      comet.y - nucleusRadius * 0.2,
      nucleusRadius * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  cleanup(): void {
    this.comet = null;
    this.timer = 0;
  }

  /**
   * Manually trigger a comet to appear
   */
  trigger(dim: Dimensions): void {
    // Only spawn if no comet is currently active
    if (!this.comet) {
      this.spawnComet(dim);
      this.timer = 0;
    }
  }

  /**
   * Check if a comet is currently visible
   */
  isActive(): boolean {
    return this.comet !== null;
  }

  /**
   * Get comet position for external tracking (e.g., UFO beam targeting)
   */
  getPosition(): { x: number; y: number } | null {
    return this.comet ? { x: this.comet.x, y: this.comet.y } : null;
  }
}
