import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  LightRay,
  LightDustParticle,
  CausticsState,
  CausticCell,
} from "../../domain/models/DeepOceanModels";
import type { ILightRayCalculator } from "../contracts/ILightRayCalculator";

/**
 * Light Ray Configuration
 * Tuned for beautiful, ethereal underwater light
 */
const LIGHT_RAY_CONFIG = {
  // Dimensions
  width: { min: 15, max: 40 },

  // Opacity
  baseOpacity: { min: 0.06, max: 0.15 },
  intensityVariation: 0.04, // How much opacity pulses
  intensitySpeed: { min: 0.0008, max: 0.002 },

  // Angle
  angle: { min: -8, max: 8 }, // Degrees

  // Wave distortion
  waveAmplitude: { min: 3, max: 12 }, // Pixels of sway
  waveSpeed: { min: 0.0015, max: 0.004 },

  // Volumetric
  glowIntensity: { min: 0.3, max: 0.6 },
  depthFade: { min: 0.55, max: 0.75 },

  // Color shift
  colorShiftSpeed: { min: 0.0005, max: 0.0015 },

  // Dappled edges
  edgeSeedCount: 8,

  // Dust particles
  dustPerRay: { min: 3, max: 8 },
  dustSize: { min: 0.5, max: 2 },
  dustOpacity: { min: 0.15, max: 0.4 },
  dustDrift: { min: 0.002, max: 0.008 },
  dustPhaseSpeed: { min: 0.01, max: 0.03 },
};

const CAUSTICS_CONFIG = {
  // Grid
  cellsPerRow: 6,
  cellsPerColumn: 4,
  cellSize: { min: 50, max: 100 }, // Larger cells for visibility

  // Animation
  intensity: { min: 0.15, max: 0.35 }, // Boosted from 0.02-0.06 for visibility
  speed: { min: 0.008, max: 0.02 },
  driftSpeed: 0.3, // Pixels per frame

  // Global phase
  globalSpeed: 0.003,
};

export class LightRayCalculator implements ILightRayCalculator {
  initializeLightRays(dimensions: Dimensions, count: number): LightRay[] {
    const lightRays: LightRay[] = [];

    for (let i = 0; i < count; i++) {
      const baseX =
        (i / count) * dimensions.width +
        Math.random() * (dimensions.width / count);

      lightRays.push(this.createLightRay(baseX, dimensions));
    }

    return lightRays;
  }

  private createLightRay(baseX: number, dimensions: Dimensions): LightRay {
    const baseWidth = this.randomInRange(
      LIGHT_RAY_CONFIG.width.min,
      LIGHT_RAY_CONFIG.width.max
    );
    const baseOpacity = this.randomInRange(
      LIGHT_RAY_CONFIG.baseOpacity.min,
      LIGHT_RAY_CONFIG.baseOpacity.max
    );

    return {
      // Position
      x: baseX,
      baseX,

      // Dimensions
      width: baseWidth,
      baseWidth,

      // Angle
      angle: this.randomInRange(
        LIGHT_RAY_CONFIG.angle.min,
        LIGHT_RAY_CONFIG.angle.max
      ),
      wavePhase: Math.random() * Math.PI * 2,
      waveAmplitude: this.randomInRange(
        LIGHT_RAY_CONFIG.waveAmplitude.min,
        LIGHT_RAY_CONFIG.waveAmplitude.max
      ),
      waveSpeed: this.randomInRange(
        LIGHT_RAY_CONFIG.waveSpeed.min,
        LIGHT_RAY_CONFIG.waveSpeed.max
      ),

      // Opacity
      opacity: baseOpacity,
      baseOpacity,
      intensityPhase: Math.random() * Math.PI * 2,
      intensitySpeed: this.randomInRange(
        LIGHT_RAY_CONFIG.intensitySpeed.min,
        LIGHT_RAY_CONFIG.intensitySpeed.max
      ),

      // Animation
      phase: Math.random() * Math.PI * 2,
      speed: 0.001 + Math.random() * 0.002,

      // Volumetric
      glowIntensity: this.randomInRange(
        LIGHT_RAY_CONFIG.glowIntensity.min,
        LIGHT_RAY_CONFIG.glowIntensity.max
      ),
      depthFade: this.randomInRange(
        LIGHT_RAY_CONFIG.depthFade.min,
        LIGHT_RAY_CONFIG.depthFade.max
      ),

      // Color
      colorShiftPhase: Math.random() * Math.PI * 2,
      colorShiftSpeed: this.randomInRange(
        LIGHT_RAY_CONFIG.colorShiftSpeed.min,
        LIGHT_RAY_CONFIG.colorShiftSpeed.max
      ),

      // Dappled edges
      edgeSeeds: Array.from(
        { length: LIGHT_RAY_CONFIG.edgeSeedCount },
        () => Math.random()
      ),

      // Dust particles
      dustParticles: this.createDustParticles(dimensions),
    };
  }

  private createDustParticles(dimensions: Dimensions): LightDustParticle[] {
    const count = this.randomIntInRange(
      LIGHT_RAY_CONFIG.dustPerRay.min,
      LIGHT_RAY_CONFIG.dustPerRay.max
    );

    const particles: LightDustParticle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 30, // Within ray width
        y: Math.random() * dimensions.height * 0.5, // Top half of ray
        size: this.randomInRange(
          LIGHT_RAY_CONFIG.dustSize.min,
          LIGHT_RAY_CONFIG.dustSize.max
        ),
        opacity: this.randomInRange(
          LIGHT_RAY_CONFIG.dustOpacity.min,
          LIGHT_RAY_CONFIG.dustOpacity.max
        ),
        drift: this.randomInRange(
          LIGHT_RAY_CONFIG.dustDrift.min,
          LIGHT_RAY_CONFIG.dustDrift.max
        ),
        phase: Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }

  updateLightRays(
    lightRays: LightRay[],
    frameMultiplier: number
  ): LightRay[] {
    return lightRays.map((ray) => {
      // Update phases
      const newWavePhase = ray.wavePhase + ray.waveSpeed * frameMultiplier;
      const newIntensityPhase =
        ray.intensityPhase + ray.intensitySpeed * frameMultiplier;
      const newColorShiftPhase =
        ray.colorShiftPhase + ray.colorShiftSpeed * frameMultiplier;
      const newPhase = ray.phase + ray.speed * frameMultiplier;

      // Calculate wave distortion (ray sways like water surface is moving)
      const waveOffset = Math.sin(newWavePhase) * ray.waveAmplitude;
      const newX = ray.baseX + waveOffset;

      // Calculate intensity variation (clouds passing, etc.)
      const intensityMod =
        1 + Math.sin(newIntensityPhase) * LIGHT_RAY_CONFIG.intensityVariation;
      const newOpacity = ray.baseOpacity * intensityMod;

      // Width pulsing (subtle)
      const widthMod = 1 + Math.sin(newPhase * 0.5) * 0.05;
      const newWidth = ray.baseWidth * widthMod;

      // Update dust particles
      const updatedDust = ray.dustParticles.map((dust) => {
        const newDustPhase = dust.phase + LIGHT_RAY_CONFIG.dustPhaseSpeed.max * frameMultiplier;
        const newDustX = dust.x + Math.sin(newDustPhase) * dust.drift * frameMultiplier;
        return {
          ...dust,
          x: newDustX,
          phase: newDustPhase,
        };
      });

      return {
        ...ray,
        x: newX,
        width: newWidth,
        opacity: newOpacity,
        wavePhase: newWavePhase,
        intensityPhase: newIntensityPhase,
        colorShiftPhase: newColorShiftPhase,
        phase: newPhase,
        dustParticles: updatedDust,
      };
    });
  }

  // Caustics initialization and update
  initializeCaustics(dimensions: Dimensions): CausticsState {
    const cells: CausticCell[] = [];
    const { cellsPerRow, cellsPerColumn } = CAUSTICS_CONFIG;

    for (let row = 0; row < cellsPerColumn; row++) {
      for (let col = 0; col < cellsPerRow; col++) {
        const cellWidth = dimensions.width / cellsPerRow;
        const cellHeight = dimensions.height / cellsPerColumn;

        cells.push({
          // Spread caustics across the full cell to avoid visible grid lines
          x: col * cellWidth + Math.random() * cellWidth,
          y: row * cellHeight + Math.random() * cellHeight,
          size: this.randomInRange(
            CAUSTICS_CONFIG.cellSize.min,
            CAUSTICS_CONFIG.cellSize.max
          ),
          intensity: this.randomInRange(
            CAUSTICS_CONFIG.intensity.min,
            CAUSTICS_CONFIG.intensity.max
          ),
          phase: Math.random() * Math.PI * 2,
          speed: this.randomInRange(
            CAUSTICS_CONFIG.speed.min,
            CAUSTICS_CONFIG.speed.max
          ),
        });
      }
    }

    return {
      cells,
      globalPhase: 0,
      driftX: 0,
      driftY: 0,
    };
  }

  updateCaustics(
    caustics: CausticsState,
    dimensions: Dimensions,
    frameMultiplier: number
  ): CausticsState {
    // Update global phase
    const newGlobalPhase =
      caustics.globalPhase + CAUSTICS_CONFIG.globalSpeed * frameMultiplier;

    // Update drift (slow movement across screen)
    let newDriftX = caustics.driftX + CAUSTICS_CONFIG.driftSpeed * frameMultiplier;
    let newDriftY = caustics.driftY + CAUSTICS_CONFIG.driftSpeed * 0.3 * frameMultiplier;

    // Wrap drift
    if (newDriftX > dimensions.width / CAUSTICS_CONFIG.cellsPerRow) {
      newDriftX = 0;
    }
    if (newDriftY > dimensions.height / CAUSTICS_CONFIG.cellsPerColumn) {
      newDriftY = 0;
    }

    // Update individual cells
    const updatedCells = caustics.cells.map((cell) => ({
      ...cell,
      phase: cell.phase + cell.speed * frameMultiplier,
    }));

    return {
      cells: updatedCells,
      globalPhase: newGlobalPhase,
      driftX: newDriftX,
      driftY: newDriftY,
    };
  }

  getLightRayCount(quality: string): number {
    switch (quality) {
      case "minimal":
        return 0;
      case "low":
        return 2;
      case "medium":
        return 4;
      case "high":
        return 6;
      default:
        return 4;
    }
  }

  getCausticsEnabled(quality: string): boolean {
    return quality === "medium" || quality === "high";
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomIntInRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
