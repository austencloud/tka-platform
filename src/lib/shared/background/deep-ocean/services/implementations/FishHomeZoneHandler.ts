import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishHomeZoneHandler } from "../contracts/IFishHomeZoneHandler";

/**
 * Configuration for home zone behavior
 */
const HOME_ZONE_CONFIG = {
  /** Base radius of home zone (pixels) */
  baseRadius: 150,

  /** Maximum drift force per second (pixels) */
  maxDriftForce: 2,

  /** Distance at which drift force starts to apply */
  activationDistance: 100,

  /** How strongly fish are drawn back (base value, modified by personality) */
  baseAffinity: 0.3,

  /** Affinity modifier based on sociability (social fish wander more) */
  sociabilityAffinityMod: -0.15,

  /** Affinity modifier based on curiosity (curious fish wander more) */
  curiosityAffinityMod: -0.1,

  /** Minimum affinity (even curious social fish have some home preference) */
  minAffinity: 0.1,

  /** Maximum affinity */
  maxAffinity: 0.6,
};

/**
 * FishHomeZoneHandler - Creates purposeful movement through home preferences
 *
 * Fish remember where they spawned and have a subtle tendency to return.
 * This makes movement feel more intentional rather than purely random.
 * Personality affects how strongly fish stick to their home:
 * - Social/curious fish wander more freely
 * - Shy/calm fish stay closer to home
 */
export class FishHomeZoneHandler implements IFishHomeZoneHandler {
  initializeHomeZone(fish: FishMarineLife): void {
    const personality = fish.personality;

    // Calculate affinity based on personality
    let affinity = HOME_ZONE_CONFIG.baseAffinity;

    if (personality) {
      // Social and curious fish wander more
      affinity += personality.sociability * HOME_ZONE_CONFIG.sociabilityAffinityMod;
      affinity += personality.curiosity * HOME_ZONE_CONFIG.curiosityAffinityMod;

      // Bold fish also wander a bit more
      affinity -= personality.boldness * 0.05;
    }

    // Clamp affinity
    affinity = Math.max(
      HOME_ZONE_CONFIG.minAffinity,
      Math.min(HOME_ZONE_CONFIG.maxAffinity, affinity)
    );

    fish.homeZone = {
      x: fish.x,
      y: fish.baseY,
      affinity,
    };
  }

  applyHomeZoneDrift(fish: FishMarineLife, deltaSeconds: number): void {
    const homeZone = fish.homeZone;
    if (!homeZone) return;

    // Calculate distance from home
    const dx = homeZone.x - fish.x;
    const dy = homeZone.y - fish.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only apply drift if far enough from home
    if (distance < HOME_ZONE_CONFIG.activationDistance) return;

    // Calculate drift strength (increases with distance)
    const distanceFactor = Math.min(
      1,
      (distance - HOME_ZONE_CONFIG.activationDistance) / HOME_ZONE_CONFIG.baseRadius
    );

    const driftStrength =
      HOME_ZONE_CONFIG.maxDriftForce * homeZone.affinity * distanceFactor * deltaSeconds;

    // Apply drift (normalize direction)
    if (distance > 0) {
      const driftX = (dx / distance) * driftStrength;
      const driftY = (dy / distance) * driftStrength;

      // Only apply vertical drift (horizontal is handled by edge awareness)
      fish.baseY += driftY;
      fish.y += driftY;

      // Subtle horizontal influence on vertical drift target
      // (fish tend to return to home Y position more than X)
    }
  }

  getHomeZoneVisualization(
    fish: FishMarineLife
  ): { x: number; y: number; radius: number; affinity: number } | null {
    const homeZone = fish.homeZone;
    if (!homeZone) return null;

    return {
      x: homeZone.x,
      y: homeZone.y,
      radius: HOME_ZONE_CONFIG.baseRadius,
      affinity: homeZone.affinity,
    };
  }
}
