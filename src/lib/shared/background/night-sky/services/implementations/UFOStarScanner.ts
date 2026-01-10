/**
 * UFOStarScanner - Handles star discovery and memory for UFO scanning behavior
 *
 * Manages finding nearby stars for the UFO to scan, tracking which stars
 * have been scanned recently to avoid repetition.
 */

import type { IUFOStarScanner } from "../contracts/IUFOStarScanner";
import type { UFO, StarInfo } from "../domain/ufo-types";
import type { Dimensions } from "../../../shared/domain/types/background-types";

/** Maximum number of stars to remember */
const MAX_MEMORY_SIZE = 10;

/** Grid cell size for star position hashing */
const GRID_CELL_SIZE = 20;

/** Minimum distance to star (too close = weird beam angle) */
const MIN_STAR_DISTANCE = 30;

/** Maximum distance to search for drifted star */
const DRIFT_SEARCH_RADIUS = 50;

export class UFOStarScanner implements IUFOStarScanner {
  findNearbyBrightStar(
    ufo: UFO,
    dimensions: Dimensions,
    starProvider: () => StarInfo[]
  ): StarInfo | null {
    const stars = starProvider();

    // Find all scannable stars within range (50% of screen width)
    const maxDist = dimensions.width * 0.5;
    const candidates: StarInfo[] = [];

    for (const star of stars) {
      const dx = star.x - ufo.x;
      const dy = star.y - ufo.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Star must be in range but not too close
      if (dist < maxDist && dist > MIN_STAR_DISTANCE) {
        // Check memory - skip recently scanned stars
        const starKey = this.getStarKey(star.x, star.y);
        if (!ufo.scannedStars.has(starKey)) {
          candidates.push(star);
        }
      }
    }

    if (candidates.length === 0) {
      // All nearby stars scanned - clear memory and allow rescanning
      ufo.scannedStars.clear();
      return null;
    }

    // Randomly pick from candidates, weighted slightly toward brighter stars
    // This gives variety while still preferring interesting targets
    const weights = candidates.map((star) => 0.3 + star.brightness * 0.7);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      const weight = weights[i];
      const candidate = candidates[i];
      if (weight !== undefined && candidate) {
        random -= weight;
        if (random <= 0) {
          return candidate;
        }
      }
    }

    // Fallback to random pick
    const fallbackIndex = Math.floor(Math.random() * candidates.length);
    return candidates[fallbackIndex] ?? null;
  }

  findStarNearPosition(
    targetX: number,
    targetY: number,
    starProvider: () => StarInfo[]
  ): StarInfo | null {
    const stars = starProvider();

    // Find the star closest to the target position
    // Use a tight radius - if the star drifted too far, we lost it
    let closestStar: StarInfo | null = null;
    let closestDist = DRIFT_SEARCH_RADIUS;

    for (const star of stars) {
      const dx = star.x - targetX;
      const dy = star.y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestStar = star;
      }
    }

    return closestStar;
  }

  rememberScannedStar(ufo: UFO, x: number, y: number): void {
    const key = this.getStarKey(x, y);
    ufo.scannedStars.add(key);

    // Keep memory limited to last ~10 stars
    if (ufo.scannedStars.size > MAX_MEMORY_SIZE) {
      const firstKey = ufo.scannedStars.values().next().value;
      if (firstKey) ufo.scannedStars.delete(firstKey);
    }
  }

  getStarKey(x: number, y: number): string {
    // Round to grid cells to handle slight position drift
    const gridX = Math.round(x / GRID_CELL_SIZE);
    const gridY = Math.round(y / GRID_CELL_SIZE);
    return `${gridX},${gridY}`;
  }
}
