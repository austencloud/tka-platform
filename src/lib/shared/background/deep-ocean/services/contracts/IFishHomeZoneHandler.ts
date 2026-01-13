import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * IFishHomeZoneHandler - Manages fish home zone preferences
 *
 * Fish have a preferred "home zone" where they spawned. Over time,
 * they have a subtle tendency to drift back toward this area,
 * making their movement feel more purposeful and less random.
 */
export interface IFishHomeZoneHandler {
  /**
   * Initialize home zone for a newly spawned fish
   * Should be called right after fish creation
   *
   * @param fish - The fish to initialize
   */
  initializeHomeZone(fish: FishMarineLife): void;

  /**
   * Apply home zone drift influence to fish movement
   * Adds a subtle bias toward the home zone
   *
   * @param fish - The fish to update
   * @param deltaSeconds - Time since last frame
   */
  applyHomeZoneDrift(fish: FishMarineLife, deltaSeconds: number): void;

  /**
   * Get debug visualization data for a fish's home zone
   *
   * @param fish - The fish to get zone for
   * @returns Center and radius for debug drawing, or null if no zone
   */
  getHomeZoneVisualization(
    fish: FishMarineLife
  ): { x: number; y: number; radius: number; affinity: number } | null;
}
