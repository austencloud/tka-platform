/**
 * MoonRenderer - Unified Moon System
 *
 * Features:
 * - Stylized procedural moon with recognizable lunar features
 * - Lunar maria (dark "seas") and prominent craters including Tycho with rays
 * - Real lunar cycle calculations (shows actual current moon phase)
 * - Configurable color temperature (warm/cool tint)
 * - Smooth glow with no banding
 *
 * Can be used by any background system.
 */

import type { Dimensions } from "../domain/types/background-types";

// Lunar cycle constants
const SYNODIC_MONTH_DAYS = 29.53058868;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_LUNAR_CYCLE = SYNODIC_MONTH_DAYS * MS_PER_DAY;
const REFERENCE_NEW_MOON = new Date("2024-01-11T11:57:00Z").getTime();


export type MoonType = "realistic" | "full" | "crescent";
export type MoonColorTemp = "warm" | "cool";

export interface MoonConfig {
  /** Moon rendering type */
  type: MoonType;
  /** X position as fraction of width (0-1) */
  x: number;
  /** Y position as fraction of height (0-1) */
  y: number;
  /** Radius as fraction of min(width, height) */
  radiusFraction: number;
  /** Maximum radius in pixels */
  maxRadius: number;
  /** Glow multiplier (1 = normal, higher = more glow) */
  glowIntensity: number;
  /** Whether to use real lunar phase (only for 'realistic' type) */
  useRealPhase: boolean;
  /** Static phase value if not using real phase (0 = new, 0.5 = full, 1 = new again) */
  staticPhase: number;
  /** Color temperature preset */
  colorTemp: MoonColorTemp;
  /** Enable breathing animation */
  animated: boolean;
  /** Crescent rotation in radians (for crescent type) */
  crescentRotation: number;
  /** Detail level for surface features (0-1, 0=minimal, 1=full detail) */
  detailLevel: number;
  /** Darkness of maria/craters (0-1, 0=subtle, 1=dark) */
  surfaceDarkness: number;
  /** How far features extend toward the edge (0-1) */
  featureSpread: number;
}

export interface MoonState {
  x: number;
  y: number;
  radius: number;
  phase: number;
  illuminationFraction: number;
  isWaxing: boolean;
  visible: boolean;
}

// Color presets for glow and shadow
const COLOR_PRESETS: Record<MoonColorTemp, {
  glowColor: string;
  shadowColor: string;
  tintFilter: string;
}> = {
  warm: {
    glowColor: "rgba(255, 250, 240, 0.25)",
    shadowColor: "rgba(20, 15, 10, 0.92)",
    tintFilter: "sepia(15%) saturate(110%)",
  },
  cool: {
    glowColor: "rgba(220, 230, 255, 0.25)",
    shadowColor: "rgba(15, 20, 30, 0.92)",
    tintFilter: "saturate(90%) hue-rotate(10deg)",
  },
};

const DEFAULT_CONFIG: MoonConfig = {
  type: "realistic",
  x: 0.15,
  y: 0.12,
  radiusFraction: 0.04,
  maxRadius: 80,
  glowIntensity: 1,
  useRealPhase: true,
  staticPhase: 0.5,
  colorTemp: "cool",
  animated: false,
  crescentRotation: 0,
  detailLevel: 0.7,
  surfaceDarkness: 0.5,
  featureSpread: 0.7,
};

export class MoonRenderer {
  private config: MoonConfig;
  private state: MoonState;
  private width: number;
  private height: number;
  private colors: typeof COLOR_PRESETS.warm;
  private animationPhase: number = 0;

  constructor(
    width: number = 1920,
    height: number = 1080,
    config: Partial<MoonConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.width = width;
    this.height = height;
    this.colors = COLOR_PRESETS[this.config.colorTemp];
    this.state = this.calculateState();
    this.animationPhase = Math.random() * Math.PI * 2;
  }

  private calculateState(): MoonState {
    const { x, y, radiusFraction, maxRadius, useRealPhase, staticPhase, type } = this.config;

    const posX = this.width * x;
    const posY = this.height * y;
    const baseSize = Math.min(this.width, this.height);
    const radius = Math.min(baseSize * radiusFraction, maxRadius);

    let phase: number;
    let illuminationFraction: number;
    let isWaxing: boolean;

    if (type === "full") {
      phase = 0.5;
      illuminationFraction = 1;
      isWaxing = false;
    } else if (type === "crescent") {
      phase = staticPhase;
      const phaseAngle = phase * 2 * Math.PI;
      illuminationFraction = (1 - Math.cos(phaseAngle)) / 2;
      isWaxing = phase < 0.5;
    } else if (useRealPhase) {
      const phaseData = this.calculateRealLunarPhase();
      phase = phaseData.phase;
      illuminationFraction = phaseData.illuminationFraction;
      isWaxing = phaseData.isWaxing;
    } else {
      phase = staticPhase;
      const phaseAngle = phase * 2 * Math.PI;
      illuminationFraction = (1 - Math.cos(phaseAngle)) / 2;
      isWaxing = phase < 0.5;
    }

    return {
      x: posX,
      y: posY,
      radius,
      phase,
      illuminationFraction,
      isWaxing,
      visible: true,
    };
  }

  private calculateRealLunarPhase(): {
    phase: number;
    illuminationFraction: number;
    isWaxing: boolean;
  } {
    const currentTime = Date.now();
    const timeSinceNewMoon = currentTime - REFERENCE_NEW_MOON;
    const phase = (((timeSinceNewMoon / MS_PER_LUNAR_CYCLE) % 1) + 1) % 1;
    const isWaxing = phase < 0.5;
    const phaseAngle = phase * 2 * Math.PI;
    const illuminationFraction = (1 - Math.cos(phaseAngle)) / 2;
    return { phase, illuminationFraction, isWaxing };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.state.visible) return;

    const { x, y, radius, illuminationFraction, isWaxing } = this.state;

    ctx.save();

    // Calculate glow pulse if animated
    const glowPulse = this.config.animated
      ? 1 + Math.sin(this.animationPhase) * 0.05
      : 1;

    // Draw glow
    this.drawGlow(ctx, x, y, radius, glowPulse);

    // Draw moon with texture
    this.drawMoonWithTexture(ctx, x, y, radius, illuminationFraction, isWaxing);

    ctx.restore();
  }

  private drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    pulse: number
  ): void {
    const glowRadius = radius * 3.5 * this.config.glowIntensity * pulse;

    // Smooth gradient with many stops to prevent banding
    const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowRadius);
    const stops = 20;

    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const opacity = 0.25 * Math.pow(1 - t, 2.5) * this.config.glowIntensity;
      if (this.config.colorTemp === "warm") {
        gradient.addColorStop(t, `rgba(255, 250, 240, ${opacity})`);
      } else {
        gradient.addColorStop(t, `rgba(220, 230, 255, ${opacity})`);
      }
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMoonWithTexture(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    illuminationFraction: number,
    isWaxing: boolean
  ): void {
    // Stylized moon - soft gradients with recognizable lunar features
    // Cartoonish aesthetic that matches the dreamy scene

    const isWarm = this.config.colorTemp === "warm";

    // Base moon gradient - soft cream/white with highlight offset
    const baseGradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );

    if (isWarm) {
      baseGradient.addColorStop(0, "#fffef5");
      baseGradient.addColorStop(0.5, "#faf6e8");
      baseGradient.addColorStop(0.85, "#f0e8d8");
      baseGradient.addColorStop(1, "#e5dcc8");
    } else {
      baseGradient.addColorStop(0, "#f8faff");
      baseGradient.addColorStop(0.5, "#eef2fa");
      baseGradient.addColorStop(0.85, "#dce4f0");
      baseGradient.addColorStop(1, "#c8d4e8");
    }

    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Clip to moon for all surface features
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.98, 0, Math.PI * 2);
    ctx.clip();

    // Draw stylized lunar maria (dark "seas")
    this.drawLunarMaria(ctx, x, y, radius, isWarm);

    // Draw prominent craters
    this.drawCraters(ctx, x, y, radius, isWarm);

    ctx.restore();

    // Soft limb darkening
    const limbGradient = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius);
    limbGradient.addColorStop(0, "transparent");
    limbGradient.addColorStop(0.8, "transparent");
    limbGradient.addColorStop(1, "rgba(0, 0, 0, 0.12)");

    ctx.fillStyle = limbGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw phase shadow if not full moon
    if (illuminationFraction < 0.98) {
      this.drawPhaseShadow(ctx, x, y, radius, illuminationFraction, isWaxing);
    }
  }

  private drawLunarMaria(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isWarm: boolean
  ): void {
    const { detailLevel, surfaceDarkness, featureSpread } = this.config;

    // Base colors adjusted by surfaceDarkness (0.5 = default, 1 = darker)
    const darknessMult = 0.6 + surfaceDarkness * 0.8; // 0.6-1.4 range
    const baseR = isWarm ? 120 : 80;
    const baseG = isWarm ? 100 : 90;
    const baseB = isWarm ? 70 : 115;
    const mariaColor = `${Math.round(baseR / darknessMult)}, ${Math.round(baseG / darknessMult)}, ${Math.round(baseB / darknessMult)}`;
    const mariaColorLight = isWarm
      ? `${Math.round(150 / darknessMult)}, ${Math.round(130 / darknessMult)}, ${Math.round(100 / darknessMult)}`
      : `${Math.round(110 / darknessMult)}, ${Math.round(120 / darknessMult)}, ${Math.round(140 / darknessMult)}`;

    // Opacity scales with darkness setting
    const opacityMult = 0.7 + surfaceDarkness * 0.6; // 0.7-1.3 range

    // Spread factor moves features toward/away from edge
    const spread = 0.6 + featureSpread * 0.5; // 0.6-1.1 range

    // Mare Imbrium (Sea of Rains) - large, upper left
    this.drawMare(ctx, x - radius * 0.35 * spread, y - radius * 0.25, radius * 0.42, mariaColor, 0.18 * opacityMult);
    if (detailLevel > 0.3) {
      this.drawMare(ctx, x - radius * 0.32 * spread, y - radius * 0.22, radius * 0.25, mariaColor, 0.08 * opacityMult);
    }

    // Mare Serenitatis (Sea of Serenity) - upper right
    this.drawMare(ctx, x + radius * 0.15 * spread, y - radius * 0.35, radius * 0.3, mariaColor, 0.16 * opacityMult);

    // Mare Tranquillitatis (Sea of Tranquility) - right side
    this.drawMare(ctx, x + radius * 0.3 * spread, y + radius * 0.05, radius * 0.34, mariaColor, 0.17 * opacityMult);
    if (detailLevel > 0.4) {
      this.drawMare(ctx, x + radius * 0.2 * spread, y - radius * 0.15, radius * 0.18, mariaColorLight, 0.1 * opacityMult);
    }

    // Mare Crisium (Sea of Crises) - far right, isolated
    this.drawMare(ctx, x + radius * 0.58 * spread, y - radius * 0.22, radius * 0.2, mariaColor, 0.2 * opacityMult);

    // Oceanus Procellarum (Ocean of Storms) - left side, largest
    this.drawMare(ctx, x - radius * 0.5 * spread, y + radius * 0.1, radius * 0.38, mariaColor, 0.15 * opacityMult);
    if (detailLevel > 0.5) {
      this.drawMare(ctx, x - radius * 0.45 * spread, y - radius * 0.1, radius * 0.22, mariaColorLight, 0.1 * opacityMult);
    }

    // Mare Nubium (Sea of Clouds) - bottom left
    if (detailLevel > 0.2) {
      this.drawMare(ctx, x - radius * 0.2 * spread, y + radius * 0.45 * spread, radius * 0.28, mariaColor, 0.14 * opacityMult);
    }

    // Mare Fecunditatis (Sea of Fertility) - lower right
    if (detailLevel > 0.3) {
      this.drawMare(ctx, x + radius * 0.42 * spread, y + radius * 0.38 * spread, radius * 0.24, mariaColor, 0.15 * opacityMult);
    }

    // Mare Frigoris (Sea of Cold) - northern edge
    if (detailLevel > 0.6) {
      this.drawMare(ctx, x + radius * 0.05, y - radius * 0.6 * spread, radius * 0.3, mariaColorLight, 0.1 * opacityMult);
    }
  }

  private drawMare(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    colorRgb: string,
    opacity: number
  ): void {
    // Draw a soft, irregular mare shape
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, `rgba(${colorRgb}, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(${colorRgb}, ${opacity * 0.7})`);
    gradient.addColorStop(0.8, `rgba(${colorRgb}, ${opacity * 0.3})`);
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCraters(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isWarm: boolean
  ): void {
    const { detailLevel, surfaceDarkness, featureSpread } = this.config;

    // Colors adjusted by darkness
    const darknessMult = 0.6 + surfaceDarkness * 0.8;
    const craterColor = isWarm
      ? `${Math.round(180 / darknessMult)}, ${Math.round(165 / darknessMult)}, ${Math.round(140 / darknessMult)}`
      : `${Math.round(150 / darknessMult)}, ${Math.round(160 / darknessMult)}, ${Math.round(185 / darknessMult)}`;
    const rimColor = isWarm ? "255, 250, 240" : "240, 245, 255";
    const darkFloorColor = isWarm
      ? `${Math.round(100 / darknessMult)}, ${Math.round(85 / darknessMult)}, ${Math.round(60 / darknessMult)}`
      : `${Math.round(70 / darknessMult)}, ${Math.round(80 / darknessMult)}, ${Math.round(100 / darknessMult)}`;

    const opacityMult = 0.7 + surfaceDarkness * 0.6;
    const spread = 0.6 + featureSpread * 0.5;

    // Tycho - prominent crater at bottom with rays (always shown)
    this.drawCrater(ctx, x - radius * 0.1, y + radius * 0.65 * spread, radius * 0.1, craterColor, rimColor, 0.2 * opacityMult);
    if (detailLevel > 0.2) {
      this.drawTychoRays(ctx, x - radius * 0.1, y + radius * 0.65 * spread, radius, isWarm);
    }

    // Copernicus - center-left, prominent with rays
    if (detailLevel > 0.1) {
      this.drawCrater(ctx, x - radius * 0.25 * spread, y + radius * 0.1, radius * 0.09, craterColor, rimColor, 0.18 * opacityMult);
      if (detailLevel > 0.4) {
        this.drawCraterRays(ctx, x - radius * 0.25 * spread, y + radius * 0.1, radius * 0.5, 5, isWarm);
      }
    }

    // Kepler - left side, smaller with faint rays
    if (detailLevel > 0.3) {
      this.drawCrater(ctx, x - radius * 0.55 * spread, y - radius * 0.05, radius * 0.06, craterColor, rimColor, 0.15 * opacityMult);
      if (detailLevel > 0.5) {
        this.drawCraterRays(ctx, x - radius * 0.55 * spread, y - radius * 0.05, radius * 0.3, 4, isWarm);
      }
    }

    // Aristarchus - brightest crater, left side
    if (detailLevel > 0.4) {
      this.drawCrater(ctx, x - radius * 0.62 * spread, y - radius * 0.25, radius * 0.05, craterColor, rimColor, 0.22 * opacityMult);
    }

    // Plato - dark-floored crater near Mare Imbrium
    if (detailLevel > 0.2) {
      this.drawCrater(ctx, x - radius * 0.12 * spread, y - radius * 0.55 * spread, radius * 0.07, darkFloorColor, rimColor, 0.25 * opacityMult);
    }

    // Grimaldi - dark crater on western limb
    if (detailLevel > 0.5) {
      this.drawCrater(ctx, x - radius * 0.75 * spread, y + radius * 0.15, radius * 0.06, darkFloorColor, rimColor, 0.2 * opacityMult);
    }

    // Smaller highland craters for texture
    if (detailLevel > 0.6) {
      this.drawCrater(ctx, x + radius * 0.5 * spread, y + radius * 0.55 * spread, radius * 0.04, craterColor, rimColor, 0.12 * opacityMult);
      this.drawCrater(ctx, x + radius * 0.35 * spread, y - radius * 0.5 * spread, radius * 0.035, craterColor, rimColor, 0.1 * opacityMult);
      this.drawCrater(ctx, x - radius * 0.4 * spread, y + radius * 0.55 * spread, radius * 0.045, craterColor, rimColor, 0.12 * opacityMult);
    }
  }

  private drawCrater(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    floorColor: string,
    rimColor: string,
    opacity: number = 0.15
  ): void {
    // Crater floor (darker center)
    const floorGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.85);
    floorGradient.addColorStop(0, `rgba(${floorColor}, ${opacity})`);
    floorGradient.addColorStop(0.6, `rgba(${floorColor}, ${opacity * 0.6})`);
    floorGradient.addColorStop(1, "transparent");

    ctx.fillStyle = floorGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Bright rim highlight (upper-left lit)
    const rimGradient = ctx.createRadialGradient(
      cx - r * 0.3, cy - r * 0.3, r * 0.5,
      cx, cy, r
    );
    rimGradient.addColorStop(0, "transparent");
    rimGradient.addColorStop(0.6, "transparent");
    rimGradient.addColorStop(0.8, `rgba(${rimColor}, ${opacity * 1.2})`);
    rimGradient.addColorStop(0.95, `rgba(${rimColor}, ${opacity * 0.5})`);
    rimGradient.addColorStop(1, "transparent");

    ctx.fillStyle = rimGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Shadow on lower-right (opposite the light)
    const shadowGradient = ctx.createRadialGradient(
      cx + r * 0.3, cy + r * 0.3, r * 0.5,
      cx, cy, r
    );
    shadowGradient.addColorStop(0, "transparent");
    shadowGradient.addColorStop(0.7, "transparent");
    shadowGradient.addColorStop(0.9, `rgba(0, 0, 0, ${opacity * 0.4})`);
    shadowGradient.addColorStop(1, "transparent");

    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCraterRays(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rayLength: number,
    numRays: number,
    isWarm: boolean
  ): void {
    const rayColor = isWarm ? "255, 250, 240" : "240, 245, 255";

    ctx.save();

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2 + Math.random() * 0.3;
      const length = rayLength * (0.6 + Math.random() * 0.4);
      const width = rayLength * 0.025;

      const endX = cx + Math.cos(angle) * length;
      const endY = cy + Math.sin(angle) * length;

      const rayGradient = ctx.createLinearGradient(cx, cy, endX, endY);
      rayGradient.addColorStop(0, `rgba(${rayColor}, 0.1)`);
      rayGradient.addColorStop(0.4, `rgba(${rayColor}, 0.05)`);
      rayGradient.addColorStop(1, "transparent");

      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = width;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawTychoRays(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    moonRadius: number,
    isWarm: boolean
  ): void {
    // Tycho's distinctive ray system - bright streaks emanating from crater
    const rayColor = isWarm ? "255, 252, 245" : "245, 248, 255";
    const numRays = 10;

    ctx.save();

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2 + Math.PI * 0.1;
      const rayLength = moonRadius * (0.5 + Math.random() * 0.4);
      const rayWidth = moonRadius * 0.025;

      const endX = cx + Math.cos(angle) * rayLength;
      const endY = cy + Math.sin(angle) * rayLength;

      // Create tapered ray gradient
      const rayGradient = ctx.createLinearGradient(cx, cy, endX, endY);
      rayGradient.addColorStop(0, `rgba(${rayColor}, 0.2)`);
      rayGradient.addColorStop(0.25, `rgba(${rayColor}, 0.12)`);
      rayGradient.addColorStop(0.6, `rgba(${rayColor}, 0.05)`);
      rayGradient.addColorStop(1, "transparent");

      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = rayWidth;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPhaseShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    illuminationFraction: number,
    isWaxing: boolean
  ): void {
    ctx.save();

    // Clip to moon circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    // Shadow offset: slides from covering all (0%) to outside (100%)
    const shadowOffset = 2 * illuminationFraction * radius;
    const direction = isWaxing ? -1 : 1;

    ctx.fillStyle = this.colors.shadowColor;
    ctx.beginPath();
    ctx.arc(x + shadowOffset * direction, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ============================================
  // LIFECYCLE METHODS
  // ============================================

  initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.state = this.calculateState();
  }

  update(frameMultiplier: number = 1.0): void {
    if (this.config.animated) {
      this.animationPhase += 0.003 * frameMultiplier;
    }

    if (this.config.useRealPhase && this.config.type === "realistic") {
      const phaseData = this.calculateRealLunarPhase();
      this.state.phase = phaseData.phase;
      this.state.illuminationFraction = phaseData.illuminationFraction;
      this.state.isWaxing = phaseData.isWaxing;
    }
  }

  draw(ctx: CanvasRenderingContext2D, _dimensions?: Dimensions): void {
    this.render(ctx);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.state = this.calculateState();
  }

  setConfig(config: Partial<MoonConfig>): void {
    this.config = { ...this.config, ...config };
    this.colors = COLOR_PRESETS[this.config.colorTemp];
    this.state = this.calculateState();
  }

  setVisible(visible: boolean): void {
    this.state.visible = visible;
  }

  getState(): MoonState {
    return { ...this.state };
  }

  getConfig(): MoonConfig {
    return { ...this.config };
  }

  getPhaseName(): string {
    const { phase } = this.state;
    if (phase < 0.03 || phase > 0.97) return "New Moon";
    if (phase < 0.22) return "Waxing Crescent";
    if (phase < 0.28) return "First Quarter";
    if (phase < 0.47) return "Waxing Gibbous";
    if (phase < 0.53) return "Full Moon";
    if (phase < 0.72) return "Waning Gibbous";
    if (phase < 0.78) return "Last Quarter";
    return "Waning Crescent";
  }

  getIlluminationPercent(): number {
    return Math.round(this.state.illuminationFraction * 100);
  }

  cleanup(): void {
    this.animationPhase = 0;
  }

  /** Refresh phase calculation (for backwards compatibility) */
  refreshPhase(): void {
    if (this.config.useRealPhase && this.config.type === "realistic") {
      const phaseData = this.calculateRealLunarPhase();
      this.state.phase = phaseData.phase;
      this.state.illuminationFraction = phaseData.illuminationFraction;
      this.state.isWaxing = phaseData.isWaxing;
    }
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/** Create a full moon with texture (for cherry blossom, etc) */
export function createFullMoon(options: Partial<MoonConfig> = {}): MoonRenderer {
  return new MoonRenderer(1920, 1080, {
    type: "full",
    colorTemp: "warm",
    radiusFraction: 0.06,
    glowIntensity: 1.2,
    animated: true,
    ...options,
  });
}

/** Create a crescent moon (for firefly forest, etc) */
export function createCrescentMoon(options: Partial<MoonConfig> = {}): MoonRenderer {
  return new MoonRenderer(1920, 1080, {
    type: "crescent",
    colorTemp: "cool",
    radiusFraction: 0.04,
    glowIntensity: 1,
    staticPhase: 0.15,
    ...options,
  });
}

/** Create a moon that shows real lunar phase */
export function createRealisticMoon(options: Partial<MoonConfig> = {}): MoonRenderer {
  return new MoonRenderer(1920, 1080, {
    type: "realistic",
    useRealPhase: true,
    colorTemp: "cool",
    radiusFraction: 0.04,
    glowIntensity: 1,
    ...options,
  });
}
