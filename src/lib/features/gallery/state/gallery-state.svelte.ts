/**
 * Gallery State
 *
 * Reactive state management for the 3D gallery experience.
 */

import type { GalleryLayout } from "../domain/models/GalleryLayout";
import type { Exhibit, GalleryContentSource } from "../domain/models/Exhibit";
import type { ModelSlot } from "../services/implementations/MuseumModelLoader";
import {
  PLAYER_EYE_HEIGHT,
  AVATAR_DEACTIVATION_DISTANCE,
} from "../domain/constants/gallery-dimensions";

export interface GalleryStateData {
  /** Current gallery layout */
  layout: GalleryLayout | null;
  /** All exhibits in the gallery */
  exhibits: readonly Exhibit[];
  /** Player position in 3D space */
  playerPosition: { x: number; y: number; z: number };
  /** ID of the room the player is currently in */
  currentRoomId: string | null;
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
  /** Whether gallery lights are on (affects lighting + thumbnail mode) */
  lightsOn: boolean;
  /** Exhibit slots extracted from loaded 3D model (replaces procedural slots) */
  modelSlots: readonly ModelSlot[];
  /** Whether to use model-based rendering instead of procedural */
  useModelRendering: boolean;
}

/**
 * Creates a reactive gallery state instance
 */
export function createGalleryState() {
  // Core state
  let layout = $state<GalleryLayout | null>(null);
  let exhibits = $state<readonly Exhibit[]>([]);
  let playerPosition = $state({ x: 0, y: PLAYER_EYE_HEIGHT, z: 0 });
  let currentRoomId = $state<string | null>(null);
  let focusedExhibitId = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let contentSource = $state<GalleryContentSource>("user_library");
  let sourceUserId = $state<string | null>(null);
  let lightsOn = $state(true); // Lights on by default

  // Model-based rendering state
  let modelSlots = $state<readonly ModelSlot[]>([]);
  let useModelRendering = $state(false);

  // Derived: Get focused exhibit
  const focusedExhibit = $derived(
    exhibits.find((e) => e.id === focusedExhibitId) ?? null
  );

  // Derived: Get exhibits near player (for proximity-based activation)
  const nearbyExhibits = $derived.by(() => {
    return exhibits.filter((exhibit) => {
      const dx = exhibit.avatarPosition.x - playerPosition.x;
      const dz = exhibit.avatarPosition.z - playerPosition.z;
      return Math.sqrt(dx * dx + dz * dz) < AVATAR_DEACTIVATION_DISTANCE;
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
    get lightsOn() {
      return lightsOn;
    },
    get currentRoomId() {
      return currentRoomId;
    },
    get modelSlots() {
      return modelSlots;
    },
    get useModelRendering() {
      return useModelRendering;
    },

    // State setters
    setLayout(newLayout: GalleryLayout) {
      layout = newLayout;
      // Set player at spawn point
      playerPosition = { ...newLayout.spawnPoint };
      // Set initial room
      currentRoomId = newLayout.spawnRoomId;
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

    setLightsOn(on: boolean) {
      lightsOn = on;
    },

    toggleLights() {
      lightsOn = !lightsOn;
    },

    setCurrentRoomId(roomId: string) {
      currentRoomId = roomId;
    },

    /**
     * Set exhibit slots from a loaded 3D model.
     * This enables model-based rendering and replaces procedural slots.
     */
    setModelSlots(slots: readonly ModelSlot[]) {
      modelSlots = slots;
      useModelRendering = slots.length > 0;
      console.debug(
        `[GalleryState] Set ${slots.length} model slots, useModelRendering=${useModelRendering}`
      );
    },

    /**
     * Toggle between model-based and procedural rendering.
     * Useful for A/B testing during migration.
     */
    setUseModelRendering(use: boolean) {
      useModelRendering = use;
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
      currentRoomId = null;
      focusedExhibitId = null;
      isLoading = false;
      error = null;
      contentSource = "user_library";
      sourceUserId = null;
      lightsOn = true;
      modelSlots = [];
      useModelRendering = false;
    },
  };
}

// Export type for consumers
export type GalleryState = ReturnType<typeof createGalleryState>;
