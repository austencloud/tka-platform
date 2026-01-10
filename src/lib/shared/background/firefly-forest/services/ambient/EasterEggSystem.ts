/**
 * Easter Egg System
 *
 * Adds delightful ambient details that reward attentive viewers:
 * - Owl silhouettes perched in trees
 * - Bat flocks that occasionally fly across
 * - Moon glow effects
 * - Shooting stars
 * - Glowing eyes in darkness
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export type EasterEggType = "owl" | "bat" | "moon" | "shootingStar" | "glowingEyes";

export interface OwlSilhouette {
  id: string;
  x: number;
  y: number;
  scale: number;
  facing: "left" | "right";
  blinking: boolean;
  blinkTimer: number;
  headTilt: number; // -1 to 1
  silhouettePoints: Array<{ x: number; y: number }>;
}

export interface Bat {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  wingPhase: number;
  scale: number;
}

export interface BatFlock {
  id: string;
  bats: Bat[];
  active: boolean;
  startTime: number;
}

export interface MoonGlow {
  x: number;
  y: number;
  radius: number;
  glowRadius: number;
  phase: number; // 0-1, moon phase (0 = new, 0.5 = full)
  visible: boolean;
}

export interface ShootingStar {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number; // 0-1
  speed: number;
  tailLength: number;
  active: boolean;
}

export interface GlowingEyes {
  id: string;
  x: number;
  y: number;
  separation: number;
  blinkPhase: number;
  intensity: number;
  color: string;
}

export interface EasterEggConfig {
  // Owls
  owlEnabled: boolean;
  maxOwls: number;
  owlBlinkInterval: number; // Seconds between blinks

  // Bats
  batEnabled: boolean;
  batFlockSize: number;
  batSpawnChance: number; // Per second
  batSpeed: number;

  // Moon
  moonEnabled: boolean;
  moonPhase: number; // 0-1
  moonX: number; // 0-1 of width
  moonY: number; // 0-1 of height

  // Shooting stars
  shootingStarsEnabled: boolean;
  shootingStarChance: number; // Per second

  // Glowing eyes
  glowingEyesEnabled: boolean;
  maxGlowingEyes: number;
}

const DEFAULT_CONFIG: EasterEggConfig = {
  owlEnabled: true,
  maxOwls: 2,
  owlBlinkInterval: 4,
  batEnabled: true,
  batFlockSize: 8,
  batSpawnChance: 0.01,
  batSpeed: 150,
  // Moon is now handled by shared MoonRenderer in ProceduralForestSystem
  moonEnabled: false,
  moonPhase: 0.75, // Waning gibbous (legacy, not used)
  moonX: 0.15,
  moonY: 0.12,
  shootingStarsEnabled: true,
  shootingStarChance: 0.02,
  glowingEyesEnabled: true,
  maxGlowingEyes: 3,
};

export class EasterEggSystem {
  private config: EasterEggConfig;
  private noise: PerlinNoise;
  private width: number;
  private height: number;

  // Easter egg instances
  private owls: OwlSilhouette[] = [];
  private batFlocks: BatFlock[] = [];
  private moon: MoonGlow;
  private shootingStars: ShootingStar[] = [];
  private glowingEyes: GlowingEyes[] = [];

  private idCounter = 0;
  private time = 0;

  constructor(
    width: number,
    height: number,
    config: Partial<EasterEggConfig> = {},
    seed?: number
  ) {
    this.width = width;
    this.height = height;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);

    this.moon = this.createMoon();
    this.initializeStaticElements();
  }

  private initializeStaticElements(): void {
    // Initialize owls at random tree positions (to be placed by composer)
    this.owls = [];

    // Initialize glowing eyes
    this.glowingEyes = [];
    if (this.config.glowingEyesEnabled) {
      for (let i = 0; i < this.config.maxGlowingEyes; i++) {
        this.glowingEyes.push(this.createGlowingEyes());
      }
    }
  }

  private createMoon(): MoonGlow {
    const { moonX, moonY, moonPhase } = this.config;
    const radius = Math.min(this.width, this.height) * 0.04;

    return {
      x: this.width * moonX,
      y: this.height * moonY,
      radius,
      glowRadius: radius * 3,
      phase: moonPhase,
      visible: this.config.moonEnabled,
    };
  }

  private createGlowingEyes(): GlowingEyes {
    const x = this.noise.noise2D(this.idCounter * 0.3, 0) * 0.5 + 0.5;
    const y = this.noise.noise2D(this.idCounter * 0.3, 100) * 0.3 + 0.5;

    return {
      id: `eyes-${this.idCounter++}`,
      x: x * this.width,
      y: y * this.height,
      separation: 8 + Math.random() * 8,
      blinkPhase: Math.random() * Math.PI * 2,
      intensity: 0.5 + Math.random() * 0.5,
      color: Math.random() > 0.7 ? "#ff6600" : "#ffff44", // Orange or yellow
    };
  }

  /**
   * Add an owl at a specific position (called by composer when placing trees)
   */
  addOwl(x: number, y: number, scale: number = 1): OwlSilhouette | null {
    if (!this.config.owlEnabled || this.owls.length >= this.config.maxOwls) {
      return null;
    }

    const owl: OwlSilhouette = {
      id: `owl-${this.idCounter++}`,
      x,
      y,
      scale,
      facing: Math.random() > 0.5 ? "left" : "right",
      blinking: false,
      blinkTimer: Math.random() * this.config.owlBlinkInterval,
      headTilt: (Math.random() - 0.5) * 0.3,
      silhouettePoints: this.generateOwlSilhouette(scale),
    };

    this.owls.push(owl);
    return owl;
  }

  private generateOwlSilhouette(scale: number): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const s = scale * 15;

    // Owl body silhouette (stylized, recognizable)
    // Start at bottom left
    points.push({ x: -s * 0.4, y: s * 0.6 });

    // Left side up
    points.push({ x: -s * 0.5, y: s * 0.2 });
    points.push({ x: -s * 0.6, y: -s * 0.1 });

    // Left ear tuft
    points.push({ x: -s * 0.5, y: -s * 0.4 });
    points.push({ x: -s * 0.4, y: -s * 0.6 });
    points.push({ x: -s * 0.25, y: -s * 0.45 });

    // Top of head
    points.push({ x: 0, y: -s * 0.35 });

    // Right ear tuft
    points.push({ x: s * 0.25, y: -s * 0.45 });
    points.push({ x: s * 0.4, y: -s * 0.6 });
    points.push({ x: s * 0.5, y: -s * 0.4 });

    // Right side down
    points.push({ x: s * 0.6, y: -s * 0.1 });
    points.push({ x: s * 0.5, y: s * 0.2 });
    points.push({ x: s * 0.4, y: s * 0.6 });

    // Bottom
    points.push({ x: 0, y: s * 0.7 });

    return points;
  }

  /**
   * Update all easter eggs
   * @param deltaTime Seconds since last update
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    this.updateOwls(deltaTime);
    this.updateBatFlocks(deltaTime);
    this.updateShootingStars(deltaTime);
    this.updateGlowingEyes(deltaTime);
    this.checkForNewEvents(deltaTime);
  }

  private updateOwls(deltaTime: number): void {
    for (const owl of this.owls) {
      owl.blinkTimer -= deltaTime;

      if (owl.blinkTimer <= 0) {
        owl.blinking = true;
        // Reset after brief blink
        setTimeout(() => {
          owl.blinking = false;
        }, 150);
        owl.blinkTimer = this.config.owlBlinkInterval * (0.7 + Math.random() * 0.6);
      }

      // Occasional head tilt
      if (Math.random() < 0.002) {
        owl.headTilt = (Math.random() - 0.5) * 0.4;
      }
    }
  }

  private updateBatFlocks(deltaTime: number): void {
    for (const flock of this.batFlocks) {
      if (!flock.active) continue;

      let allOffscreen = true;

      for (const bat of flock.bats) {
        // Update position
        bat.x += bat.velocityX * deltaTime;
        bat.y += bat.velocityY * deltaTime;

        // Wing flap
        bat.wingPhase += deltaTime * 15;

        // Add some vertical wobble
        bat.y += Math.sin(this.time * 3 + bat.wingPhase) * 20 * deltaTime;

        // Check if still on screen
        if (bat.x > -50 && bat.x < this.width + 50) {
          allOffscreen = false;
        }
      }

      if (allOffscreen) {
        flock.active = false;
      }
    }

    // Clean up inactive flocks
    this.batFlocks = this.batFlocks.filter((f) => f.active);
  }

  private updateShootingStars(deltaTime: number): void {
    for (const star of this.shootingStars) {
      if (!star.active) continue;

      star.progress += star.speed * deltaTime;

      if (star.progress >= 1) {
        star.active = false;
      }
    }

    // Clean up inactive stars
    this.shootingStars = this.shootingStars.filter((s) => s.active);
  }

  private updateGlowingEyes(deltaTime: number): void {
    for (const eyes of this.glowingEyes) {
      eyes.blinkPhase += deltaTime * 0.5;

      // Occasional complete blink
      if (Math.sin(eyes.blinkPhase * 2) < -0.95) {
        eyes.intensity = 0;
      } else {
        eyes.intensity = 0.5 + Math.sin(eyes.blinkPhase) * 0.3;
      }
    }
  }

  private checkForNewEvents(deltaTime: number): void {
    // Spawn bat flock
    if (
      this.config.batEnabled &&
      Math.random() < this.config.batSpawnChance * deltaTime
    ) {
      this.spawnBatFlock();
    }

    // Spawn shooting star
    if (
      this.config.shootingStarsEnabled &&
      Math.random() < this.config.shootingStarChance * deltaTime
    ) {
      this.spawnShootingStar();
    }
  }

  private spawnBatFlock(): void {
    const flock: BatFlock = {
      id: `flock-${this.idCounter++}`,
      bats: [],
      active: true,
      startTime: this.time,
    };

    // Start from left or right
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -30 : this.width + 30;
    const startY = this.height * (0.1 + Math.random() * 0.4);
    const direction = fromLeft ? 1 : -1;

    for (let i = 0; i < this.config.batFlockSize; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;

      flock.bats.push({
        id: `bat-${this.idCounter++}`,
        x: startX + offsetX,
        y: startY + offsetY,
        velocityX: direction * this.config.batSpeed * (0.8 + Math.random() * 0.4),
        velocityY: (Math.random() - 0.5) * 20,
        wingPhase: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.4,
      });
    }

    this.batFlocks.push(flock);
  }

  private spawnShootingStar(): void {
    // Start in upper portion of sky
    const startX = Math.random() * this.width;
    const startY = this.height * (0.05 + Math.random() * 0.2);

    // Diagonal trajectory
    const angle = Math.PI * 0.1 + Math.random() * Math.PI * 0.3;
    const length = 100 + Math.random() * 150;

    this.shootingStars.push({
      id: `star-${this.idCounter++}`,
      startX,
      startY,
      endX: startX + Math.cos(angle) * length,
      endY: startY + Math.sin(angle) * length,
      progress: 0,
      speed: 0.5 + Math.random() * 0.5,
      tailLength: 30 + Math.random() * 50,
      active: true,
    });
  }

  // Getters for rendering

  getOwls(): OwlSilhouette[] {
    return this.owls;
  }

  getBatFlocks(): BatFlock[] {
    return this.batFlocks.filter((f) => f.active);
  }

  getMoon(): MoonGlow {
    return this.moon;
  }

  getShootingStars(): ShootingStar[] {
    return this.shootingStars.filter((s) => s.active);
  }

  getGlowingEyes(): GlowingEyes[] {
    return this.glowingEyes;
  }

  /**
   * Get bat wing points for current wing phase
   */
  getBatWingPoints(
    bat: Bat
  ): { body: Array<{ x: number; y: number }>; leftWing: Array<{ x: number; y: number }>; rightWing: Array<{ x: number; y: number }> } {
    const s = bat.scale * 8;
    const wingAngle = Math.sin(bat.wingPhase) * 0.6;

    // Body (small oval)
    const body = [
      { x: -s * 0.3, y: 0 },
      { x: 0, y: -s * 0.2 },
      { x: s * 0.3, y: 0 },
      { x: 0, y: s * 0.15 },
    ];

    // Wings (triangular, animated)
    const wingExtend = Math.cos(bat.wingPhase) * s * 0.5;

    const leftWing = [
      { x: -s * 0.2, y: 0 },
      { x: -s * 1.2, y: -s * 0.3 + wingExtend },
      { x: -s * 0.8, y: s * 0.2 },
    ];

    const rightWing = [
      { x: s * 0.2, y: 0 },
      { x: s * 1.2, y: -s * 0.3 + wingExtend },
      { x: s * 0.8, y: s * 0.2 },
    ];

    return { body, leftWing, rightWing };
  }

  /**
   * Resize system
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.moon = this.createMoon();
  }

  setConfig(config: Partial<EasterEggConfig>): void {
    this.config = { ...this.config, ...config };
    this.moon = this.createMoon();
  }

  getConfig(): EasterEggConfig {
    return { ...this.config };
  }

  getStats(): {
    owls: number;
    activeBatFlocks: number;
    totalBats: number;
    activeShootingStars: number;
    glowingEyes: number;
  } {
    return {
      owls: this.owls.length,
      activeBatFlocks: this.batFlocks.filter((f) => f.active).length,
      totalBats: this.batFlocks.reduce((sum, f) => sum + f.bats.length, 0),
      activeShootingStars: this.shootingStars.filter((s) => s.active).length,
      glowingEyes: this.glowingEyes.length,
    };
  }
}
