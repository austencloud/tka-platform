/**
 * Gallery State
 *
 * Reactive state management for the 3D gallery experience.
 */

import type { GalleryLayout } from "../domain/models/GalleryLayout";
import type { Exhibit, GalleryContentSource } from "../domain/models/Exhibit";
import { PLAYER_EYE_HEIGHT } from "../domain/constants/gallery-dimensions";

export interface GalleryStateData {
  /** Current gallery layout */
  layout: GalleryLayout | null;
  /** All exhibits in the gallery */
  exhibits: readonly Exhibit[];
  /** Player position in 3D space */
  playerPosition: { x: number; y: number; z: number };
  /** Currently focused exhibit (near the player) */
  focusedExhibitId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Content source type */
  contentSource: GalleryContentSource;
  /** User ID if viewing another user's gallery */
  sourceUserId: string | null;
}

/**
 * Creates a reactive gallery state instance
 */
export function createGalleryState() {
  // Core state
  let layout = $state<GalleryLayout | null>(null);
  let exhibits = $state<readonly Exhibit[]>([]);
  let playerPosition = $state({ x: 0, y: PLAYER_EYE_HEIGHT, z: 0 });
  let focusedExhibitId = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let contentSource = $state<GalleryContentSource>("user_library");
  let sourceUserId = $state<string | null>(null);

  // Derived: Get focused exhibit
  const focusedExhibit = $derived(
    exhibits.find((e) => e.id === focusedExhibitId) ?? null
  );

  // Derived: Get exhibits near player (for LOD)
  const nearbyExhibits = $derived.by(() => {
    const NEARBY_DISTANCE = 800;
    return exhibits.filter((exhibit) => {
      const dx = exhibit.avatarPosition.x - playerPosition.x;
      const dz = exhibit.avatarPosition.z - playerPosition.z;
      return Math.sqrt(dx * dx + dz * dz) < NEARBY_DISTANCE;
    });
  });

  return {
    // State getters
    get layout() {
      return layout;
    },
    get exhibits() {
      return exhibits;
    },
    get playerPosition() {
      return playerPosition;
    },
    get focusedExhibitId() {
      return focusedExhibitId;
    },
    get focusedExhibit() {
      return focusedExhibit;
    },
    get nearbyExhibits() {
      return nearbyExhibits;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get contentSource() {
      return contentSource;
    },
    get sourceUserId() {
      return sourceUserId;
    },

    // State setters
    setLayout(newLayout: GalleryLayout) {
      layout = newLayout;
      // Set player at spawn point
      playerPosition = { ...newLayout.spawnPoint };
    },

    setExhibits(newExhibits: readonly Exhibit[]) {
      exhibits = newExhibits;
    },

    setPlayerPosition(pos: { x: number; y: number; z: number }) {
      playerPosition = pos;
      // Update focused exhibit based on proximity
      this.updateFocusedExhibit();
    },

    setFocusedExhibit(exhibitId: string | null) {
      focusedExhibitId = exhibitId;
    },

    setLoading(loading: boolean) {
      isLoading = loading;
    },

    setError(err: string | null) {
      error = err;
    },

    setContentSource(source: GalleryContentSource, userId?: string) {
      contentSource = source;
      sourceUserId = userId ?? null;
    },

    // Actions
    updateFocusedExhibit() {
      const FOCUS_DISTANCE = 200;
      let closest: Exhibit | null = null;
      let closestDist = Infinity;

      for (const exhibit of exhibits) {
        const dx = exhibit.avatarPosition.x - playerPosition.x;
        const dz = exhibit.avatarPosition.z - playerPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < FOCUS_DISTANCE && dist < closestDist) {
          closest = exhibit;
          closestDist = dist;
        }
      }

      focusedExhibitId = closest?.id ?? null;
    },

    reset() {
      layout = null;
      exhibits = [];
      playerPosition = { x: 0, y: PLAYER_EYE_HEIGHT, z: 0 };
      focusedExhibitId = null;
      isLoading = false;
      error = null;
      contentSource = "user_library";
      sourceUserId = null;
    },
  };
}

// Export type for consumers
export type GalleryState = ReturnType<typeof createGalleryState>;
