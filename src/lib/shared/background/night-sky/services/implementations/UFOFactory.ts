/**
 * UFOFactory - Creates fully initialized UFO instances
 *
 * Extracted from UFOSystem.spawnUFO() - handles all the complex
 * initialization logic for UFO state objects.
 */

import type { IUFOFactory, UFOSpawnParams } from "../contracts/IUFOFactory";
import type { INightSkyCalculationService } from "../contracts/INightSkyCalculationService";
import type { UFO, UFOEntranceType, UFOExitType } from "../domain/ufo-types";

const ENTRANCE_TYPES: UFOEntranceType[] = ["fade", "warp", "zoom", "descend"];
const EXIT_TYPES: UFOExitType[] = ["fade", "warp", "zoom", "shootUp"];

export class UFOFactory implements IUFOFactory {
  constructor(private calculationService: INightSkyCalculationService) {}

  create(params: UFOSpawnParams): UFO {
    const { dimensions: dim, config, entranceType, exitType } = params;
    const margin = dim.width * config.bounceMargin * 1.5;

    // Pick random entrance/exit types if not specified
    const entrance = entranceType ?? this.pickRandom(ENTRANCE_TYPES);
    const exit = exitType ?? this.pickRandom(EXIT_TYPES);

    // Calculate position based on entrance type
    const position = this.calculateSpawnPosition(dim, config, entrance, margin);

    // Calculate initial visual state based on entrance type
    const visuals = this.getInitialVisuals(entrance);

    // Random initial heading and turn rate
    const heading = Math.random() * Math.PI * 2;
    const turnSpeed = config.turnSpeed ?? 0.003;
    const turnVariation = config.turnVariation ?? 0.5;
    const turnRate = (Math.random() - 0.5) * 2 * turnSpeed * turnVariation;

    // Calculate active duration
    const activeDuration = this.calculationService.randInt(
      config.minActiveDuration,
      config.maxActiveDuration
    );

    // Decide initial movement style
    const startsDrifting = Math.random() < (config.driftChance ?? 0.15);

    // Start at mid-depth (0.4-0.6) for natural appearance
    const initialDepth = 0.4 + Math.random() * 0.2;

    return {
      // Position
      x: position.x,
      y: position.y,
      z: initialDepth,
      size: config.size,

      // Depth targeting
      targetZ: initialDepth,

      // Movement
      heading,
      turnRate,
      isDrifting: startsDrifting,

      // State machine
      state: "entering",
      stateTimer: 0,
      stateDuration: config.enterDuration,
      activeDuration,
      totalTime: 0,

      // Entrance/exit
      entranceType: entrance,
      exitType: exit,
      targetY: position.targetY,
      startY: position.startY,

      // Visual properties
      opacity: visuals.opacity,
      scale: visuals.scale,
      flashIntensity: entrance === "warp" ? 1 : 0,
      decloakPhase: 0,

      // Animation phases
      shieldPhase: 0,
      lightPhase: 0,
      beamPhase: 0,
      hoverPhase: Math.random() * Math.PI * 2,

      // Beam targeting
      beamTarget: null,
      beamIntensity: 0,

      // Mood system
      mood: "curious",
      moodTimer: 0,
      tiredness: 0,
      lastInterestTime: 0,

      // Click interaction
      lastClickTime: -9999,
      clickCount: 0,
      clickTarget: null,

      // Chase behavior
      chaseTarget: null,
      chaseStartTime: 0,
      lastChaseDistance: Infinity,
      giveUpTimer: 0,

      // Wobble/idle animations
      wobbleType: "none",
      wobbleTimer: 0,
      wobbleIntensity: 0,
      spinAngle: 0,
      isSneaky: false,
      scannedStars: new Set<string>(),
      lookAroundTimer: 0,

      // Narrative arc
      narrativePhase: "none",
      narrativeTimer: 0,
      narrativePhaseDuration: 0,

      // Sample collection
      sampleParticle: null,
      collectedSamples: 0,

      // Star photography
      photographedStars: new Set<string>(),
      cameraFlashTimer: 0,
      photoTarget: null,

      // Ground investigation
      groundParticles: [],
      anomalyPosition: null,

      // Panic/evasion
      panicDirection: 0,
      panicSpeed: 0,
      afterimagePositions: [],

      // Comet surfing
      surfTarget: null,
      surfOffset: { x: 0, y: 0 },

      // Communication
      commPattern: [],
      commPatternIndex: 0,
      commPulseTimer: 0,
      commTarget: null,
      awaitingResponse: false,

      // Napping
      sleepZs: [],
      napStartY: position.y,

      // Peek-a-boo
      hidePosition: null,
      peekProgress: 0,
      peekDirection: 0,

      // Celebration
      celebrationSpinSpeed: 0,
      celebrationBouncePhase: 0,
      rainbowPhase: 0,

      // Buddy system
      buddyTarget: null,
      buddyOffset: 50,

      // Rare discovery tracking
      rareBrowseies: 0,
    };
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  private calculateSpawnPosition(
    dim: { width: number; height: number },
    config: { size: number },
    entrance: UFOEntranceType,
    margin: number
  ): { x: number; y: number; startY: number; targetY: number } {
    let x: number;
    let y: number;
    let startY: number;
    let targetY: number;

    if (entrance === "descend") {
      x = margin + Math.random() * (dim.width - margin * 2);
      targetY = margin + Math.random() * (dim.height * 0.5 - margin);
      startY = -config.size * 2;
      y = startY;
    } else {
      x = margin + Math.random() * (dim.width - margin * 2);
      y = margin + Math.random() * (dim.height - margin * 2);
      targetY = y;
      startY = y;
    }

    return { x, y, startY, targetY };
  }

  private getInitialVisuals(entrance: UFOEntranceType): {
    opacity: number;
    scale: number;
  } {
    switch (entrance) {
      case "warp":
        return { opacity: 0, scale: 1 };
      case "zoom":
        return { opacity: 0.5, scale: 0.05 };
      case "descend":
        return { opacity: 0.8, scale: 1 };
      case "fade":
      default:
        return { opacity: 0, scale: 1 };
    }
  }
}
