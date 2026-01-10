/**
 * LanternSystem
 *
 * Renders floating paper lanterns with warm glow for night mode.
 * Creates magical festival atmosphere.
 */

import type { Dimensions, QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

interface Lantern {
  x: number;
  y: number;
  size: number;
  phase: number;        // Animation phase for bobbing
  glowPhase: number;    // Separate phase for glow flicker
  bobSpeed: number;     // Vertical bobbing speed
  driftSpeed: number;   // Horizontal drift speed
  glowIntensity: number;
  color: LanternColor;
}

interface LanternColor {
  body: string;      // Lantern paper color
  glow: string;      // Glow color (warm)
  accent: string;    // Accent details
}

const LANTERN_COLORS: LanternColor[] = [
  { body: "#cc4444", glow: "#ff6b6b", accent: "#8b0000" },   // Red
  { body: "#cc8844", glow: "#ffaa6b", accent: "#8b4500" },   // Orange
  { body: "#ccaa44", glow: "#ffdd6b", accent: "#8b6914" },   // Yellow/Gold
  { body: "#dd7788", glow: "#ff99aa", accent: "#8b4455" },   // Pink
];

const LANTERN_COUNT_BY_QUALITY: Record<QualityLevel, number> = {
  high: 8,
  medium: 5,
  low: 3,
  minimal: 2,
  "ultra-minimal": 1,
};

export class LanternSystem {
  private lanterns: Lantern[] = [];
  private quality: QualityLevel = "medium";
  private isInitialized = false;

  constructor(quality: QualityLevel = "medium") {
    this.quality = quality;
  }

  initialize(dimensions: Dimensions): void {
    const count = LANTERN_COUNT_BY_QUALITY[this.quality];
    this.lanterns = [];

    for (let i = 0; i < count; i++) {
      this.lanterns.push(this.createLantern(dimensions, i, count));
    }

    this.isInitialized = true;
  }

  private createLantern(
    dimensions: Dimensions,
    index: number,
    total: number
  ): Lantern {
    const { width, height } = dimensions;

    // Distribute lanterns across the scene
    const segment = width / (total + 1);
    const baseX = segment * (index + 1);

    return {
      x: baseX + (Math.random() - 0.5) * segment * 0.6,
      y: height * 0.15 + Math.random() * height * 0.35,
      size: 25 + Math.random() * 15,
      phase: Math.random() * Math.PI * 2,
      glowPhase: Math.random() * Math.PI * 2,
      bobSpeed: 0.015 + Math.random() * 0.01,
      driftSpeed: 0.05 + Math.random() * 0.05,
      glowIntensity: 0.7 + Math.random() * 0.3,
      color: LANTERN_COLORS[Math.floor(Math.random() * LANTERN_COLORS.length)]!,
    };
  }

  update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) {
      this.initialize(dimensions);
      return;
    }

    for (const lantern of this.lanterns) {
      // Update animation phases
      lantern.phase += lantern.bobSpeed * frameMultiplier;
      lantern.glowPhase += 0.03 * frameMultiplier;

      // Gentle horizontal drift
      lantern.x += lantern.driftSpeed * frameMultiplier;

      // Wrap horizontally
      if (lantern.x > dimensions.width + lantern.size) {
        lantern.x = -lantern.size;
        lantern.y = dimensions.height * 0.15 + Math.random() * dimensions.height * 0.35;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, _dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    for (const lantern of this.lanterns) {
      this.drawLantern(ctx, lantern);
    }
  }

  private drawLantern(ctx: CanvasRenderingContext2D, lantern: Lantern): void {
    const { x, y, size, phase, glowPhase, glowIntensity, color } = lantern;

    // Bobbing motion
    const bobOffset = Math.sin(phase) * 3;
    const swayOffset = Math.sin(phase * 0.7) * 2;
    const currentX = x + swayOffset;
    const currentY = y + bobOffset;

    // Glow flicker
    const flicker = 0.8 + 0.2 * Math.sin(glowPhase * 3);
    const currentGlow = glowIntensity * flicker;

    ctx.save();
    ctx.translate(currentX, currentY);

    // Outer glow
    const outerGlowRadius = size * 3;
    const outerGlow = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, outerGlowRadius);
    outerGlow.addColorStop(0, `${color.glow}${Math.floor(currentGlow * 60).toString(16).padStart(2, '0')}`);
    outerGlow.addColorStop(0.3, `${color.glow}${Math.floor(currentGlow * 30).toString(16).padStart(2, '0')}`);
    outerGlow.addColorStop(0.6, `${color.glow}${Math.floor(currentGlow * 10).toString(16).padStart(2, '0')}`);
    outerGlow.addColorStop(1, "transparent");

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, outerGlowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow (brighter)
    const innerGlowRadius = size * 1.5;
    const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, innerGlowRadius);
    innerGlow.addColorStop(0, `${color.glow}${Math.floor(currentGlow * 200).toString(16).padStart(2, '0')}`);
    innerGlow.addColorStop(0.5, `${color.glow}${Math.floor(currentGlow * 80).toString(16).padStart(2, '0')}`);
    innerGlow.addColorStop(1, "transparent");

    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, innerGlowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Lantern body (simplified rounded rectangle shape)
    const bodyWidth = size * 0.8;
    const bodyHeight = size;

    // Body gradient
    const bodyGradient = ctx.createLinearGradient(-bodyWidth / 2, -bodyHeight / 2, bodyWidth / 2, bodyHeight / 2);
    bodyGradient.addColorStop(0, color.body);
    bodyGradient.addColorStop(0.5, color.glow);
    bodyGradient.addColorStop(1, color.body);

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.roundRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, 5);
    ctx.fill();

    // Lantern frame (dark accents)
    ctx.strokeStyle = color.accent;
    ctx.lineWidth = 2;

    // Top rim
    ctx.beginPath();
    ctx.ellipse(0, -bodyHeight / 2, bodyWidth / 2 * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Bottom rim
    ctx.beginPath();
    ctx.ellipse(0, bodyHeight / 2, bodyWidth / 2 * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Vertical ribs
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const ribX = -bodyWidth / 3 + (bodyWidth / 3) * i;
      ctx.beginPath();
      ctx.moveTo(ribX, -bodyHeight / 2 + 3);
      ctx.lineTo(ribX, bodyHeight / 2 - 3);
      ctx.stroke();
    }

    // Hanging string
    ctx.strokeStyle = "#4a4040";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight / 2 - 2);
    ctx.lineTo(0, -bodyHeight / 2 - size * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  setQuality(quality: QualityLevel, dimensions: Dimensions): void {
    this.quality = quality;
    this.initialize(dimensions);
  }

  handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
    if (!this.isInitialized) return;

    const scaleX = newDimensions.width / oldDimensions.width;
    const scaleY = newDimensions.height / oldDimensions.height;

    for (const lantern of this.lanterns) {
      lantern.x *= scaleX;
      lantern.y *= scaleY;
    }
  }

  cleanup(): void {
    this.lanterns = [];
    this.isInitialized = false;
  }
}
