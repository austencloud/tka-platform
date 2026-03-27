/**
 * Gallery ITI Container
 *
 * Provides services for the 3D virtual gallery experience.
 * Simplified for model-based galleries.
 */

import { createContainer } from "iti";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import { ExhibitLoader } from "$lib/features/realm/destinations/gallery/services/implementations/ExhibitLoader";
import { GallerySessionManager } from "$lib/features/realm/destinations/gallery/multiplayer/services/implementations/GallerySessionManager";
import { GalleryPositionSyncer } from "$lib/features/realm/destinations/gallery/multiplayer/services/implementations/GalleryPositionSyncer";

/**
 * Creates the gallery container with required dependencies.
 *
 * @param libraryRepository - The library repository for sequence access
 */
export function createGalleryContainer(libraryRepository: ILibraryRepository) {
  return createContainer()
    // === Exhibit loader depends on external library repository ===
    .add({
      exhibitLoader: () => new ExhibitLoader(libraryRepository),
    })
    // === Multiplayer services ===
    .add({
      gallerySessionManager: () => new GallerySessionManager(),
      galleryPositionSyncer: () => new GalleryPositionSyncer(),
    });
}

export type GalleryContainer = ReturnType<typeof createGalleryContainer>;
