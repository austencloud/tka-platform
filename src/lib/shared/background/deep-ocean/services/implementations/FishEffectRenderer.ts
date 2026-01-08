import { inject, injectable } from "inversify";
import type { IFishEffectRenderer } from "../contracts/IFishEffectRenderer";
import type { IColorCalculator } from "../contracts/IColorCalculator";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";
import type { Point } from "../../physics/BodyOutlineCalculator";
import { BodyOutlineCalculator } from "../../physics/BodyOutlineCalculator";
import { TYPES } from "../../../inversify/types";

/**
 * Renders visual effects for fish (wake trails, bioluminescence).
 * Extracted from FishRenderer to follow single-responsibility principle.
 */
@injectable()
export class FishEffectRenderer implements IFishEffectRenderer {
  private bodyOutlineCalculator = new BodyOutlineCalculator();

  // Legacy glow configuration for Bezier fish
  private readonly GLOW_CONFIG = {
    spotCount: 5,
    spotSize: [0.02, 0.05] as [number, number],
    colors: ["#00fff7", "#7b68ee", "#00ced1"],
  };

  constructor(
    @inject(TYPES.IColorCalculator) private colorCalc: IColorCalculator
  ) {}

  drawWakeTrail(ctx: CanvasRenderingContext2D, fish: FishMarineLife): void {
    if (fish.wakeTrail.length === 0) return;

    ctx.save();
    // Wake is in world space, need to undo fish transform
    ctx.scale(fish.direction, 1);
    ctx.rotate(-fish.rotation);
    ctx.translate(-fish.x, -fish.y);

    for (const particle of fish.wakeTrail) {
      if (particle.opacity <= 0) continue;

      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.size
      );

      gradient.addColorStop(
        0,
        `rgba(180, 220, 255, ${particle.opacity * 0.4})`
      );
      gradient.addColorStop(
        0.5,
        `rgba(180, 220, 255, ${particle.opacity * 0.2})`
      );
      gradient.addColorStop(1, "rgba(180, 220, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSpineBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void {
    const centerX = (outline.headPoint.x + outline.tailPoint.x) / 2;
    const centerY = (outline.headPoint.y + outline.tailPoint.y) / 2;

    // Pulsing glow intensity
    const pulseIntensity = fish.glowIntensity * (0.7 + Math.sin(fish.glowPhase * 2) * 0.3);

    // Layer 1: Large outer glow
    const outerRadius = Math.max(fish.bodyLength, fish.bodyHeight) * 1.2;
    const rgb = this.colorCalc.hexToRgb(fish.colors.accent);

    const outerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
    outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.5})`);
    outerGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.25})`);
    outerGradient.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.1})`);
    outerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Inner intense glow
    const innerRadius = Math.max(fish.bodyLength, fish.bodyHeight) * 0.5;
    const innerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    innerGradient.addColorStop(0, `rgba(255, 255, 255, ${pulseIntensity * 0.4})`);
    innerGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.6})`);
    innerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: Edge glow along body outline
    ctx.save();
    ctx.shadowColor = fish.colors.accent;
    ctx.shadowBlur = 15 * pulseIntensity;
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, pulseIntensity * 0.5);
    ctx.lineWidth = 3;
    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.stroke();
    ctx.restore();
  }

  drawSpineBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    // More spots, more variety
    const spotCount = 8;
    const colors = ["#00fff7", "#7b68ee", "#00ced1", "#ff00ff", "#00ff88"];

    ctx.save();

    for (let i = 0; i < spotCount; i++) {
      const t = (i + 0.5) / (spotCount);
      const pos = spine.getPositionAt(t);

      // Offset spots from centerline
      const perpAngle = pos.angle - Math.PI / 2;
      const offsetDir = (i % 2 === 0) ? 1 : -1;
      const offsetAmount = pos.width * 0.3 * offsetDir;
      const spotX = pos.x + Math.cos(perpAngle) * offsetAmount;
      const spotY = pos.y + Math.sin(perpAngle) * offsetAmount;

      // Cascading pulse effect
      const spotPhase = fish.glowPhase + i * 0.4;
      const spotIntensity = fish.glowIntensity * (0.6 + Math.sin(spotPhase) * 0.4);

      const spotSize = fish.bodyHeight * (0.04 + Math.sin(spotPhase * 0.5) * 0.02);
      const color = colors[i % colors.length]!;
      const rgb = this.colorCalc.hexToRgb(color);

      // Outer glow
      const outerGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize * 2);
      outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity})`);
      outerGradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.5})`);
      outerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      const centerGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize * 0.5);
      centerGradient.addColorStop(0, `rgba(255, 255, 255, ${spotIntensity})`);
      centerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.8})`);

      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add glowing "antenna" lure for anglerfish effect
    const headPos = spine.getPositionAt(0.05);
    const lurePhase = fish.glowPhase * 1.5;
    const lureIntensity = fish.glowIntensity * (0.5 + Math.sin(lurePhase) * 0.5);

    if (lureIntensity > 0.3) {
      const lureX = headPos.x + Math.cos(headPos.angle - Math.PI / 4) * fish.bodyHeight * 0.3;
      const lureY = headPos.y + Math.sin(headPos.angle - Math.PI / 4) * fish.bodyHeight * 0.3;
      const lureSize = fish.bodyHeight * 0.08;

      // Lure glow
      const lureGradient = ctx.createRadialGradient(lureX, lureY, 0, lureX, lureY, lureSize * 3);
      lureGradient.addColorStop(0, `rgba(255, 255, 255, ${lureIntensity})`);
      lureGradient.addColorStop(0.2, `rgba(0, 255, 255, ${lureIntensity * 0.8})`);
      lureGradient.addColorStop(0.5, `rgba(0, 200, 255, ${lureIntensity * 0.4})`);
      lureGradient.addColorStop(1, "rgba(0, 150, 255, 0)");

      ctx.fillStyle = lureGradient;
      ctx.beginPath();
      ctx.arc(lureX, lureY, lureSize * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    if (!fish.hasBioluminescence || fish.glowIntensity <= 0) return;

    // Ambient glow around body
    const glowRadius = Math.max(len, height) * 0.8;

    ctx.save();

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    const glowColor = fish.colors.accent;
    const rgb = this.colorCalc.hexToRgb(glowColor);

    gradient.addColorStop(
      0,
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.3})`
    );
    gradient.addColorStop(
      0.5,
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.1})`
    );
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    if (!fish.hasBioluminescence || fish.glowIntensity <= 0) return;

    const config = this.GLOW_CONFIG;

    ctx.save();

    // Draw glowing spots along body
    for (let i = 0; i < config.spotCount; i++) {
      const t = i / (config.spotCount - 1);
      const x = -len * 0.3 + t * len * 0.6;
      const y = Math.sin(t * Math.PI) * height * 0.15;

      // Pulsing intensity per spot
      const spotPhase = fish.glowPhase + i * 0.5;
      const spotIntensity =
        fish.glowIntensity * (0.5 + Math.sin(spotPhase) * 0.5);

      if (spotIntensity < 0.1) continue;

      const spotSize =
        height * (config.spotSize[0] + Math.random() * (config.spotSize[1] - config.spotSize[0]));
      const color = config.colors[i % config.colors.length]!;
      const rgb = this.colorCalc.hexToRgb(color);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, spotSize);
      gradient.addColorStop(
        0,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity})`
      );
      gradient.addColorStop(
        0.5,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.5})`
      );
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
