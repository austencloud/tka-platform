/**
 * Gallery ITI Container
 *
 * Provides services for the 3D virtual gallery experience.
 * Includes layout generation, exhibit loading, and multiplayer support.
 */

import { createContainer } from "iti";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import { RoomGeometryGenerator } from "$lib/features/gallery/services/implementations/RoomGeometryGenerator";
import { CollisionWorldBuilder } from "$lib/features/gallery/services/implementations/CollisionWorldBuilder";
import { CollisionResolver } from "$lib/features/gallery/services/implementations/CollisionResolver";
import { ConnectionGeometryGenerator } from "$lib/features/gallery/services/implementations/ConnectionGeometryGenerator";
import { MansionLayoutGenerator } from "$lib/features/gallery/services/implementations/MansionLayoutGenerator";
import { ExhibitLoader } from "$lib/features/gallery/services/implementations/ExhibitLoader";
import { GallerySessionManager } from "$lib/features/gallery/multiplayer/services/implementations/GallerySessionManager";
import { GalleryPositionSyncer } from "$lib/features/gallery/multiplayer/services/implementations/GalleryPositionSyncer";

/**
 * Creates the gallery container with required dependencies.
 *
 * @param libraryRepository - The library repository for sequence access
 */
export function createGalleryContainer(libraryRepository: ILibraryRepository) {
  return createContainer()
    // === Tier 1: Core geometry services with no dependencies ===
    .add({
      roomGeometryGenerator: () => new RoomGeometryGenerator(),
      collisionWorldBuilder: () => new CollisionWorldBuilder(),
      collisionResolver: () => new CollisionResolver(),
      connectionGeometryGenerator: () => new ConnectionGeometryGenerator(),
    })
    // === Tier 2: Layout generator depends on geometry services ===
    .add((ctx) => ({
      galleryLayoutGenerator: () =>
        new MansionLayoutGenerator(
          ctx.roomGeometryGenerator,
          ctx.collisionWorldBuilder,
          ctx.connectionGeometryGenerator
        ),
    }))
    // === Tier 3: Exhibit loader depends on external library repository ===
    .add({
      exhibitLoader: () => new ExhibitLoader(libraryRepository),
    })
    // === Multiplayer services (no dependencies) ===
    .add({
      gallerySessionManager: () => new GallerySessionManager(),
      galleryPositionSyncer: () => new GalleryPositionSyncer(),
    });
}

export type GalleryContainer = ReturnType<typeof createGalleryContainer>;
