/**
 * UFOParticleRenderer - Renders UFO narrative particle effects
 *
 * Handles all particle and effect rendering for UFO behaviors:
 * sample particles, camera flashes, ground dust, afterimages,
 * sleep Zs, celebration effects, and communication pulses.
 */

import type { IUFOParticleRenderer } from "../contracts/IUFOParticleRenderer";
import type { UFOConfig, UFORenderState, Particle } from "../domain/ufo-types";

export class UFOParticleRenderer implements IUFOParticleRenderer {
  drawNarrativeEffects(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig
  ): void {
    // Sample particle traveling up the beam
    if (ufo.sampleParticle) {
      this.drawSampleParticle(ctx, ufo.sampleParticle);
    }

    // Camera flash effect
    if (ufo.cameraFlashTimer > 0) {
      this.drawCameraFlash(ctx, ufo);
    }

    // Ground investigation particles
    if (ufo.groundParticles.length > 0) {
      this.drawGroundParticles(ctx, ufo.groundParticles);
    }

    // Panic afterimages
    if (ufo.afterimagePositions.length > 0) {
      this.drawAfterimages(ctx, ufo, config.colors.shield);
    }

    // Sleep Zs for napping
    if (ufo.sleepZs.length > 0) {
      this.drawSleepZs(ctx, ufo.sleepZs);
    }

    // Celebration rainbow lights
    if (ufo.state === "celebrating") {
      this.drawCelebrationEffects(ctx, ufo);
    }

    // Communication pulses
    if (ufo.state === "communicating" && ufo.commTarget) {
      this.drawCommunicationPulses(ctx, ufo);
    }
  }

  drawSampleParticle(
    ctx: CanvasRenderingContext2D,
    p: Particle
  ): void {
    const glow = 12 + Math.sin(p.progress * Math.PI * 4) * 4;

    // Outer glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    gradient.addColorStop(0, "rgba(251, 191, 36, 0.9)");
    gradient.addColorStop(0.4, "rgba(251, 191, 36, 0.4)");
    gradient.addColorStop(1, "rgba(251, 191, 36, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCameraFlash(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void {
    const flashAlpha = Math.min(1, ufo.cameraFlashTimer / 8);
    const flashRadius = ufo.size * 3;

    const gradient = ctx.createRadialGradient(ufo.x, ufo.y, 0, ufo.x, ufo.y, flashRadius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
    gradient.addColorStop(0.3, `rgba(200, 220, 255, ${flashAlpha * 0.6})`);
    gradient.addColorStop(1, "rgba(200, 220, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ufo.x, ufo.y, flashRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGroundParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[]
  ): void {
    for (const p of particles) {
      const alpha = 1 - p.progress;
      const size = p.size * (1 + p.progress * 0.5);

      // Dust particle
      ctx.fillStyle = `rgba(180, 160, 140, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle for some particles
      if (p.type === "sparkle") {
        ctx.fillStyle = `rgba(255, 230, 180, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawAfterimages(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    shieldColor: string
  ): void {
    for (const img of ufo.afterimagePositions) {
      if (img.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = img.opacity * 0.3;

      // Simple ghost silhouette
      const gradient = ctx.createRadialGradient(
        img.x,
        img.y,
        0,
        img.x,
        img.y,
        ufo.size
      );
      gradient.addColorStop(0, shieldColor);
      gradient.addColorStop(1, "rgba(100, 200, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(img.x, img.y, ufo.size * 0.8, ufo.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawSleepZs(
    ctx: CanvasRenderingContext2D,
    zs: Particle[]
  ): void {
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const z of zs) {
      const alpha = 1 - z.progress;
      const scale = 0.5 + z.progress * 0.8;
      const wobble = Math.sin(z.progress * Math.PI * 3) * 3;

      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.translate(z.x + wobble, z.y);
      ctx.scale(scale, scale);

      // Z shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillText("Z", 1, 1);

      // Z text
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText("Z", 0, 0);

      ctx.restore();
    }
  }

  drawCelebrationEffects(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void {
    const rainbowColors = [
      "#ef4444", // red
      "#f97316", // orange
      "#eab308", // yellow
      "#22c55e", // green
      "#3b82f6", // blue
      "#8b5cf6", // violet
    ];

    // Rainbow ring around UFO
    const ringRadius = ufo.size * 1.5;
    const numLights = 12;

    for (let i = 0; i < numLights; i++) {
      const angle = (i / numLights) * Math.PI * 2 + ufo.rainbowPhase;
      const colorIndex = Math.floor((i / numLights) * rainbowColors.length);
      const color = rainbowColors[colorIndex % rainbowColors.length]!;

      const lx = ufo.x + Math.cos(angle) * ringRadius;
      const ly = ufo.y + Math.sin(angle) * ringRadius * 0.4; // Flatten for perspective

      const pulse = 0.7 + Math.sin(angle * 3 + ufo.celebrationBouncePhase) * 0.3;

      // Light glow
      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, `${color}80`);
      gradient.addColorStop(1, `${color}00`);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  drawCommunicationPulses(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState
  ): void {
    if (!ufo.commTarget) return;

    // Draw a pulsing beam line toward the star
    const currentPulse = ufo.commPattern[ufo.commPatternIndex];
    if (!currentPulse?.isOn) return;

    const dx = ufo.commTarget.x - ufo.x;
    const dy = ufo.commTarget.y - ufo.y;

    // Animated pulse traveling along the beam
    const pulseProgress = (ufo.commPulseTimer % 30) / 30;
    const pulseX = ufo.x + dx * pulseProgress;
    const pulseY = ufo.y + dy * pulseProgress;

    // Beam line (thin)
    ctx.strokeStyle = "rgba(147, 197, 253, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ufo.x, ufo.y);
    ctx.lineTo(ufo.commTarget.x, ufo.commTarget.y);
    ctx.stroke();

    // Traveling pulse
    const pulseSize = 6 + Math.sin(pulseProgress * Math.PI) * 3;
    const gradient = ctx.createRadialGradient(
      pulseX,
      pulseY,
      0,
      pulseX,
      pulseY,
      pulseSize * 2
    );
    gradient.addColorStop(0, "rgba(147, 197, 253, 0.9)");
    gradient.addColorStop(0.5, "rgba(147, 197, 253, 0.4)");
    gradient.addColorStop(1, "rgba(147, 197, 253, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
